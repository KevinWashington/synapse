from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.routers import inbox


@pytest.mark.asyncio
async def test_inbox_aggregates_notifications_and_pending_invitations(monkeypatch):
    notification = SimpleNamespace(
        id=12,
        projectId=7,
        recipientUserId=22,
        type="review_assigned",
        title="Nova revisao",
        body="Um estudo foi atribuido a voce.",
        entityType="article",
        entityId=42,
        payload={},
        readAt=None,
        createdAt="2026-10-09T12:00:00Z",
    )
    invitation = SimpleNamespace(
        id=3,
        projectId=9,
        role="reviewer",
        participatesInReview=True,
        expiresAt="2026-10-16T12:00:00Z",
        createdAt="2026-10-09T12:00:00Z",
    )
    monkeypatch.setattr(inbox, "list_user_notifications", AsyncMock(return_value=([(notification, "Projeto A")], 12)))
    monkeypatch.setattr(inbox, "list_pending_invitations", AsyncMock(return_value=[(invitation, "Projeto B", "Ana")]))
    monkeypatch.setattr(inbox, "unread_notification_count", AsyncMock(return_value=4))

    response = await inbox.get_inbox(
        limit=30,
        beforeId=None,
        current_user=SimpleNamespace(id=22),
        db=SimpleNamespace(),
    )

    assert response.unreadNotificationCount == 4
    assert response.pendingInvitationCount == 1
    assert response.nextNotificationCursor == 12
    assert response.notifications[0].projectTitle == "Projeto A"
    assert response.invitations[0].inviterName == "Ana"
