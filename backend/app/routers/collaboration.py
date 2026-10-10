from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.collaboration import ProjectInvitation, ProjectMember, ReviewAssignment, ReviewConflict, ReviewDecision
from app.models.user import User
from app.schemas.collaboration import (
    InvitationCreate,
    InvitationResponse,
    InvitationSubmissionResponse,
    InvitationUpdate,
    MemberResponse,
    MemberUpdate,
    OwnershipTransferRequest,
    TeamResponse,
    AssignmentResponse,
    DistributionPreviewResponse,
    DistributionRequest,
    AdaptationRequest,
    AdaptationPreviewResponse,
    ReassignmentRequest,
    ConflictResolutionRequest,
    ConflictResponse,
    ReopenReviewRequest,
)
from app.services.invitation_service import create_audit_event, invite_project_member
from app.services.notification_service import notify_member_administration
from app.services.project_access_service import (
    CAP_MANAGE_MEMBERS,
    CAP_MANAGE_DISTRIBUTION,
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
from app.services.review_decision_service import (
    reopen_review as reopen_assigned_review,
    resolve_conflict,
    visible_decision_payloads,
)
from app.services.review_adaptation_service import preview_adaptation, adapt_reviews
from app.services.team_lock_service import lock_project_team


router = APIRouter()


def _member_state(member: ProjectMember, *, participates_in_review: bool | None = None) -> dict:
    return {
        "role": member.role,
        "participatesInReview": (
            member.participatesInReview
            if participates_in_review is None
            else participates_in_review
        ),
        "status": member.status,
    }


def _member_change_type(previous: dict, new: dict) -> tuple[str, str]:
    role_changed = previous["role"] != new["role"]
    participation_changed = previous["participatesInReview"] != new["participatesInReview"]
    if role_changed and participation_changed:
        return (
            "role_and_review_participation_changed",
            "Papel e participação em revisões alterados administrativamente.",
        )
    if role_changed:
        return "role_changed", "Papel do membro alterado administrativamente."
    return (
        "review_participation_changed",
        "Participação em revisões desativada administrativamente."
        if not new["participatesInReview"]
        else "Participação em revisões ativada administrativamente.",
    )


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


@router.post("/{projectId}/invitations", response_model=InvitationSubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(projectId: int, data: InvitationCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    await invite_project_member(
        db,
        access=access,
        invited_by_user_id=current_user.id,
        email=str(data.email),
        role=data.role,
        participates_in_review=data.participatesInReview,
    )
    await db.commit()
    return InvitationSubmissionResponse()


@router.patch("/{projectId}/invitations/{invitationId}", response_model=InvitationResponse)
async def update_invitation(projectId: int, invitationId: int, data: InvitationUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_MANAGE_MEMBERS)
    result = await db.execute(select(ProjectInvitation).where(ProjectInvitation.id == invitationId, ProjectInvitation.projectId == projectId))
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise _not_found("invitation")
    values = data.model_dump(exclude_unset=True)
    reason = values.pop("reason", None)
    for key, value in values.items():
        setattr(invitation, key, value)
    if invitation.role == "reviewer":
        invitation.participatesInReview = True
    create_audit_event(
        db,
        project_id=projectId,
        actor_user_id=current_user.id,
        action="invitation_updated",
        entity_type="invitation",
        entity_id=invitation.id,
        reason=reason,
        payload={
            "role": invitation.role,
            "participatesInReview": invitation.participatesInReview,
        },
    )
    await db.commit()
    await db.refresh(invitation)
    return invitation


@router.delete("/{projectId}/invitations/{invitationId}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(projectId: int, invitationId: int, reason: str | None = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_MANAGE_MEMBERS)
    result = await db.execute(select(ProjectInvitation).where(ProjectInvitation.id == invitationId, ProjectInvitation.projectId == projectId))
    invitation = result.scalar_one_or_none()
    if invitation is None:
        raise _not_found("invitation")
    invitation.status = "cancelled"
    create_audit_event(
        db,
        project_id=projectId,
        actor_user_id=current_user.id,
        action="invitation_cancelled",
        entity_type="invitation",
        entity_id=invitation.id,
        reason=reason.strip() if reason and reason.strip() else None,
        payload={"emailNormalized": invitation.emailNormalized},
    )
    await db.commit()


@router.patch("/{projectId}/members/{memberId}", response_model=MemberResponse)
async def update_member(projectId: int, memberId: int, data: MemberUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_MANAGE_MEMBERS)
    await lock_project_team(db, projectId)
    result = await db.execute(select(ProjectMember).where(ProjectMember.id == memberId, ProjectMember.projectId == projectId, ProjectMember.status == "active"))
    member = result.scalar_one_or_none()
    if member is None:
        raise _not_found("member")
    previous = _member_state(member)
    values = data.model_dump(exclude_unset=True)
    for key, value in values.items():
        setattr(member, key, value)
    if member.role == "reviewer":
        member.participatesInReview = True
    new = _member_state(member)
    if previous != new:
        was_eligible = previous["role"] == "reviewer" or previous["participatesInReview"]
        is_eligible = new["role"] == "reviewer" or new["participatesInReview"]
        reassignment_count = (
            await mark_reviewer_unavailable(
                db, project_id=projectId, reviewer_user_id=member.userId
            )
            if was_eligible and not is_eligible
            else 0
        )
        change_type, reason = _member_change_type(previous, new)
        payload = {
            "previous": previous,
            "new": new,
            "assignmentsMarkedForReassignment": reassignment_count,
        }
        create_audit_event(
            db,
            project_id=projectId,
            actor_user_id=current_user.id,
            action="member_updated",
            entity_type="member",
            entity_id=member.userId,
            reason=reason,
            payload=payload,
        )
        await notify_member_administration(
            db,
            project_id=projectId,
            owner_user_id=access.project.ownerId,
            actor_user_id=current_user.id,
            affected_user_id=member.userId,
            change_type=change_type,
            previous=previous,
            new=new,
            assignments_marked_for_reassignment=reassignment_count,
        )
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{projectId}/members/{memberId}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(projectId: int, memberId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_MANAGE_MEMBERS)
    await lock_project_team(db, projectId)
    result = await db.execute(select(ProjectMember).where(ProjectMember.id == memberId, ProjectMember.projectId == projectId, ProjectMember.status == "active"))
    member = result.scalar_one_or_none()
    if member is None:
        raise _not_found("member")
    previous = _member_state(member)
    member.status = "inactive"
    member.deactivatedAt = datetime.now(timezone.utc)
    reassignment_count = await mark_reviewer_unavailable(
        db, project_id=projectId, reviewer_user_id=member.userId
    )
    new = _member_state(member)
    payload = {
        "previous": previous,
        "new": new,
        "assignmentsMarkedForReassignment": reassignment_count,
    }
    create_audit_event(
        db,
        project_id=projectId,
        actor_user_id=current_user.id,
        action="member_removed",
        entity_type="member",
        entity_id=member.userId,
        reason="Membro removido administrativamente do projeto.",
        payload=payload,
    )
    await notify_member_administration(
        db,
        project_id=projectId,
        owner_user_id=access.project.ownerId,
        actor_user_id=current_user.id,
        affected_user_id=member.userId,
        change_type="member_removed",
        previous=previous,
        new=new,
        assignments_marked_for_reassignment=reassignment_count,
    )
    await db.commit()


@router.post("/{projectId}/transfer-ownership", response_model=TeamResponse)
async def transfer_ownership(projectId: int, data: OwnershipTransferRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_TRANSFER_OWNERSHIP)
    await lock_project_team(db, projectId)
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


@router.post("/{projectId}/assignments/adapt/preview", response_model=AdaptationPreviewResponse)
async def preview_team_adaptation(projectId: int, data: DistributionRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    return await preview_adaptation(db, access=access, phase=data.phase)


@router.post("/{projectId}/assignments/adapt", response_model=AdaptationPreviewResponse)
async def adapt_team_assignments(projectId: int, data: AdaptationRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    response, changed_articles = await adapt_reviews(db, access=access, phase=data.phase, fingerprint=data.fingerprint, actor_user_id=current_user.id)
    await db.commit()
    # Reuse the same best-effort index synchronization as manual review decisions.
    from app.routers.articles import _sync_article_indexes
    for article in changed_articles:
        await _sync_article_indexes(article, db)
    return response


@router.get("/{projectId}/assignments", response_model=list[AssignmentResponse])
async def project_assignments(projectId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_MANAGE_DISTRIBUTION)
    result = await db.execute(
        select(ReviewAssignment).where(
            ReviewAssignment.projectId == projectId,
            ReviewAssignment.status != "cancelled",
        ).order_by(ReviewAssignment.assignedAt.desc(), ReviewAssignment.id.desc())
    )
    return result.scalars().all()


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


@router.get("/{projectId}/conflicts", response_model=list[ConflictResponse])
async def get_conflicts(projectId: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, "resolve_conflicts")
    result = await db.execute(select(ReviewConflict).where(ReviewConflict.projectId == projectId).order_by(ReviewConflict.createdAt.desc()))
    conflicts = result.scalars().all()
    responses = []
    for conflict in conflicts:
        decisions_result = await db.execute(select(ReviewDecision).where(ReviewDecision.id.in_(conflict.decisionIds)))
        decisions = visible_decision_payloads(decisions_result.scalars().all(), current_user_id=current_user.id, complete=True)
        response = ConflictResponse.model_validate(conflict)
        response.decisions = decisions
        responses.append(response)
    return responses


@router.post("/{projectId}/conflicts/{conflictId}/resolve", response_model=ConflictResponse)
async def resolve_review_conflict(projectId: int, conflictId: int, data: ConflictResolutionRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    conflict = await resolve_conflict(db, access=access, conflict_id=conflictId, decision_value=data.decision, reason=data.reason, resolved_by_user_id=current_user.id)
    await db.commit()
    await db.refresh(conflict)
    return conflict


@router.post("/{projectId}/artigos/{articleId}/reopen-review")
async def reopen_article_review(projectId: int, articleId: int, data: ReopenReviewRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    article = await reopen_assigned_review(db, access=access, article_id=articleId, phase=data.phase, reason=data.reason, actor_user_id=current_user.id)
    await db.commit()
    return {"success": True, "articleId": article.id, "phase": data.phase}
