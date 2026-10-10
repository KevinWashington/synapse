import asyncio
import csv
import io
import json
from types import SimpleNamespace


def test_csv_row_quotes_unicode_newlines_and_prevents_formulas():
    from app.services.synthesis_export_service import csv_row

    line = csv_row(["Título, científico", "linha 1\nlinha 2", "=SUM(1,2)", "área"])
    assert next(csv.reader(io.StringIO(line))) == ["Título, científico", "linha 1\nlinha 2", "'=SUM(1,2)", "área"]


def test_matrix_export_streams_every_page_and_full_scope_ignores_filters(monkeypatch):
    from app.services import synthesis_query_service
    from app.services.synthesis_export_service import iter_matrix_rows

    calls = []

    async def list_matrix(db, project, filters, *, page, page_size):
        calls.append((filters, page, page_size))
        return {"items": [{"articleId": page}], "page": page, "pageSize": 1, "total": 2}

    monkeypatch.setattr(synthesis_query_service, "list_matrix", list_matrix)

    async def collect(scope):
        return [item async for item in iter_matrix_rows(None, SimpleNamespace(id=3), {"search": "tese"}, scope=scope, page_size=1)]

    filtered = asyncio.run(collect("filtered"))
    calls.clear()
    full = asyncio.run(collect("full"))

    assert [item["articleId"] for item in filtered] == [1, 2]
    assert [item["articleId"] for item in full] == [1, 2]
    assert [call[0] for call in calls] == [{}, {}]


def test_json_report_stream_is_valid_and_contains_draft_sources(monkeypatch):
    from app.services import synthesis_query_service
    from app.services.synthesis_export_service import iter_matrix_rows, iter_json_report

    async def get_rq_detail(db, project, number):
        return {"draft": {"content": {"narrative": "síntese"}, "updatedByUserId": 9, "sourceArticleIds": [1]}}

    async def matrix_rows(db, project, filters, *, scope="filtered", page_size=100):
        yield {"articleId": 1, "title": "Estudo"}

    monkeypatch.setattr(synthesis_query_service, "get_rq_detail", get_rq_detail)
    monkeypatch.setattr("app.services.synthesis_export_service.iter_matrix_rows", matrix_rows)
    project = SimpleNamespace(id=3, title="Revisão", researchQuestions=["RQ 1"])

    async def collect():
        return "".join([part async for part in iter_json_report(None, project)])

    payload = json.loads(asyncio.run(collect()))
    assert payload["projectTitle"] == "Revisão"
    assert payload["researchQuestions"][0]["synthesis"]["sources"] == [1]
    assert payload["studies"] == [{"articleId": 1, "title": "Estudo"}]
