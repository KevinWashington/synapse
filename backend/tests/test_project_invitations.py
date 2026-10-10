from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.collaboration import (
    ProjectAuditEvent,
    ProjectInvitation,
    ProjectMember,
    ProjectNotification,
)
from app.services.invitation_service import (
    decide_invitation,
    invite_project_member,
    normalize_email,
)


class ScalarResult:
    def __init__(self, value=None, values=None):
        self.value = value
        self.values = values or []

    def scalar_one_or_none(self):
        return self.value

    def scalar_one(self):
        if self.value is None:
            raise AssertionError("Expected one scalar value")
        return self.value

    def scalars(self):
        return SimpleNamespace(all=lambda: self.values)


@pytest.fixture(autouse=True)
def isolate_team_lock(monkeypatch):
    # PostgreSQL lock semantics are covered by the concurrency integration test.
    monkeypatch.setattr("app.services.invitation_service.lock_project_team", AsyncMock())


def owner_access():
    return SimpleNamespace(
        project=SimpleNamespace(id=7, ownerId=1),
        role="owner",
        capabilities=frozenset({"manage_members"}),
    )


def test_normalize_email_strips_and_lowercases():
    assert normalize_email("  Person@Example.COM ") == "person@example.com"


@pytest.mark.asyncio
async def test_signup_claims_projects_in_consistent_order_to_avoid_team_lock_deadlocks():
    from app.services.invitation_service import claim_pending_invitations
    invitations = [ProjectInvitation(id=id, projectId=project, emailNormalized="new@example.com", role="reviewer",
                    participatesInReview=True, status="pending", invitedByUserId=None,
                    expiresAt=datetime.now(timezone.utc) + timedelta(days=1)) for id, project in [(2, 20), (1, 10)]]
    db = SimpleNamespace(execute=AsyncMock(side_effect=[ScalarResult(values=[]), ScalarResult(values=invitations),
                         ScalarResult(None), ScalarResult(None)]), add=Mock(), flush=AsyncMock(),
                         begin_nested=AsyncMock(return_value=SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())))
    members = await claim_pending_invitations(db, user=SimpleNamespace(id=22, email="new@example.com", name="New"))
    assert [member.projectId for member in members] == [10, 20]
    assert all(invitation.status == "accepted" for invitation in invitations)


@pytest.mark.asyncio
async def test_existing_user_invite_stays_pending_until_the_invitee_accepts():
    existing_user = SimpleNamespace(id=22, email="person@example.com", name="Person")
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                ScalarResult(existing_user),
                ScalarResult(None),
                ScalarResult(None),
            ]
        ),
        add=Mock(),
        flush=AsyncMock(),
        begin_nested=AsyncMock(
            return_value=SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
        ),
    )

    result = await invite_project_member(
        db,
        access=owner_access(),
        invited_by_user_id=1,
        email=" Person@Example.com ",
        role="reviewer",
        participates_in_review=True,
    )

    assert isinstance(result, ProjectInvitation)
    added = [call.args[0] for call in db.add.call_args_list]
    assert not any(isinstance(item, ProjectMember) and item.userId == 22 for item in added)
    assert not any(isinstance(item, ProjectNotification) and item.recipientUserId == 22 for item in added)
    assert any(
        isinstance(item, ProjectAuditEvent) and item.action == "invitation_created"
        for item in added
    )


@pytest.mark.asyncio
async def test_accepting_pending_invitation_creates_member_only_after_decision():
    now = datetime.now(timezone.utc)
    invitation = ProjectInvitation(
        projectId=7,
        emailNormalized="person@example.com",
        role="reviewer",
        participatesInReview=True,
        status="pending",
        invitedByUserId=1,
        expiresAt=now + timedelta(days=1),
    )
    invitation.id = 11
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[ScalarResult(invitation), ScalarResult(None)]),
        add=Mock(),
        flush=AsyncMock(),
        begin_nested=AsyncMock(
            return_value=SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
        ),
    )

    result = await decide_invitation(
        db,
        invitation_id=11,
        user=SimpleNamespace(id=22, email="Person@Example.com", name="Person"),
        decision="accept",
    )

    assert result.status == "accepted"
    assert result.acceptedAt is not None
    assert any(
        isinstance(call.args[0], ProjectMember) and call.args[0].userId == 22
        for call in db.add.call_args_list
    )


@pytest.mark.asyncio
async def test_declining_pending_invitation_never_creates_member():
    invitation = ProjectInvitation(
        projectId=7,
        emailNormalized="person@example.com",
        role="reviewer",
        participatesInReview=True,
        status="pending",
        invitedByUserId=1,
        expiresAt=datetime.now(timezone.utc) + timedelta(days=1),
    )
    invitation.id = 12
    db = SimpleNamespace(execute=AsyncMock(return_value=ScalarResult(invitation)), add=Mock(), flush=AsyncMock())

    result = await decide_invitation(
        db,
        invitation_id=12,
        user=SimpleNamespace(id=22, email="person@example.com", name="Person"),
        decision="decline",
    )

    assert result.status == "declined"
    assert result.declinedAt is not None
    assert not any(isinstance(call.args[0], ProjectMember) for call in db.add.call_args_list)


