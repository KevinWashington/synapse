from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
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


async def _activate_member(
    db: AsyncSession,
    *,
    project_id: int,
    user_id: int,
    role: str,
    participates_in_review: bool,
    invited_by_user_id: int | None,
    joined_at: datetime,
) -> tuple[ProjectMember, bool, bool]:
    member_result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.projectId == project_id,
            ProjectMember.userId == user_id,
        )
    )
    member = member_result.scalar_one_or_none()
    created = member is None
    changed = created
    if member is None:
        savepoint = await db.begin_nested()
        member = ProjectMember(
            projectId=project_id,
            userId=user_id,
            role=role,
            status="active",
            participatesInReview=True if role == "reviewer" else participates_in_review,
            invitedByUserId=invited_by_user_id,
            joinedAt=joined_at,
        )
        db.add(member)
        try:
            await db.flush()
            await savepoint.commit()
        except IntegrityError:
            await savepoint.rollback()
            concurrent_result = await db.execute(
                select(ProjectMember).where(
                    ProjectMember.projectId == project_id,
                    ProjectMember.userId == user_id,
                )
            )
            member = concurrent_result.scalar_one()
            created = False

    changed = changed or any(
        (
            member.role != role,
            member.status != "active",
            member.participatesInReview
            != (True if role == "reviewer" else participates_in_review),
            member.deactivatedAt is not None,
        )
    )

    member.role = role
    member.status = "active"
    member.participatesInReview = True if role == "reviewer" else participates_in_review
    member.deactivatedAt = None
    return member, created, changed


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
        member, created, changed = await _activate_member(
            db,
            project_id=access.project.id,
            user_id=user.id,
            role=role,
            participates_in_review=participates_in_review,
            invited_by_user_id=invited_by_user_id,
            joined_at=now,
        )
        if changed:
            create_notification(
                db,
                project_id=access.project.id,
                recipient_user_id=user.id,
                type="project_joined" if created else "member_updated",
                title=(
                    "Você entrou em um projeto"
                    if created
                    else "Sua participação foi atualizada"
                ),
                body=(
                    f'Você agora participa de "{access.project.title if hasattr(access.project, "title") else "Projeto"}".'
                    if created
                    else "Seu papel ou sua participação na revisão foi atualizado."
                ),
                entity_type="project",
                entity_id=access.project.id,
            )
            create_audit_event(
                db,
                project_id=access.project.id,
                actor_user_id=invited_by_user_id,
                action="member_added" if created else "member_updated",
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
    created = invitation is None
    if invitation is None:
        savepoint = await db.begin_nested()
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
        try:
            await db.flush()
            await savepoint.commit()
        except IntegrityError:
            await savepoint.rollback()
            concurrent_result = await db.execute(
                select(ProjectInvitation).where(
                    ProjectInvitation.projectId == access.project.id,
                    ProjectInvitation.emailNormalized == normalized,
                    ProjectInvitation.status == "pending",
                )
            )
            invitation = concurrent_result.scalar_one()
            created = False
            invitation.role = role
            invitation.participatesInReview = True if role == "reviewer" else participates_in_review
            invitation.expiresAt = now + timedelta(days=7)
    else:
        invitation.role = role
        invitation.participatesInReview = True if role == "reviewer" else participates_in_review
        invitation.expiresAt = now + timedelta(days=7)
    await db.flush()
    create_audit_event(
        db,
        project_id=access.project.id,
        actor_user_id=invited_by_user_id,
        action="invitation_created" if created else "invitation_updated",
        entity_type="invitation",
        entity_id=invitation.id,
        payload={
            "role": role,
            "participatesInReview": invitation.participatesInReview,
        },
    )
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
        ).with_for_update()
    )
    memberships = []
    for invitation in pending_result.scalars().all():
        member, _, _ = await _activate_member(
            db,
            project_id=invitation.projectId,
            user_id=user.id,
            role=invitation.role,
            participates_in_review=invitation.participatesInReview,
            invited_by_user_id=invitation.invitedByUserId,
            joined_at=current,
        )
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
        create_audit_event(
            db,
            project_id=invitation.projectId,
            actor_user_id=user.id,
            action="invitation_accepted",
            entity_type="invitation",
            entity_id=invitation.id,
            payload={"memberUserId": user.id, "role": invitation.role},
        )
    await db.flush()
    return memberships
