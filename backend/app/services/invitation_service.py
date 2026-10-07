from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collaboration import (
    ProjectAuditEvent,
    ProjectInvitation,
    ProjectMember,
)
from app.models.user import User
from app.services.notification_service import create_notification
from app.services.project_access_service import CAP_MANAGE_MEMBERS, ProjectAccess, require_capability


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_audit_event(
    db: AsyncSession,
    *,
    project_id: int,
    actor_user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    reason: str | None = None,
    payload: dict | None = None,
) -> ProjectAuditEvent:
    event = ProjectAuditEvent(
        projectId=project_id,
        actorUserId=actor_user_id,
        action=action,
        entityType=entity_type,
        entityId=entity_id,
        reason=reason,
        payload=payload or {},
    )
    db.add(event)
    return event


async def invite_project_member(
    db: AsyncSession,
    *,
    access: ProjectAccess,
    invited_by_user_id: int,
    email: str,
    role: str,
    participates_in_review: bool,
) -> ProjectMember | ProjectInvitation:
    require_capability(access, CAP_MANAGE_MEMBERS)
    normalized = normalize_email(email)
    user_result = await db.execute(
        select(User).where(func.lower(func.trim(User.email)) == normalized)
    )
    user = user_result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if user is not None:
        member_result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.projectId == access.project.id,
                ProjectMember.userId == user.id,
            )
        )
        member = member_result.scalar_one_or_none()
        if member is None:
            member = ProjectMember(
                projectId=access.project.id,
                userId=user.id,
                role=role,
                status="active",
                participatesInReview=True if role == "reviewer" else participates_in_review,
                invitedByUserId=invited_by_user_id,
                joinedAt=now,
            )
            db.add(member)
        else:
            member.role = role
            member.status = "active"
            member.participatesInReview = True if role == "reviewer" else participates_in_review
            member.deactivatedAt = None
        create_notification(
            db,
            project_id=access.project.id,
            recipient_user_id=user.id,
            type="project_joined",
            title="Você entrou em um projeto",
            body=f'Você agora participa de "{access.project.title if hasattr(access.project, "title") else "Projeto"}".',
            entity_type="project",
            entity_id=access.project.id,
        )
        create_audit_event(
            db,
            project_id=access.project.id,
            actor_user_id=invited_by_user_id,
            action="member_added",
            entity_type="member",
            entity_id=user.id,
            payload={"role": role},
        )
        await db.flush()
        return member

    pending_result = await db.execute(
        select(ProjectInvitation).where(
            ProjectInvitation.projectId == access.project.id,
            ProjectInvitation.emailNormalized == normalized,
            ProjectInvitation.status == "pending",
        )
    )
    invitation = pending_result.scalar_one_or_none()
    if invitation is None:
        invitation = ProjectInvitation(
            projectId=access.project.id,
            emailNormalized=normalized,
            role=role,
            participatesInReview=True if role == "reviewer" else participates_in_review,
            status="pending",
            invitedByUserId=invited_by_user_id,
            expiresAt=now + timedelta(days=7),
        )
        db.add(invitation)
    else:
        invitation.role = role
        invitation.participatesInReview = True if role == "reviewer" else participates_in_review
        invitation.expiresAt = now + timedelta(days=7)
    await db.flush()
    return invitation


async def claim_pending_invitations(
    db: AsyncSession,
    *,
    user: User,
    now: datetime | None = None,
) -> list[ProjectMember]:
    current = now or datetime.now(timezone.utc)
    email = normalize_email(user.email)
    expired_result = await db.execute(
        select(ProjectInvitation).where(
            ProjectInvitation.emailNormalized == email,
            ProjectInvitation.status == "pending",
            ProjectInvitation.expiresAt <= current,
        )
    )
    for invitation in expired_result.scalars().all():
        invitation.status = "expired"

    pending_result = await db.execute(
        select(ProjectInvitation).where(
            ProjectInvitation.emailNormalized == email,
            ProjectInvitation.status == "pending",
            ProjectInvitation.expiresAt > current,
        )
    )
    memberships = []
    for invitation in pending_result.scalars().all():
        member_result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.projectId == invitation.projectId,
                ProjectMember.userId == user.id,
            )
        )
        member = member_result.scalar_one_or_none()
        if member is None:
            member = ProjectMember(
                projectId=invitation.projectId,
                userId=user.id,
                role=invitation.role,
                status="active",
                participatesInReview=True if invitation.role == "reviewer" else invitation.participatesInReview,
                invitedByUserId=invitation.invitedByUserId,
                joinedAt=current,
            )
            db.add(member)
        else:
            member.role = invitation.role
            member.status = "active"
            member.participatesInReview = True if invitation.role == "reviewer" else invitation.participatesInReview
            member.deactivatedAt = None
        invitation.status = "accepted"
        invitation.acceptedAt = current
        memberships.append(member)
        create_notification(
            db,
            project_id=invitation.projectId,
            recipient_user_id=user.id,
            type="invitation_accepted",
            title="Projeto adicionado",
            body="Seu convite foi associado à sua conta.",
            entity_type="project",
            entity_id=invitation.projectId,
        )
        if invitation.invitedByUserId:
            create_notification(
                db,
                project_id=invitation.projectId,
                recipient_user_id=invitation.invitedByUserId,
                type="member_joined",
                title="Convite aceito",
                body=f"{user.name} entrou no projeto.",
                entity_type="member",
                entity_id=user.id,
            )
    await db.flush()
    return memberships
