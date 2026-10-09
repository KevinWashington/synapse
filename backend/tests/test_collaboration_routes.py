def test_collaboration_routes_are_registered():
    from app.main import app

    routes = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    expected = {
        ("/api/projetos/{projectId}/members", "GET"),
        ("/api/projetos/{projectId}/invitations", "POST"),
        ("/api/projetos/{projectId}/transfer-ownership", "POST"),
        ("/api/inbox", "GET"),
        ("/api/invitations", "GET"),
        ("/api/invitations/{invitationId}/accept", "POST"),
        ("/api/invitations/{invitationId}/decline", "POST"),
        ("/api/notifications/{notificationId}/read", "PATCH"),
        ("/api/notifications/read-all", "POST"),
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


def test_invitation_submission_response_does_not_reveal_account_existence(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, Mock

    from app.models.collaboration import ProjectInvitation, ProjectMember
    from app.routers import collaboration

    async def submit(service_result):
        monkeypatch.setattr(
            collaboration,
            "resolve_project_access",
            AsyncMock(return_value=SimpleNamespace(project=SimpleNamespace(id=7))),
        )
        monkeypatch.setattr(
            collaboration,
            "invite_project_member",
            AsyncMock(return_value=service_result),
        )
        db = SimpleNamespace(commit=AsyncMock())
        result = await collaboration.create_invitation(
            7,
            collaboration.InvitationCreate(email="person@example.com"),
            current_user=SimpleNamespace(id=1),
            db=db,
        )
        return result.model_dump()

    existing_account = asyncio.run(submit(ProjectMember()))
    unknown_account = asyncio.run(submit(ProjectInvitation()))

    assert existing_account == unknown_account == {
        "message": "Solicitação de convite registrada.",
    }


def test_invitation_update_and_cancel_are_audited_with_optional_reason(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, Mock

    from app.models.collaboration import ProjectAuditEvent, ProjectInvitation
    from app.routers import collaboration

    invitation = ProjectInvitation(
        projectId=7,
        emailNormalized="person@example.com",
        role="reviewer",
        participatesInReview=True,
        status="pending",
    )
    invitation.id = 3
    access = SimpleNamespace(capabilities=frozenset({"manage_members"}))
    monkeypatch.setattr(
        collaboration,
        "resolve_project_access",
        AsyncMock(return_value=access),
    )

    async def check():
        update_db = SimpleNamespace(
            execute=AsyncMock(
                return_value=SimpleNamespace(scalar_one_or_none=lambda: invitation)
            ),
            add=Mock(),
            commit=AsyncMock(),
            refresh=AsyncMock(),
        )
        await collaboration.update_invitation(
            7,
            3,
            collaboration.InvitationUpdate(
                role="coordinator",
                participatesInReview=False,
                reason="Ajuste solicitado pela coordenação",
            ),
            current_user=SimpleNamespace(id=1),
            db=update_db,
        )
        updated_event = update_db.add.call_args.args[0]
        assert isinstance(updated_event, ProjectAuditEvent)
        assert updated_event.action == "invitation_updated"
        assert updated_event.reason == "Ajuste solicitado pela coordenação"

        cancel_db = SimpleNamespace(
            execute=AsyncMock(
                return_value=SimpleNamespace(scalar_one_or_none=lambda: invitation)
            ),
            add=Mock(),
            commit=AsyncMock(),
        )
        await collaboration.cancel_invitation(
            7,
            3,
            reason="E-mail informado incorretamente",
            current_user=SimpleNamespace(id=1),
            db=cancel_db,
        )
        cancelled_event = cancel_db.add.call_args.args[0]
        assert isinstance(cancelled_event, ProjectAuditEvent)
        assert cancelled_event.action == "invitation_cancelled"
        assert cancelled_event.reason == "E-mail informado incorretamente"

    asyncio.run(check())


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
