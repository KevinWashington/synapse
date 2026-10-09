from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.collaboration import ProjectMember, ReviewAssignment
from app.services.invitation_service import create_audit_event
from app.services.notification_service import create_notification
from app.services.project_access_service import CAP_MANAGE_DISTRIBUTION, ProjectAccess, require_capability


ReviewPhase = Literal["screening", "eligibility"]

_DISTRIBUTION_LOCK_KEYS: dict[ReviewPhase, int] = {
    "screening": -1_001,
    "eligibility": -1_002,
}


@dataclass(frozen=True)
class AssignmentPlanItem:
    article_id: int
    reviewer_user_id: int
    slot: int


@dataclass(frozen=True)
class DistributionPreview:
    phase: ReviewPhase
    article_count: int
    reviewer_count: int
    assignments: tuple[AssignmentPlanItem, ...]
    loads: dict[int, int]


def build_balanced_plan(
    article_ids: list[int], reviewer_ids: list[int], pending_loads: dict[int, int]
) -> list[AssignmentPlanItem]:
    reviewers = sorted(set(reviewer_ids))
    if not reviewers:
        raise ValueError("É necessário ao menos um revisor elegível.")
    loads = {reviewer_id: pending_loads.get(reviewer_id, 0) for reviewer_id in reviewers}
    slots_per_article = 1 if len(reviewers) == 1 else 2
    plan = []
    for article_id in sorted(article_ids):
        chosen = sorted(reviewers, key=lambda reviewer_id: (loads[reviewer_id], reviewer_id))[:slots_per_article]
        for slot, reviewer_id in enumerate(chosen, start=1):
            plan.append(AssignmentPlanItem(article_id, reviewer_id, slot))
            loads[reviewer_id] += 1
    return plan


async def _eligible_reviewer_ids(db: AsyncSession, access: ProjectAccess) -> list[int]:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.projectId == access.project.id,
            ProjectMember.status == "active",
        )
    )
    reviewer_ids = [access.project.ownerId]
    reviewer_ids.extend(
        member.userId
        for member in result.scalars().all()
        if member.role == "reviewer" or member.participatesInReview
    )
    return sorted(set(reviewer_ids))


async def preview_distribution(
    db: AsyncSession,
    *,
    access: ProjectAccess,
    phase: ReviewPhase,
) -> DistributionPreview:
    require_capability(access, CAP_MANAGE_DISTRIBUTION)
    reviewers = await _eligible_reviewer_ids(db, access)
    assigned_result = await db.execute(
        select(ReviewAssignment.articleId).where(
            ReviewAssignment.projectId == access.project.id,
            ReviewAssignment.phase == phase,
            ReviewAssignment.status != "cancelled",
        )
    )
    assigned_ids = set(assigned_result.scalars().all())
    articles_result = await db.execute(
        select(Article.id).where(
            Article.projectId == access.project.id,
            Article.currentPhase == phase,
            Article.reviewOutcome == "active",
        )
    )
    article_ids = [article_id for article_id in articles_result.scalars().all() if article_id not in assigned_ids]
    loads_result = await db.execute(
        select(ReviewAssignment.reviewerUserId, func.count(ReviewAssignment.id))
        .where(
            ReviewAssignment.projectId == access.project.id,
            ReviewAssignment.phase == phase,
            ReviewAssignment.status == "pending",
        )
        .group_by(ReviewAssignment.reviewerUserId)
    )
    pending_loads = {reviewer_id: count for reviewer_id, count in loads_result.all()}
    plan = build_balanced_plan(article_ids, reviewers, pending_loads) if article_ids else []
    resulting_loads = Counter(pending_loads)
    for item in plan:
        resulting_loads[item.reviewer_user_id] += 1
    return DistributionPreview(phase, len(article_ids), len(reviewers), tuple(plan), dict(resulting_loads))


