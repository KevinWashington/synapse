from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.collaboration import (
    InvitationDecisionResponse,
    InboxNotificationResponse,
    NotificationResponse,
    UserInboxResponse,
    UserInvitationResponse,
)
from app.services.notification_service import (
    list_user_notifications,
    mark_all_user_notifications_read,
    mark_user_notification_read,
    unread_notification_count,
)
from app.services.invitation_service import (
    InvitationDecisionError,
    decide_invitation,
    list_pending_invitations,
)


router = APIRouter()


def _notification_response(row) -> InboxNotificationResponse:
    notification, project_title = row
    return InboxNotificationResponse(
        id=notification.id,
        projectId=notification.projectId,
        recipientUserId=notification.recipientUserId,
        type=notification.type,
        title=notification.title,
        body=notification.body,
        entityType=notification.entityType,
        entityId=notification.entityId,
        payload=notification.payload,
        readAt=notification.readAt,
        createdAt=notification.createdAt,
        projectTitle=project_title,
    )


def _invitation_response(row) -> UserInvitationResponse:
    invitation, project_title, inviter_name = row
    return UserInvitationResponse(
        id=invitation.id,
        projectId=invitation.projectId,
        projectTitle=project_title,
        inviterName=inviter_name,
        role=invitation.role,
        participatesInReview=invitation.participatesInReview,
        expiresAt=invitation.expiresAt,
        createdAt=invitation.createdAt,
    )


@router.get("/invitations", response_model=list[UserInvitationResponse])
async def get_pending_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return [_invitation_response(row) for row in await list_pending_invitations(db, user=current_user)]


@router.get("/inbox", response_model=UserInboxResponse)
async def get_inbox(
    limit: int = Query(30, ge=1, le=100),
    beforeId: int | None = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notification_rows, next_cursor = await list_user_notifications(
        db, user_id=current_user.id, limit=limit, before_id=beforeId
    )
    invitation_rows = await list_pending_invitations(db, user=current_user)
    return UserInboxResponse(
        notifications=[_notification_response(row) for row in notification_rows],
        invitations=[_invitation_response(row) for row in invitation_rows],
        unreadNotificationCount=await unread_notification_count(db, user_id=current_user.id),
        pendingInvitationCount=len(invitation_rows),
        nextNotificationCursor=next_cursor,
    )


@router.patch("/notifications/{notificationId}/read", response_model=NotificationResponse)
async def read_notification(
    notificationId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notification = await mark_user_notification_read(
        db, user_id=current_user.id, notification_id=notificationId
    )
    if notification is None:
        raise HTTPException(status_code=404, detail={"code": "NOTIFICATION_NOT_FOUND", "message": "Registro não encontrado."})
    await db.commit()
    await db.refresh(notification)
    return notification


@router.post("/notifications/read-all", response_model=list[NotificationResponse])
async def read_all_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notifications = await mark_all_user_notifications_read(db, user_id=current_user.id)
    await db.commit()
    return notifications


async def _decide(invitation_id: int, decision: str, current_user: User, db: AsyncSession):
    try:
        invitation = await decide_invitation(
            db,
            invitation_id=invitation_id,
            user=current_user,
            decision=decision,
        )
    except InvitationDecisionError as exc:
        await db.commit()
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    await db.commit()
    await db.refresh(invitation)
    return InvitationDecisionResponse(
        id=invitation.id,
        projectId=invitation.projectId,
        status=invitation.status,
        acceptedAt=invitation.acceptedAt,
        declinedAt=invitation.declinedAt,
    )


@router.post("/invitations/{invitationId}/accept", response_model=InvitationDecisionResponse)
async def accept_invitation(
    invitationId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _decide(invitationId, "accept", current_user, db)


@router.post("/invitations/{invitationId}/decline", response_model=InvitationDecisionResponse)
async def decline_invitation(
    invitationId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _decide(invitationId, "decline", current_user, db)
