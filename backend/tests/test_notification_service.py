from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.services import notification_service


@pytest.mark.asyncio
async def test_administrative_member_change_notifies_affected_member_and_other_administrators(monkeypatch):
    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [SimpleNamespace(userId=2), SimpleNamespace(userId=3)]))
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    create = Mock()
    monkeypatch.setattr(notification_service, "create_notification", create)

    await notification_service.notify_member_administration(
        db,
        project_id=7,
        owner_user_id=1,
        actor_user_id=1,
        affected_user_id=22,
        change_type="review_participation_changed",
        previous={"role": "coordinator", "participatesInReview": True, "status": "active"},
        new={"role": "coordinator", "participatesInReview": False, "status": "active"},
        assignments_marked_for_reassignment=4,
    )

    recipients = [call.kwargs["recipient_user_id"] for call in create.call_args_list]
    assert recipients == [22, 1, 2, 2, 3, 3]
    affected = create.call_args_list[0].kwargs
    assert affected["type"] == "review_participation_changed"
    assert affected["payload"]["assignmentsMarkedForReassignment"] == 4
    assert all(call.kwargs["entity_type"] == "member" for call in create.call_args_list)
    assert [call.kwargs["type"] for call in create.call_args_list[1:]] == [
        "assignments_need_reassignment",
        "review_participation_changed",
        "assignments_need_reassignment",
        "review_participation_changed",
        "assignments_need_reassignment",
    ]


@pytest.mark.asyncio
async def test_notification_listing_is_bounded_and_supports_cursor():
    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db = SimpleNamespace(execute=AsyncMock(return_value=result))

    await notification_service.list_notifications(db, project_id=7, user_id=22, limit=25, before_id=90)

    statement = db.execute.await_args.args[0]
    compiled = statement.compile(compile_kwargs={"literal_binds": True})
    sql = str(compiled)
    assert "project_notifications.id < 90" in sql
    assert "LIMIT 25" in sql


@pytest.mark.asyncio
async def test_user_notification_cursor_continues_after_the_last_returned_row():
    rows = [(SimpleNamespace(id=value), "Project") for value in (9, 8, 7)]
    result = SimpleNamespace(all=lambda: rows)
    db = SimpleNamespace(execute=AsyncMock(return_value=result))

    page, cursor = await notification_service.list_user_notifications(
        db, user_id=22, limit=2
    )

    assert [notification.id for notification, _ in page] == [9, 8]
    assert cursor == 8


@pytest.mark.asyncio
async def test_mark_all_read_is_not_limited_by_notification_poll_page(monkeypatch):
    notifications = [SimpleNamespace(readAt=None), SimpleNamespace(readAt="already-read")]
    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: notifications))
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    list_mock = AsyncMock()
    monkeypatch.setattr(notification_service, "list_notifications", list_mock)

    changed = await notification_service.mark_all_notifications_read(db, project_id=7, user_id=22)

    list_mock.assert_not_awaited()
    assert changed == notifications
    assert all(item.readAt is not None for item in notifications)
    sql = str(db.execute.await_args.args[0].compile(compile_kwargs={"literal_binds": True}))
    assert '"readAt" IS NULL' not in sql
    assert "LIMIT" not in sql
