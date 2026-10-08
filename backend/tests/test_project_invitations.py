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
    claim_pending_invitations,
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


def owner_access():
    return SimpleNamespace(
        project=SimpleNamespace(id=7, ownerId=1),
        role="owner",
        capabilities=frozenset({"manage_members"}),
    )


def test_normalize_email_strips_and_lowercases():
    assert normalize_email("  Person@Example.COM ") == "person@example.com"


@pytest.mark.asyncio
async def test_existing_user_invite_creates_active_member_and_notification():
    existing_user = SimpleNamespace(id=22, email="person@example.com", name="Person")
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[ScalarResult(existing_user), ScalarResult(None)]),
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

    assert isinstance(result, ProjectMember)
    added = [call.args[0] for call in db.add.call_args_list]
    assert any(isinstance(item, ProjectMember) and item.userId == 22 for item in added)
    assert any(isinstance(item, ProjectNotification) and item.recipientUserId == 22 for item in added)
    assert any(
        isinstance(item, ProjectAuditEvent) and item.action == "member_added"
        for item in added
    )


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
            side_effect=[ScalarResult(existing_user), ScalarResult(member)]
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
async def test_concurrent_existing_member_invite_reloads_without_duplicate_side_effects():
    existing_user = SimpleNamespace(id=22, email="person@example.com", name="Person")
    concurrent_member = ProjectMember(
        projectId=7,
        userId=22,
        role="reviewer",
        status="active",
        participatesInReview=True,
        invitedByUserId=1,
        joinedAt=datetime.now(timezone.utc),
    )
    savepoint = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
    duplicate = IntegrityError("insert", {}, Exception("duplicate member"))
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                ScalarResult(existing_user),
                ScalarResult(None),
                ScalarResult(concurrent_member),
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
        email="person@example.com",
        role="reviewer",
        participates_in_review=True,
    )

    assert result is concurrent_member
    savepoint.rollback.assert_awaited_once()
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
async def test_claim_pending_invitation_expires_stale_and_is_idempotent():
    now = datetime.now(timezone.utc)
    expired = ProjectInvitation(projectId=8, emailNormalized="person@example.com", role="reviewer", participatesInReview=True, status="pending", invitedByUserId=1, expiresAt=now - timedelta(seconds=1))
    pending = ProjectInvitation(projectId=7, emailNormalized="person@example.com", role="reviewer", participatesInReview=True, status="pending", invitedByUserId=1, expiresAt=now + timedelta(days=1))
    pending.id = 10
    savepoint = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
    db = SimpleNamespace(
        execute=AsyncMock(
            side_effect=[
                ScalarResult(values=[expired]),
                ScalarResult(values=[pending]),
                ScalarResult(None),
            ]
        ),
        add=Mock(),
        flush=AsyncMock(),
        begin_nested=AsyncMock(return_value=savepoint),
    )
    user = SimpleNamespace(id=22, email="Person@Example.com", name="Person")

    memberships = await claim_pending_invitations(db, user=user, now=now)

    assert expired.status == "expired"
    assert pending.status == "accepted"
    assert len(memberships) == 1
    assert memberships[0].projectId == 7
    assert memberships[0].userId == 22
    audit = next(
        call.args[0]
        for call in db.add.call_args_list
        if isinstance(call.args[0], ProjectAuditEvent)
    )
    assert audit.action == "invitation_accepted"
    assert audit.entityId == 10


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
