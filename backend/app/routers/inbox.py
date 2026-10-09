from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.collaboration import (
    InvitationDecisionResponse,
    UserInvitationResponse,
)
from app.services.invitation_service import (
    InvitationDecisionError,
    decide_invitation,
    list_pending_invitations,
)


router = APIRouter()


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
