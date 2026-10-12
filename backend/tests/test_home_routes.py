from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    from app.routers import stats
    app = FastAPI()
    app.include_router(stats.router, prefix="/api")
    app.dependency_overrides[stats.get_current_user] = lambda: SimpleNamespace(id=7)
    app.dependency_overrides[stats.get_db] = lambda: object()
    monkeypatch.setattr(stats, "get_home_summary", AsyncMock(return_value={"screeningPending": 2, "eligibilityPending": 1}))
    monkeypatch.setattr(stats, "get_home_tasks", AsyncMock(return_value={"items": [], "total": 0, "page": 1, "pageSize": 4}))
    monkeypatch.setattr(stats, "get_home_activity", AsyncMock(return_value={"items": [], "total": 0, "page": 1, "pageSize": 4}))
    monkeypatch.setattr(stats, "get_home_reading", AsyncMock(return_value={"article": {"id": 9, "projectId": 7, "title": "Study", "currentPhase": "screening", "reviewOutcome": "active"}, "project": {"id": 7, "title": "Review"}}))
    with TestClient(app) as test_client:
        yield test_client, app, stats


def test_home_routes_have_typed_authenticated_responses(client):
    test_client, app, stats = client
    assert test_client.get("/api/home/summary").json() == {"screeningPending": 2, "eligibilityPending": 1}
    for path in ("tasks", "activity"):
        assert test_client.get(f"/api/home/{path}").json() == {"items": [], "total": 0, "page": 1, "pageSize": 4}
    assert test_client.get("/api/home/reading?projectId=7&articleId=9").json()["article"]["title"] == "Study"
    stats.get_home_reading.assert_awaited_once_with(stats.get_home_reading.call_args.args[0], user_id=7, project_id=7, article_id=9)
    def denied():
        raise HTTPException(401)
    app.dependency_overrides[stats.get_current_user] = denied
    for path in ("summary", "tasks", "activity"):
        assert test_client.get(f"/api/home/{path}").status_code == 401
    assert test_client.get("/api/home/reading?projectId=7&articleId=9").status_code == 401


@pytest.mark.parametrize("query", ["", "projectId=0&articleId=9", "projectId=7&articleId=-1"])
def test_home_reading_requires_valid_identifiers(client, query):
    assert client[0].get(f"/api/home/reading?{query}").status_code == 422


@pytest.mark.parametrize("query", ["phase=included", "page=0", "pageSize=0", "pageSize=51"])
def test_home_tasks_rejects_invalid_parameters(client, query):
    assert client[0].get(f"/api/home/tasks?{query}").status_code == 422


@pytest.mark.parametrize("query", ["page=0", "pageSize=0", "pageSize=51"])
def test_home_activity_rejects_invalid_parameters(client, query):
    assert client[0].get(f"/api/home/activity?{query}").status_code == 422
