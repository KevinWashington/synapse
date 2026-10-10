def test_synthesis_workspace_routes_are_registered():
    from app.main import app

    routes = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    expected = {
        ("/api/projetos/{projectId}/synthesis/overview", "GET"),
        ("/api/projetos/{projectId}/synthesis/rqs", "GET"),
        ("/api/projetos/{projectId}/synthesis/rqs/{rqNumber}", "GET"),
        ("/api/projetos/{projectId}/synthesis/rqs/{rqNumber}/evidence", "GET"),
        ("/api/projetos/{projectId}/synthesis/matrix", "GET"),
        ("/api/projetos/{projectId}/synthesis/matrix/{articleId}", "GET"),
        ("/api/projetos/{projectId}/synthesis/charts", "GET"),
        ("/api/projetos/{projectId}/synthesis/quality/criteria", "GET"),
        ("/api/projetos/{projectId}/synthesis/quality/studies", "GET"),
        ("/api/projetos/{projectId}/synthesis/rqs/{rqNumber}/generations", "POST"),
        ("/api/projetos/{projectId}/synthesis/rqs/{rqNumber}", "PATCH"),
        ("/api/projetos/{projectId}/synthesis/rqs/{rqNumber}", "DELETE"),
        ("/api/projetos/{projectId}/synthesis/generations/{generationId}", "GET"),
        ("/api/projetos/{projectId}/synthesis/generations/{generationId}/cancel", "POST"),
        ("/api/projetos/{projectId}/synthesis/exports/{kind}", "GET"),
    }
    assert expected <= routes


def test_export_cells_are_formula_safe_and_unicode_preserving():
    from app.services.synthesis_export_service import csv_safe_cell

    assert csv_safe_cell("=SUM(1,2)") == "'=SUM(1,2)"
    assert csv_safe_cell("  +cmd") == "'  +cmd"
    assert csv_safe_cell("Revisão, ‘ação’\nlinha 2") == "Revisão, ‘ação’\nlinha 2"


def test_generation_route_commits_the_queued_job(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from app.routers import synthesis
    from app.schemas.synthesis import GenerationRequest

    job = SimpleNamespace(id=11, rqNumber=2, status="queued", completedBatches=0, totalBatches=0, errorCode=None)
    db = SimpleNamespace(commit=AsyncMock(), refresh=AsyncMock())
    monkeypatch.setattr(synthesis, "_access", AsyncMock(return_value=SimpleNamespace(project=SimpleNamespace(id=5))))
    monkeypatch.setattr(synthesis, "enqueue_generation", AsyncMock(return_value=job))

    result = asyncio.run(synthesis.generate(5, 2, GenerationRequest(
        expectedVersion=0, questionFingerprint="a" * 64, replaceExisting=False,
        idempotencyKey="2e2c9d44-7a9e-46d0-9c48-0713b86fb6ec",
    ), current_user=SimpleNamespace(id=7), db=db))

    assert result["id"] == 11
    db.commit.assert_awaited_once()


def test_manual_save_route_returns_versioned_dto_and_commits(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from app.routers import synthesis
    from app.schemas.synthesis import ManualSynthesisUpdate

    db = SimpleNamespace(commit=AsyncMock())
    payload = {"draft": {"content": {"narrative": "saved", "keyFindings": [], "divergences": [], "limitations": []}, "version": 3, "questionFingerprint": "a" * 64, "evidenceFingerprint": "b" * 64, "updatedAt": None, "updatedByUserId": 7}}
    monkeypatch.setattr(synthesis, "_access", AsyncMock(return_value=SimpleNamespace(project=SimpleNamespace(id=5))))
    monkeypatch.setattr(synthesis, "save_manual_draft", AsyncMock(return_value=payload))

    result = asyncio.run(synthesis.save_draft(5, 2, ManualSynthesisUpdate(
        expectedVersion=2, questionFingerprint="a" * 64, content={"narrative": "saved"},
    ), current_user=SimpleNamespace(id=7), db=db))

    assert result["version"] == 3
    assert result["content"]["narrative"] == "saved"
    db.commit.assert_awaited_once()