@pytest.mark.asyncio
async def test_repeated_existing_member_invite_has_no_duplicate_side_effects():
    existing_user = SimpleNamespace(id=22, email="person@example.com", name="Person")
    member = ProjectMember(
        projectId=7,
        userId=22,
        role="reviewer",
        status="active",
        participatesInReview=True,
        invitedByUserId=1,
        joinedAt=datetime.now(timezone.utc),
    )
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                ScalarResult(existing_user),
                ScalarResult(member),
                ScalarResult(member),
            ]
        ),
        add=Mock(),
        flush=AsyncMock(),
    )

    result = await invite_project_member(
        db,
        access=owner_access(),
        invited_by_user_id=1,
        email="person@example.com",
        role="reviewer",
        participates_in_review=True,
    )

    assert result is member
    assert not any(
        isinstance(call.args[0], (ProjectNotification, ProjectAuditEvent))
        for call in db.add.call_args_list
    )


@pytest.mark.asyncio
async def test_unknown_user_invite_is_pending_for_seven_days_and_idempotent():
    invitation = ProjectInvitation(
        projectId=7,
        emailNormalized="person@example.com",
        role="reviewer",
        participatesInReview=True,
        status="pending",
        invitedByUserId=1,
        expiresAt=datetime.now(timezone.utc) + timedelta(days=1),
    )
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[ScalarResult(None), ScalarResult(invitation)]),
        add=Mock(),
        flush=AsyncMock(),
    )

    result = await invite_project_member(
        db,
        access=owner_access(),
        invited_by_user_id=1,
        email="person@example.com",
        role="coordinator",
        participates_in_review=False,
    )

    assert result is invitation
    assert result.role == "coordinator"
    assert result.expiresAt > datetime.now(timezone.utc) + timedelta(days=6)
    assert not any(isinstance(call.args[0], ProjectInvitation) for call in db.add.call_args_list)
    audit = next(
        call.args[0]
        for call in db.add.call_args_list
        if isinstance(call.args[0], ProjectAuditEvent)
    )
    assert audit.action == "invitation_updated"
    assert audit.entityId == invitation.id
    assert audit.payload == {
        "role": "coordinator",
        "participatesInReview": False,
    }


@pytest.mark.asyncio
async def test_unknown_user_invite_records_creation_audit():
    savepoint = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[ScalarResult(None), ScalarResult(None)]),
        add=Mock(),
        flush=AsyncMock(),
        begin_nested=AsyncMock(return_value=savepoint),
    )

    invitation = await invite_project_member(
        db,
        access=owner_access(),
        invited_by_user_id=1,
        email="new@example.com",
        role="reviewer",
        participates_in_review=True,
    )

    added = [call.args[0] for call in db.add.call_args_list]
    assert invitation in added
    audit = next(item for item in added if isinstance(item, ProjectAuditEvent))
    assert audit.action == "invitation_created"
    assert audit.payload == {"role": "reviewer", "participatesInReview": True}
    savepoint.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_concurrent_pending_invite_reloads_the_winning_row():
    concurrent = ProjectInvitation(
        projectId=7,
        emailNormalized="new@example.com",
        role="reviewer",
        participatesInReview=True,
        status="pending",
        invitedByUserId=9,
        expiresAt=datetime.now(timezone.utc) + timedelta(days=1),
    )
    concurrent.id = 42
    savepoint = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
    duplicate = IntegrityError("insert", {}, Exception("duplicate pending invite"))
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                ScalarResult(None),
                ScalarResult(None),
                ScalarResult(concurrent),
            ]
        ),
        add=Mock(),
        flush=AsyncMock(side_effect=[duplicate, None]),
        begin_nested=AsyncMock(return_value=savepoint),
    )

    result = await invite_project_member(
        db,
        access=owner_access(),
        invited_by_user_id=1,
        email="new@example.com",
        role="coordinator",
        participates_in_review=False,
    )

    assert result is concurrent
    assert result.role == "coordinator"
    assert result.participatesInReview is False
    savepoint.rollback.assert_awaited_once()
    audit = next(
        call.args[0]
        for call in db.add.call_args_list
        if isinstance(call.args[0], ProjectAuditEvent)
    )
    assert audit.action == "invitation_updated"


@pytest.mark.asyncio
async def test_concurrent_identical_pending_invite_has_no_duplicate_audit():
    concurrent = ProjectInvitation(
        projectId=7,
        emailNormalized="new@example.com",
        role="reviewer",
        participatesInReview=True,
        status="pending",
        invitedByUserId=9,
        expiresAt=datetime.now(timezone.utc) + timedelta(days=1),
    )
    concurrent.id = 42
    savepoint = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
    duplicate = IntegrityError("insert", {}, Exception("duplicate pending invite"))
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[ScalarResult(None), ScalarResult(None), ScalarResult(concurrent)]
        ),
        add=Mock(),
        flush=AsyncMock(side_effect=[duplicate, None]),
        begin_nested=AsyncMock(return_value=savepoint),
    )

    result = await invite_project_member(
        db,
        access=owner_access(),
        invited_by_user_id=1,
        email="new@example.com",
        role="reviewer",
        participates_in_review=True,
    )

    assert result is concurrent
    assert not any(
        isinstance(call.args[0], ProjectAuditEvent) for call in db.add.call_args_list
    )
