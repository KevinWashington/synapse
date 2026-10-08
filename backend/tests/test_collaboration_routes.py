def test_collaboration_routes_are_registered():
    from app.main import app

    routes = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    expected = {
        ("/api/projetos/{projectId}/members", "GET"),
        ("/api/projetos/{projectId}/invitations", "POST"),
        ("/api/projetos/{projectId}/transfer-ownership", "POST"),
        ("/api/projetos/{projectId}/notifications", "GET"),
        ("/api/projetos/{projectId}/notifications/read-all", "POST"),
        ("/api/projetos/{projectId}/assignments/preview", "POST"),
        ("/api/projetos/{projectId}/assignments/distribute", "POST"),
        ("/api/projetos/{projectId}/assignments/me", "GET"),
        ("/api/projetos/{projectId}/assignments", "GET"),
        ("/api/projetos/{projectId}/conflicts", "GET"),
        ("/api/projetos/{projectId}/conflicts/{conflictId}/resolve", "POST"),
        ("/api/projetos/{projectId}/artigos/{articleId}/reopen-review", "POST"),
    }
    assert expected <= routes


def test_team_member_response_represents_implicit_owner_with_identity():
    from datetime import datetime, timezone
    from types import SimpleNamespace

    from app.routers.collaboration import build_member_response

    now = datetime.now(timezone.utc)
    owner = SimpleNamespace(id=1, name="Owner", email="owner@example.com", avatar=None)
    response = build_member_response(
        project_id=7,
        user=owner,
        role="owner",
        participates_in_review=True,
        membership=None,
        joined_at=now,
    )

    assert response.id is None
    assert response.userId == 1
    assert response.role == "owner"
    assert response.name == "Owner"
    assert response.email == "owner@example.com"


async def _assignment_list(role, monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    from app.routers import collaboration
    from app.services.project_access_service import capabilities_for_role

    access = SimpleNamespace(capabilities=capabilities_for_role(role, participates_in_review=False))
    monkeypatch.setattr(collaboration, "resolve_project_access", AsyncMock(return_value=access))
    rows = [SimpleNamespace(id=9, projectId=7, articleId=12, reviewerUserId=99, status="needs_reassignment")]
    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: rows))
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    return collaboration, db, rows


def test_admin_assignment_list_is_scoped_and_includes_unavailable_reviewers(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from sqlalchemy.dialects import postgresql

    async def check():
        collaboration, db, rows = await _assignment_list("coordinator", monkeypatch)
        result = await collaboration.project_assignments(7, current_user=SimpleNamespace(id=2), db=db)
        assert result == rows
        query = str(db.execute.call_args.args[0].compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        where = query.split("WHERE", 1)[1]
        assert '"projectId" = 7' in where
        assert "'cancelled'" in where
        assert '"reviewerUserId" =' not in where
    asyncio.run(check())


def test_reviewer_cannot_list_administrative_assignments(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    import pytest
    from fastapi import HTTPException

    async def check():
        collaboration, db, _ = await _assignment_list("reviewer", monkeypatch)
        with pytest.raises(HTTPException) as denied:
            await collaboration.project_assignments(7, current_user=SimpleNamespace(id=2), db=db)
        assert denied.value.status_code == 403
        db.execute.assert_not_called()
    asyncio.run(check())