async def distribute_reviews(
    db: AsyncSession,
    *,
    access: ProjectAccess,
    phase: ReviewPhase,
    assigned_by_user_id: int,
) -> DistributionPreview:
    require_capability(access, CAP_MANAGE_DISTRIBUTION)
    await db.execute(
        select(
            func.pg_advisory_xact_lock(
                access.project.id,
                _DISTRIBUTION_LOCK_KEYS[phase],
            )
        )
    )
    preview = await preview_distribution(db, access=access, phase=phase)
    counts = Counter()
    for item in preview.assignments:
        db.add(
            ReviewAssignment(
                projectId=access.project.id,
                articleId=item.article_id,
                phase=phase,
                reviewerUserId=item.reviewer_user_id,
                slot=item.slot,
                status="pending",
                assignedByUserId=assigned_by_user_id,
            )
        )
        counts[item.reviewer_user_id] += 1
    for reviewer_id, count in counts.items():
        create_notification(
            db,
            project_id=access.project.id,
            recipient_user_id=reviewer_id,
            type="reviews_assigned",
            title="Novas revisões atribuídas",
            body=f"{count} artigo(s) foram atribuídos a você na etapa de {phase}.",
            entity_type="assignment_batch",
            payload={"phase": phase, "count": count},
        )
    if preview.assignments:
        create_audit_event(
            db,
            project_id=access.project.id,
            actor_user_id=assigned_by_user_id,
            action="reviews_distributed",
            entity_type="assignment_batch",
            payload={"phase": phase, "articles": preview.article_count, "assignments": len(preview.assignments)},
        )
    await db.flush()
    return preview


async def reassign_review(
    db: AsyncSession,
    *,
    access: ProjectAccess,
    assignment_id: int,
    reviewer_user_id: int,
    assigned_by_user_id: int,
) -> ReviewAssignment:
    require_capability(access, CAP_MANAGE_DISTRIBUTION)
    result = await db.execute(
        select(ReviewAssignment).where(
            ReviewAssignment.id == assignment_id,
            ReviewAssignment.projectId == access.project.id,
            ReviewAssignment.status.in_(("pending", "needs_reassignment")),
        )
    )
    previous = result.scalar_one_or_none()
    if previous is None:
        raise HTTPException(status_code=404, detail={"code": "ASSIGNMENT_NOT_FOUND", "message": "Atribuição não encontrada."})
    eligible = await _eligible_reviewer_ids(db, access)
    if reviewer_user_id not in eligible:
        raise HTTPException(status_code=422, detail={"code": "REVIEWER_NOT_ELIGIBLE", "message": "Revisor não elegível."})
    duplicate_result = await db.execute(
        select(ReviewAssignment).where(
            ReviewAssignment.articleId == previous.articleId,
            ReviewAssignment.phase == previous.phase,
            ReviewAssignment.reviewerUserId == reviewer_user_id,
            ReviewAssignment.status != "cancelled",
        )
    )
    if duplicate_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail={"code": "REVIEWER_ALREADY_ASSIGNED", "message": "Revisor já atribuído."})
    previous.status = "cancelled"
    previous.cancelledAt = datetime.now(timezone.utc)
    replacement = ReviewAssignment(
        projectId=previous.projectId,
        articleId=previous.articleId,
        phase=previous.phase,
        reviewerUserId=reviewer_user_id,
        slot=previous.slot,
        status="pending",
        assignedByUserId=assigned_by_user_id,
        inheritedFromAssignmentId=previous.inheritedFromAssignmentId,
    )
    db.add(replacement)
    await db.flush()
    create_notification(
        db,
        project_id=previous.projectId,
        recipient_user_id=reviewer_user_id,
        type="review_reassigned",
        title="Revisão reatribuída",
        body=f"Um artigo foi reatribuído a você na etapa de {previous.phase}.",
        entity_type="article",
        entity_id=previous.articleId,
        payload={"phase": previous.phase, "assignmentId": replacement.id},
    )
    create_audit_event(
        db,
        project_id=previous.projectId,
        actor_user_id=assigned_by_user_id,
        action="review_reassigned",
        entity_type="assignment",
        entity_id=replacement.id,
        payload={
            "articleId": previous.articleId,
            "phase": previous.phase,
            "previousReviewerUserId": previous.reviewerUserId,
            "reviewerUserId": reviewer_user_id,
        },
    )
    return replacement


async def mark_reviewer_unavailable(
    db: AsyncSession, *, project_id: int, reviewer_user_id: int
) -> int:
    result = await db.execute(
        select(ReviewAssignment).where(
            ReviewAssignment.projectId == project_id,
            ReviewAssignment.reviewerUserId == reviewer_user_id,
            ReviewAssignment.status == "pending",
        )
    )
    changed = 0
    for assignment in result.scalars().all():
        if assignment.status != "pending":
            continue
        assignment.status = "needs_reassignment"
        changed += 1
    return changed
