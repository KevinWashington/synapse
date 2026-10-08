from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collaboration import ProjectMember, ProjectNotification


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


async def list_notifications(
    db: AsyncSession,
    *,
    project_id: int,
    user_id: int,
    limit: int = 50,
    before_id: int | None = None,
):
    query = select(ProjectNotification).where(
        ProjectNotification.projectId == project_id,
        ProjectNotification.recipientUserId == user_id,
    )
    if before_id is not None:
        query = query.where(ProjectNotification.id < before_id)
    result = await db.execute(
        query.order_by(ProjectNotification.createdAt.desc(), ProjectNotification.id.desc()).limit(limit)
    )
    return result.scalars().all()


async def notify_member_administration(
    db: AsyncSession,
    *,
    project_id: int,
    owner_user_id: int,
    actor_user_id: int,
    affected_user_id: int,
    change_type: str,
    previous: dict,
    new: dict,
    assignments_marked_for_reassignment: int,
) -> None:
    """Emit one summarized member event to the affected user and project administrators."""
    coordinators_result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.projectId == project_id,
            ProjectMember.status == "active",
            ProjectMember.role == "coordinator",
        )
    )
    coordinator_ids = {
        member.userId for member in coordinators_result.scalars().all()
    }
    administrator_ids = ({owner_user_id} | coordinator_ids) - {affected_user_id}
    labels = {
        "role_changed": (
            "Seu papel no projeto foi alterado",
            "O papel de um membro foi alterado",
        ),
        "review_participation_changed": (
            "Sua participação nas revisões foi alterada",
            "A participação de um membro nas revisões foi alterada",
        ),
        "role_and_review_participation_changed": (
            "Seu papel e sua participação foram alterados",
            "O papel e a participação de um membro foram alterados",
        ),
        "member_removed": (
            "Você foi removido do projeto",
            "Um membro foi removido do projeto",
        ),
    }
    affected_title, administrator_title = labels[change_type]
    payload = {
        "previous": previous,
        "new": new,
        "assignmentsMarkedForReassignment": assignments_marked_for_reassignment,
    }
    create_notification(
        db,
        project_id=project_id,
        recipient_user_id=affected_user_id,
        type=change_type,
        title=affected_title,
        body="Consulte a equipe do projeto para ver os detalhes da alteração.",
        entity_type="member",
        entity_id=affected_user_id,
        payload=payload,
    )
    for administrator_id in sorted(administrator_ids):
        if administrator_id != actor_user_id:
            create_notification(
                db,
                project_id=project_id,
                recipient_user_id=administrator_id,
                type=change_type,
                title=administrator_title,
                body="A equipe do projeto foi atualizada.",
                entity_type="member",
                entity_id=affected_user_id,
                payload=payload,
            )
        if assignments_marked_for_reassignment:
            create_notification(
                db,
                project_id=project_id,
                recipient_user_id=administrator_id,
                type="assignments_need_reassignment",
                title="Revisões aguardam redistribuição",
                body=f"{assignments_marked_for_reassignment} atribuição(ões) precisam de um novo revisor.",
                entity_type="member",
                entity_id=affected_user_id,
                payload={
                    "memberUserId": affected_user_id,
                    "count": assignments_marked_for_reassignment,
                },
            )


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
    result = await db.execute(
        select(ProjectNotification).where(
            ProjectNotification.projectId == project_id,
            ProjectNotification.recipientUserId == user_id,
        )
    )
    notifications = result.scalars().all()
    now = datetime.now(timezone.utc)
    for notification in notifications:
        if notification.readAt is None:
            notification.readAt = now
    return notifications
