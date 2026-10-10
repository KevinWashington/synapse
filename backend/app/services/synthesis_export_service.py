import csv
import io
import json


def csv_safe_cell(value):
    if value is None:
        return ""
    text = str(value)
    if text.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + text
    return text


def csv_row(values):
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow([csv_safe_cell(value) for value in values])
    return buffer.getvalue()


async def iter_matrix_rows(db, project, filters, *, scope="filtered", page_size=100):
    from app.services.synthesis_query_service import list_matrix

    query_filters = filters if scope == "filtered" else {}
    page = 1
    while True:
        result = await list_matrix(db, project, query_filters, page=page, page_size=page_size)
        for item in result["items"]:
            yield item
        if page * result["pageSize"] >= result["total"]:
            break
        page += 1


async def iter_json_report(db, project, filters=None, *, scope="full"):
    from app.services.synthesis_query_service import get_rq_detail

    yield '{"projectId":' + json.dumps(project.id) + ',"projectTitle":' + json.dumps(project.title, ensure_ascii=False) + ',"researchQuestions":['
    for number, question in enumerate(project.researchQuestions or [], start=1):
        if number > 1:
            yield ","
        detail = await get_rq_detail(db, project, number)
        draft = detail.get("draft") if detail else None
        if draft:
            draft = {**draft, "authorUserId": draft.get("updatedByUserId"), "sources": draft.get("sourceArticleIds", [])}
        yield json.dumps({"rqNumber": number, "question": question, "synthesis": draft}, ensure_ascii=False, default=str)
    yield '],"studies":['
    first = True
    async for row in iter_matrix_rows(db, project, filters or {}, scope=scope):
        if not first:
            yield ","
        first = False
        yield json.dumps(row, ensure_ascii=False, default=str)
    yield "],\"scope\":" + json.dumps(scope) + "}"
