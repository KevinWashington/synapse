from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.collaboration import ProjectInvitation, ProjectMember, ReviewAssignment
from app.models.user import User
from app.schemas.collaboration import (
    InvitationCreate,
    InvitationResponse,
    InvitationUpdate,
    MemberResponse,
    MemberUpdate,
    NotificationResponse,
    OwnershipTransferRequest,
    TeamResponse,
    AssignmentResponse,
    DistributionPreviewResponse,
    DistributionRequest,
    ReassignmentRequest,
)
from app.services.invitation_service import create_audit_event, invite_project_member
from app.services.notification_service import (
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)
from app.services.project_access_service import (
    CAP_MANAGE_MEMBERS,
    CAP_TRANSFER_OWNERSHIP,
    require_capability,
    resolve_project_access,
)
from app.services.review_assignment_service import (
    distribute_reviews,
    preview_distribution,
    reassign_review,
    mark_reviewer_unavailable,
)


router = APIRouter()


def _preview_response(preview) -> DistributionPreviewResponse:
    return DistributionPreviewResponse(
        phase=preview.phase,
        articleCount=preview.article_count,
        reviewerCount=preview.reviewer_count,
        assignments=[
            {"articleId": item.article_id, "reviewerUserId": item.reviewer_user_id, "slot": item.slot}
            for item in preview.assignments
        ],
        loads=preview.loads,
    )


def _not_found(entity: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": f"{entity.upper()}_NOT_FOUND", "message": "Registro não encontrado."},
    )


def build_member_response(
    *,
    project_id: int,
    user: User,
    role: str,
    participates_in_review: bool,
    membership: ProjectMember | None,
    joined_at: datetime | None,
) -> MemberResponse:
    return MemberResponse(
        id=membership.id if membership else None,
        projectId=project_id,
        userId=user.id,
        name=user.name,
        email=user.email,
        avatar=user.avatar,
        role=role,
        status=membership.status if membership else "active",
        participatesInReview=participates_in_review,
        joinedAt=joined_at,
        deactivatedAt=membership.deactivatedAt if membership else None,
    )


