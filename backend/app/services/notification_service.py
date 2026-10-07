from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collaboration import ProjectNotification


def create_notification(
    db: AsyncSession,
    *,
    project_id: int,
    recipient_user_id: int,
    type: str,
    title: str,
    body: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    payload: dict | None = None,
) -> ProjectNotification:
    notification = ProjectNotification(
        projectId=project_id,
        recipientUserId=recipient_user_id,
        type=type,
        title=title,
        body=body,
        entityType=entity_type,
        entityId=entity_id,
        payload=payload or {},
    )
    db.add(notification)
    return notification


async def list_notifications(db: AsyncSession, *, project_id: int, user_id: int):
    result = await db.execute(
        select(ProjectNotification)
        .where(
            ProjectNotification.projectId == project_id,
            ProjectNotification.recipientUserId == user_id,
        )
        .order_by(ProjectNotification.createdAt.desc())
    )
    return result.scalars().all()


async def mark_notification_read(
    db: AsyncSession, *, project_id: int, user_id: int, notification_id: int
) -> ProjectNotification | None:
    result = await db.execute(
        select(ProjectNotification).where(
            ProjectNotification.id == notification_id,
            ProjectNotification.projectId == project_id,
            ProjectNotification.recipientUserId == user_id,
        )
    )
    notification = result.scalar_one_or_none()
    if notification and notification.readAt is None:
        notification.readAt = datetime.now(timezone.utc)
    return notification


async def mark_all_notifications_read(db: AsyncSession, *, project_id: int, user_id: int):
    notifications = await list_notifications(db, project_id=project_id, user_id=user_id)
    now = datetime.now(timezone.utc)
    for notification in notifications:
        if notification.readAt is None:
            notification.readAt = now
    return notifications
