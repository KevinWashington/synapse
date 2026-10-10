from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.schemas.collaboration import MemberUpdate
from app.services.project_access_service import CAP_MANAGE_MEMBERS, ProjectAccess


def _result(value):
    return SimpleNamespace(scalar_one_or_none=lambda: value)


def _access():
    return ProjectAccess(
        project=SimpleNamespace(id=7, ownerId=1),
        role="owner",
        capabilities=frozenset({CAP_MANAGE_MEMBERS}),
        participates_in_review=True,
    )


@pytest.mark.asyncio
async def test_disabling_review_participation_invalidates_pending_assignments_and_audits_transition(monkeypatch):
    from app.routers import collaboration

    member = SimpleNamespace(
        id=4,
        projectId=7,
        userId=22,
        role="coordinator",
        status="active",
        participatesInReview=True,
        deactivatedAt=None,
    )
    db = SimpleNamespace(
        execute=AsyncMock(return_value=_result(member)),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )
    unavailable = AsyncMock(return_value=3)
    notify = AsyncMock()
    audit = Mock()
    monkeypatch.setattr(collaboration, "resolve_project_access", AsyncMock(return_value=_access()))
    monkeypatch.setattr(collaboration, "mark_reviewer_unavailable", unavailable)
    monkeypatch.setattr(collaboration, "notify_member_administration", notify)
    monkeypatch.setattr(collaboration, "create_audit_event", audit)

    await collaboration.update_member(
        7,
        4,
        MemberUpdate(participatesInReview=False),
        current_user=SimpleNamespace(id=1),
        db=db,
    )

    unavailable.assert_awaited_once_with(db, project_id=7, reviewer_user_id=22)
    audit.assert_called_once_with(
        db,
        project_id=7,
        actor_user_id=1,
        action="member_updated",
        entity_type="member",
        entity_id=22,
        reason="Participação em revisões desativada administrativamente.",
        payload={
            "previous": {"role": "coordinator", "participatesInReview": True, "status": "active"},
            "new": {"role": "coordinator", "participatesInReview": False, "status": "active"},
            "assignmentsMarkedForReassignment": 3,
        },
    )
    notify.assert_awaited_once()
    assert notify.await_args.kwargs["assignments_marked_for_reassignment"] == 3


@pytest.mark.asyncio
async def test_compatible_role_change_preserves_assignments_and_audits_previous_and_new_state(monkeypatch):
    from app.routers import collaboration

    member = SimpleNamespace(
        id=4,
        projectId=7,
        userId=22,
        role="reviewer",
        status="active",
        participatesInReview=True,
        deactivatedAt=None,
    )
    db = SimpleNamespace(execute=AsyncMock(return_value=_result(member)), commit=AsyncMock(), refresh=AsyncMock())
    unavailable = AsyncMock()
    notify = AsyncMock()
    audit = Mock()
    monkeypatch.setattr(collaboration, "resolve_project_access", AsyncMock(return_value=_access()))
    monkeypatch.setattr(collaboration, "mark_reviewer_unavailable", unavailable)
    monkeypatch.setattr(collaboration, "notify_member_administration", notify)
    monkeypatch.setattr(collaboration, "create_audit_event", audit)

    await collaboration.update_member(
        7,
        4,
        MemberUpdate(role="coordinator"),
        current_user=SimpleNamespace(id=1),
        db=db,
    )

    unavailable.assert_not_awaited()
    assert audit.call_args.kwargs["reason"] == "Papel do membro alterado administrativamente."
    assert audit.call_args.kwargs["payload"] == {
        "previous": {"role": "reviewer", "participatesInReview": True, "status": "active"},
        "new": {"role": "coordinator", "participatesInReview": True, "status": "active"},
        "assignmentsMarkedForReassignment": 0,
    }
    assert notify.await_args.kwargs["change_type"] == "role_changed"


@pytest.mark.asyncio
async def test_removing_member_preserves_history_and_records_reassignment_count(monkeypatch):
    from app.routers import collaboration

    member = SimpleNamespace(
        id=4,
        projectId=7,
        userId=22,
        role="reviewer",
        status="active",
        participatesInReview=True,
        deactivatedAt=None,
    )
    db = SimpleNamespace(execute=AsyncMock(return_value=_result(member)), commit=AsyncMock())
    unavailable = AsyncMock(return_value=2)
    notify = AsyncMock()
    audit = Mock()
    monkeypatch.setattr(collaboration, "resolve_project_access", AsyncMock(return_value=_access()))
    monkeypatch.setattr(collaboration, "mark_reviewer_unavailable", unavailable)
    monkeypatch.setattr(collaboration, "notify_member_administration", notify)
    monkeypatch.setattr(collaboration, "create_audit_event", audit)

    await collaboration.remove_member(7, 4, current_user=SimpleNamespace(id=1), db=db)

    from sqlalchemy.dialects import postgresql
    first_query = str(db.execute.call_args_list[0].args[0].compile(dialect=postgresql.dialect()))
    assert "FROM projects" in first_query and "FOR NO KEY UPDATE" in first_query
    assert member.status == "inactive"
    assert member.deactivatedAt is not None
    unavailable.assert_awaited_once_with(db, project_id=7, reviewer_user_id=22)
    assert audit.call_args.kwargs["reason"] == "Membro removido administrativamente do projeto."
    assert audit.call_args.kwargs["payload"] == {
        "previous": {"role": "reviewer", "participatesInReview": True, "status": "active"},
        "new": {"role": "reviewer", "participatesInReview": True, "status": "inactive"},
        "assignmentsMarkedForReassignment": 2,
    }
    assert notify.await_args.kwargs["change_type"] == "member_removed"