@router.get("/{projectId}/members", response_model=TeamResponse)
async def get_team(projectId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    owner_result = await db.execute(select(User).where(User.id == access.project.ownerId))
    owner = owner_result.scalar_one_or_none()
    members_result = await db.execute(
        select(ProjectMember, User)
        .join(User, User.id == ProjectMember.userId)
        .where(ProjectMember.projectId == projectId, ProjectMember.status == "active")
    )
    invitations_result = await db.execute(
        select(ProjectInvitation).where(ProjectInvitation.projectId == projectId).order_by(ProjectInvitation.createdAt.desc())
    )
    members = []
    if owner is not None:
        members.append(
            build_member_response(
                project_id=projectId,
                user=owner,
                role="owner",
                participates_in_review=True,
                membership=None,
                joined_at=access.project.createdAt,
            )
        )
    members.extend(
        build_member_response(
            project_id=projectId,
            user=user,
            role=member.role,
            participates_in_review=member.participatesInReview,
            membership=member,
            joined_at=member.joinedAt,
        )
        for member, user in members_result.all()
    )
    return TeamResponse(members=members, invitations=invitations_result.scalars().all())


@router.post("/{projectId}/invitations", response_model=MemberResponse | InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(projectId: int, data: InvitationCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    result = await invite_project_member(
        db,
        access=access,
        invited_by_user_id=current_user.id,
        email=str(data.email),
        role=data.role,
        participates_in_review=data.participatesInReview,
    )
    await db.commit()
    await db.refresh(result)
    return result


@router.patch("/{projectId}/invitations/{invitationId}", response_model=InvitationResponse)
async def update_invitation(projectId: int, invitationId: int, data: InvitationUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_MANAGE_MEMBERS)
    result = await db.execute(select(ProjectInvitation).where(ProjectInvitation.id == invitationId, ProjectInvitation.projectId == projectId))
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise _not_found("invitation")
    values = data.model_dump(exclude_unset=True)
    for key, value in values.items():
        setattr(invitation, key, value)
    if invitation.role == "reviewer":
        invitation.participatesInReview = True
    await db.commit()
    await db.refresh(invitation)
    return invitation


@router.delete("/{projectId}/invitations/{invitationId}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(projectId: int, invitationId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_MANAGE_MEMBERS)
    result = await db.execute(select(ProjectInvitation).where(ProjectInvitation.id == invitationId, ProjectInvitation.projectId == projectId))
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise _not_found("invitation")
    invitation.status = "cancelled"
    await db.commit()


@router.patch("/{projectId}/members/{memberId}", response_model=MemberResponse)
async def update_member(projectId: int, memberId: int, data: MemberUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_MANAGE_MEMBERS)
    result = await db.execute(select(ProjectMember).where(ProjectMember.id == memberId, ProjectMember.projectId == projectId, ProjectMember.status == "active"))
    member = result.scalar_one_or_none()
    if member is None:
        raise _not_found("member")
    values = data.model_dump(exclude_unset=True)
    for key, value in values.items():
        setattr(member, key, value)
    if member.role == "reviewer":
        member.participatesInReview = True
    create_audit_event(db, project_id=projectId, actor_user_id=current_user.id, action="member_updated", entity_type="member", entity_id=member.userId, payload=values)
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{projectId}/members/{memberId}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(projectId: int, memberId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_MANAGE_MEMBERS)
    result = await db.execute(select(ProjectMember).where(ProjectMember.id == memberId, ProjectMember.projectId == projectId, ProjectMember.status == "active"))
    member = result.scalar_one_or_none()
    if member is None:
        raise _not_found("member")
    member.status = "inactive"
    member.deactivatedAt = datetime.now(timezone.utc)
    await mark_reviewer_unavailable(db, project_id=projectId, reviewer_user_id=member.userId)
    create_audit_event(db, project_id=projectId, actor_user_id=current_user.id, action="member_removed", entity_type="member", entity_id=member.userId)
    await db.commit()


@router.post("/{projectId}/transfer-ownership", response_model=TeamResponse)
async def transfer_ownership(projectId: int, data: OwnershipTransferRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_TRANSFER_OWNERSHIP)
    result = await db.execute(select(ProjectMember).where(ProjectMember.projectId == projectId, ProjectMember.userId == data.userId, ProjectMember.status == "active"))
    target = result.scalar_one_or_none()
    if target is None:
        raise _not_found("member")
    previous_owner_id = access.project.ownerId
    access.project.ownerId = target.userId
    target.status = "inactive"
    target.deactivatedAt = datetime.now(timezone.utc)
    previous_result = await db.execute(select(ProjectMember).where(ProjectMember.projectId == projectId, ProjectMember.userId == previous_owner_id))
    previous = previous_result.scalar_one_or_none()
    if previous is None:
        previous = ProjectMember(projectId=projectId, userId=previous_owner_id, role="coordinator", status="active", participatesInReview=True, invitedByUserId=data.userId)
        db.add(previous)
    else:
        previous.role = "coordinator"
        previous.status = "active"
        previous.participatesInReview = True
        previous.deactivatedAt = None
    create_audit_event(db, project_id=projectId, actor_user_id=current_user.id, action="ownership_transferred", entity_type="project", entity_id=projectId, payload={"newOwnerUserId": data.userId})
    await db.commit()
    return await get_team(projectId, current_user, db)


@router.get("/{projectId}/notifications", response_model=list[NotificationResponse])
async def get_notifications(projectId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    return await list_notifications(db, project_id=projectId, user_id=current_user.id)


@router.patch("/{projectId}/notifications/{notificationId}/read", response_model=NotificationResponse)
async def read_notification(projectId: int, notificationId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    notification = await mark_notification_read(db, project_id=projectId, user_id=current_user.id, notification_id=notificationId)
    if notification is None:
        raise _not_found("notification")
    await db.commit()
    await db.refresh(notification)
    return notification


@router.post("/{projectId}/notifications/read-all", response_model=list[NotificationResponse])
async def read_all_notifications(projectId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    notifications = await mark_all_notifications_read(db, project_id=projectId, user_id=current_user.id)
    await db.commit()
    return notifications


@router.post("/{projectId}/assignments/preview", response_model=DistributionPreviewResponse)
async def preview_assignments(projectId: int, data: DistributionRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    return _preview_response(await preview_distribution(db, access=access, phase=data.phase))


@router.post("/{projectId}/assignments/distribute", response_model=DistributionPreviewResponse)
async def distribute_assignments(projectId: int, data: DistributionRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    result = await distribute_reviews(db, access=access, phase=data.phase, assigned_by_user_id=current_user.id)
    await db.commit()
    return _preview_response(result)


@router.get("/{projectId}/assignments/me", response_model=list[AssignmentResponse])
async def my_assignments(projectId: int, phase: str | None = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    query = select(ReviewAssignment).where(
        ReviewAssignment.projectId == projectId,
        ReviewAssignment.reviewerUserId == current_user.id,
        ReviewAssignment.status != "cancelled",
    )
    if phase:
        query = query.where(ReviewAssignment.phase == phase)
    result = await db.execute(query.order_by(ReviewAssignment.assignedAt.desc()))
    return result.scalars().all()


@router.patch("/{projectId}/assignments/{assignmentId}", response_model=AssignmentResponse)
async def reassign_assignment(projectId: int, assignmentId: int, data: ReassignmentRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    result = await reassign_review(db, access=access, assignment_id=assignmentId, reviewer_user_id=data.reviewerUserId, assigned_by_user_id=current_user.id)
    await db.commit()
    await db.refresh(result)
    return result
