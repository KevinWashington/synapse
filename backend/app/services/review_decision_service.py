from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.article import Article
from app.models.collaboration import ProjectMember, ReviewAssignment, ReviewConflict, ReviewDecision
from app.services.evidence_service import apply_quality_metrics
from app.services.invitation_service import create_audit_event
from app.services.notification_service import create_notification
from app.services.project_access_service import (
    CAP_REOPEN_REVIEW,
    CAP_RESOLVE_CONFLICTS,
    ProjectAccess,
    require_capability,
)


SubmissionState = Literal["waiting_for_reviewer", "consolidated", "conflict"]


@dataclass(frozen=True)
class ReviewSubmissionResult:
    state: SubmissionState
    article: Article
    decision: ReviewDecision
    conflict: ReviewConflict | None = None


def resolution_state(decisions: list[ReviewDecision], *, assignment_count: int) -> SubmissionState:
    if len(decisions) > assignment_count:
        raise ValueError("Há mais decisões do que atribuições ativas.")
    if len(decisions) < assignment_count:
        return "waiting_for_reviewer"
    return "consolidated" if len({item.decision for item in decisions}) == 1 else "conflict"


def _decision_payload(decision: ReviewDecision) -> dict:
    return {
        "id": decision.id,
        "reviewerUserId": decision.reviewerUserId,
        "decision": decision.decision,
        "reasonText": decision.reasonText,
        "checklistAnswers": decision.checklistAnswers or {},
        "answeringRQs": decision.answeringRQs or [],
        "status": decision.status,
        "submittedAt": getattr(decision, "submittedAt", None),
    }


def visible_decision_payloads(
    decisions: list[ReviewDecision], *, current_user_id: int, complete: bool
) -> list[dict]:
    return [
        _decision_payload(decision)
        if complete or decision.reviewerUserId == current_user_id
        else {"reviewerUserId": decision.reviewerUserId, "status": decision.status}
        for decision in decisions
    ]


async def has_active_assignments(db: AsyncSession, *, article_id: int, phase: str) -> bool:
    if not get_settings().ASSIGNED_REVIEW_FLOW_ENABLED:
        return False
    result = await db.execute(
        select(ReviewAssignment.id)
        .where(
            ReviewAssignment.articleId == article_id,
            ReviewAssignment.phase == phase,
            ReviewAssignment.status != "cancelled",
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


def _validate_payload(article: Article, phase: str, payload) -> None:
    reason = (payload.reasonText or "").strip()
    if payload.decision in {"excluded", "full_text_unavailable"} and not reason:
        raise HTTPException(status_code=400, detail={"code": "REASON_REQUIRED", "message": "Informe a justificativa da decisão."})
    if phase == "eligibility" and payload.decision == "included" and article.pdfData is None and article.fullTextStatus != "uploaded":
        raise HTTPException(status_code=400, detail={"code": "PDF_REQUIRED", "message": "Faça upload do texto completo antes de incluir."})


def _apply_legacy_state(article: Article) -> None:
    if article.reviewOutcome == "included":
        article.status = "analisado"
        article.manualDecision = "incluido"
        article.manualDecisionReason = article.eligibilityReasonText
        article.decisionUpdatedAt = article.eligibilityReviewedAt or article.includedAt
        article.exclusionCriteria = []
        return
    if article.reviewOutcome in {"excluded_screening", "excluded_eligibility", "full_text_unavailable"}:
        article.status = "excluido"
        article.manualDecision = "excluido"
        article.manualDecisionReason = article.eligibilityReasonText or article.screeningReasonText
        article.decisionUpdatedAt = article.eligibilityReviewedAt or article.screeningReviewedAt or article.updatedAt
        reason = article.screeningReasonText if article.reviewOutcome == "excluded_screening" else article.eligibilityReasonText
        article.exclusionCriteria = [reason] if reason else []
        return
    article.status = "analisado" if article.currentPhase == "eligibility" else "pendente"
    article.manualDecision = None
    article.manualDecisionReason = None
    article.decisionUpdatedAt = article.eligibilityReviewedAt or article.screeningReviewedAt
    article.exclusionCriteria = []


def apply_canonical_decision(article: Article, *, phase: str, decision: ReviewDecision) -> None:
    now = datetime.now(timezone.utc)
    reason = (decision.reasonText or "").strip() or None
    if phase == "screening":
        article.currentPhase = "screening"
        article.screeningDecision = decision.decision
        article.screeningReasonText = reason
        article.screeningReviewedAt = now
        article.duplicateGroupKey = None
        article.duplicateReasonCode = None
        article.duplicateReasonText = None
        if decision.decision == "included":
            article.currentPhase = "eligibility"
            article.reviewOutcome = "active"
            article.fullTextStatus = "uploaded" if article.pdfData is not None else "pending_upload"
        else:
            article.reviewOutcome = "excluded_screening"
            article.eligibilityDecision = "excluded"
            article.answeringRQs = []
        _apply_legacy_state(article)
        return

    article.eligibilityReviewedAt = now
    article.eligibilityChecklistAnswers = decision.checklistAnswers or {}
    if decision.decision == "included":
        article.currentPhase = "included"
        article.reviewOutcome = "included"
        article.fullTextStatus = "uploaded"
        article.eligibilityDecision = "included"
        article.eligibilityReasonText = reason
        article.includedAt = now
        article.answeringRQs = sorted({rq for rq in (decision.answeringRQs or []) if isinstance(rq, int) and rq > 0})
    elif decision.decision == "full_text_unavailable":
        article.currentPhase = "eligibility"
        article.reviewOutcome = "full_text_unavailable"
        article.fullTextStatus = "unavailable"
        article.eligibilityDecision = "excluded"
        article.eligibilityReasonText = reason
        article.includedAt = None
        article.answeringRQs = []
    else:
        article.currentPhase = "eligibility"
        article.reviewOutcome = "excluded_eligibility"
        article.eligibilityDecision = "excluded"
        article.eligibilityReasonText = reason
        article.includedAt = None
        article.answeringRQs = []
    _apply_legacy_state(article)


async def _inherit_eligibility_assignments(
    db: AsyncSession, *, article: Article, assignments: list[ReviewAssignment], actor_user_id: int
) -> None:
    existing_result = await db.execute(
        select(ReviewAssignment).where(
            ReviewAssignment.articleId == article.id,
            ReviewAssignment.phase == "eligibility",
        )
    )
    existing_by_reviewer = {
        assignment.reviewerUserId: assignment
        for assignment in existing_result.scalars().all()
    }
    for assignment in assignments:
        existing = existing_by_reviewer.get(assignment.reviewerUserId)
        if existing is not None:
            existing.slot = assignment.slot
            existing.status = "pending"
            existing.submittedAt = None
            existing.cancelledAt = None
            existing.assignedByUserId = actor_user_id
            existing.inheritedFromAssignmentId = assignment.id
            continue
        db.add(
            ReviewAssignment(
                projectId=assignment.projectId,
                articleId=assignment.articleId,
                phase="eligibility",
                reviewerUserId=assignment.reviewerUserId,
                slot=assignment.slot,
                status="pending",
                assignedByUserId=actor_user_id,
                inheritedFromAssignmentId=assignment.id,
            )
        )


async def submit_review_decision(
    db: AsyncSession,
    *,
    access: ProjectAccess,
    article_id: int,
    phase: Literal["screening", "eligibility"],
    payload,
    reviewer_user_id: int,
) -> ReviewSubmissionResult:
    article_result = await db.execute(
        select(Article)
        .where(Article.id == article_id, Article.projectId == access.project.id)
        .with_for_update()
    )
    article = article_result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail={"code": "ARTICLE_NOT_FOUND", "message": "Artigo não encontrado."})
    _validate_payload(article, phase, payload)
    assignments_result = await db.execute(
        select(ReviewAssignment)
        .where(
            ReviewAssignment.articleId == article_id,
            ReviewAssignment.phase == phase,
            ReviewAssignment.status != "cancelled",
        )
        .order_by(ReviewAssignment.slot)
        .with_for_update()
    )
    assignments = list(assignments_result.scalars().all())
    own_assignment = next((item for item in assignments if item.reviewerUserId == reviewer_user_id), None)
    if own_assignment is None:
        raise HTTPException(status_code=403, detail={"code": "REVIEW_NOT_ASSIGNED", "message": "Este artigo não foi atribuído a você."})
    if own_assignment.status == "submitted":
        raise HTTPException(status_code=409, detail={"code": "REVIEW_ALREADY_SUBMITTED", "message": "Sua decisão já foi registrada."})
    if own_assignment.status == "needs_reassignment":
        raise HTTPException(status_code=409, detail={"code": "REVIEW_NEEDS_REASSIGNMENT", "message": "Esta atribuição precisa ser redistribuída."})

    values = payload.model_dump() if hasattr(payload, "model_dump") else dict(payload)
    decision = ReviewDecision(
        assignmentId=own_assignment.id,
        projectId=access.project.id,
        articleId=article_id,
        phase=phase,
        reviewerUserId=reviewer_user_id,
        decision=values["decision"],
        reasonText=(values.get("reasonText") or "").strip() or None,
        checklistAnswers=values.get("checklistAnswers") or {},
        answeringRQs=values.get("answeringRQs") or [],
        status="submitted",
        submittedAt=datetime.now(timezone.utc),
    )
    db.add(decision)
    own_assignment.status = "submitted"
    own_assignment.submittedAt = decision.submittedAt
    await db.flush()

    decisions_result = await db.execute(
        select(ReviewDecision).where(
            ReviewDecision.articleId == article_id,
            ReviewDecision.phase == phase,
            ReviewDecision.status == "submitted",
        )
    )
    decisions = list(decisions_result.scalars().all())
    state = resolution_state(decisions, assignment_count=len(assignments))
    if state == "waiting_for_reviewer":
        return ReviewSubmissionResult(state, article, decision)
    if state == "consolidated":
        apply_canonical_decision(article, phase=phase, decision=decisions[0])
        if phase == "screening" and decisions[0].decision == "included":
            await _inherit_eligibility_assignments(db, article=article, assignments=assignments, actor_user_id=reviewer_user_id)
        return ReviewSubmissionResult(state, article, decision)

    conflict = ReviewConflict(
        projectId=access.project.id,
        articleId=article_id,
        phase=phase,
        status="open",
        decisionIds=[item.id for item in decisions],
    )
    db.add(conflict)
    create_audit_event(db, project_id=access.project.id, actor_user_id=reviewer_user_id, action="review_conflict_opened", entity_type="article", entity_id=article_id, payload={"phase": phase})
    coordinators_result = await db.execute(
        select(ProjectMember.userId).where(
            ProjectMember.projectId == access.project.id,
            ProjectMember.role == "coordinator",
            ProjectMember.status == "active",
        )
    )
    recipient_ids = {access.project.ownerId, *coordinators_result.scalars().all()}
    for recipient_id in recipient_ids:
        create_notification(db, project_id=access.project.id, recipient_user_id=recipient_id, type="review_conflict", title="Discordância de revisão", body="Um artigo precisa de desempate.", entity_type="article", entity_id=article_id, payload={"phase": phase})
    await db.flush()
    return ReviewSubmissionResult(state, article, decision, conflict)


async def list_visible_decisions(
    db: AsyncSession, *, article_id: int, phase: str, current_user_id: int
) -> list[dict]:
    assignments_result = await db.execute(select(ReviewAssignment).where(ReviewAssignment.articleId == article_id, ReviewAssignment.phase == phase, ReviewAssignment.status != "cancelled"))
    assignments = assignments_result.scalars().all()
    decisions_result = await db.execute(select(ReviewDecision).where(ReviewDecision.articleId == article_id, ReviewDecision.phase == phase, ReviewDecision.status == "submitted"))
    decisions = decisions_result.scalars().all()
    return visible_decision_payloads(decisions, current_user_id=current_user_id, complete=len(decisions) == len(assignments))


async def require_assigned_write_if_managed(
    db: AsyncSession, *, article_id: int, user_id: int, phase: str, access: ProjectAccess
) -> None:
    if not get_settings().ASSIGNED_REVIEW_FLOW_ENABLED or access.role != "reviewer":
        return
    assignments_result = await db.execute(
        select(ReviewAssignment).where(
            ReviewAssignment.articleId == article_id,
            ReviewAssignment.status != "cancelled",
        )
    )
    assignments = assignments_result.scalars().all()
    if assignments and not any(item.reviewerUserId == user_id and item.phase == phase and item.status != "needs_reassignment" for item in assignments):
        raise HTTPException(status_code=403, detail={"code": "REVIEW_NOT_ASSIGNED", "message": "Este artigo não foi atribuído a você."})


async def resolve_conflict(
    db: AsyncSession,
    *,
    access: ProjectAccess,
    conflict_id: int,
    decision_value: str,
    reason: str,
    resolved_by_user_id: int,
) -> ReviewConflict:
    require_capability(access, CAP_RESOLVE_CONFLICTS)
    if not reason.strip():
        raise HTTPException(status_code=422, detail={"code": "RESOLUTION_REASON_REQUIRED", "message": "Informe a justificativa do desempate."})
    conflict_result = await db.execute(
        select(ReviewConflict).where(
            ReviewConflict.id == conflict_id,
            ReviewConflict.projectId == access.project.id,
            ReviewConflict.status == "open",
        ).with_for_update()
    )
    conflict = conflict_result.scalar_one_or_none()
    if conflict is None:
        raise HTTPException(status_code=404, detail={"code": "CONFLICT_NOT_FOUND", "message": "Discordância não encontrada."})
    decisions_result = await db.execute(select(ReviewDecision).where(ReviewDecision.id.in_(conflict.decisionIds)))
    decisions = decisions_result.scalars().all()
    selected = next((item for item in decisions if item.decision == decision_value), None)
    if selected is None:
        raise HTTPException(status_code=422, detail={"code": "INVALID_RESOLUTION", "message": "Escolha uma das decisões submetidas."})
    article_result = await db.execute(select(Article).where(Article.id == conflict.articleId).with_for_update())
    article = article_result.scalar_one()
    apply_canonical_decision(article, phase=conflict.phase, decision=selected)
    if conflict.phase == "eligibility":
        apply_quality_metrics(article, access.project.qualityAssessmentSchema or [])
    conflict.status = "resolved"
    conflict.resolvedDecision = decision_value
    conflict.resolutionReason = reason.strip()
    conflict.resolvedByUserId = resolved_by_user_id
    conflict.resolvedAt = datetime.now(timezone.utc)
    create_audit_event(db, project_id=access.project.id, actor_user_id=resolved_by_user_id, action="review_conflict_resolved", entity_type="conflict", entity_id=conflict.id, reason=reason.strip(), payload={"decision": decision_value})
    assignments_result = await db.execute(select(ReviewAssignment).where(ReviewAssignment.articleId == conflict.articleId, ReviewAssignment.phase == conflict.phase, ReviewAssignment.status != "cancelled"))
    assignments = list(assignments_result.scalars().all())
    if conflict.phase == "screening" and decision_value == "included":
        await _inherit_eligibility_assignments(
            db,
            article=article,
            assignments=assignments,
            actor_user_id=resolved_by_user_id,
        )
    for assignment in assignments:
        create_notification(db, project_id=access.project.id, recipient_user_id=assignment.reviewerUserId, type="review_conflict_resolved", title="Discordância resolvida", body="A decisão final do artigo foi registrada.", entity_type="article", entity_id=conflict.articleId, payload={"phase": conflict.phase, "decision": decision_value})
    await db.flush()
    return conflict


async def reopen_review(
    db: AsyncSession,
    *,
    access: ProjectAccess,
    article_id: int,
    phase: Literal["screening", "eligibility"],
    reason: str,
    actor_user_id: int,
) -> Article:
    require_capability(access, CAP_REOPEN_REVIEW)
    if not reason.strip():
        raise HTTPException(status_code=422, detail={"code": "REOPEN_REASON_REQUIRED", "message": "Informe a justificativa da reabertura."})
    article_result = await db.execute(select(Article).where(Article.id == article_id, Article.projectId == access.project.id).with_for_update())
    article = article_result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail={"code": "ARTICLE_NOT_FOUND", "message": "Artigo não encontrado."})
    assignments_result = await db.execute(select(ReviewAssignment).where(ReviewAssignment.articleId == article_id, ReviewAssignment.phase == phase, ReviewAssignment.status != "cancelled"))
    assignments = assignments_result.scalars().all()
    decisions_result = await db.execute(select(ReviewDecision).where(ReviewDecision.articleId == article_id, ReviewDecision.phase == phase, ReviewDecision.status.in_(("draft", "submitted"))))
    for decision in decisions_result.scalars().all():
        decision.status = "superseded"
    for assignment in assignments:
        assignment.status = "pending"
        assignment.submittedAt = None
    conflicts_result = await db.execute(select(ReviewConflict).where(ReviewConflict.articleId == article_id, ReviewConflict.phase == phase, ReviewConflict.status == "open"))
    for conflict in conflicts_result.scalars().all():
        conflict.status = "resolved"
        conflict.resolutionReason = "Revisão reaberta: " + reason.strip()
        conflict.resolvedByUserId = actor_user_id
        conflict.resolvedAt = datetime.now(timezone.utc)
    article.currentPhase = phase
    article.reviewOutcome = "active"
    if phase == "screening":
        eligibility_result = await db.execute(
            select(ReviewAssignment).where(
                ReviewAssignment.articleId == article_id,
                ReviewAssignment.phase == "eligibility",
                ReviewAssignment.status != "cancelled",
            )
        )
        now = datetime.now(timezone.utc)
        for eligibility_assignment in eligibility_result.scalars().all():
            eligibility_assignment.status = "cancelled"
            eligibility_assignment.cancelledAt = now
            eligibility_assignment.submittedAt = None
        article.screeningDecision = "pending"
        article.screeningReasonText = None
        article.screeningReviewedAt = None
    else:
        article.eligibilityDecision = "pending"
        article.eligibilityReasonText = None
        article.eligibilityReviewedAt = None
        article.includedAt = None
    create_audit_event(db, project_id=access.project.id, actor_user_id=actor_user_id, action="review_reopened", entity_type="article", entity_id=article_id, reason=reason.strip(), payload={"phase": phase})
    for assignment in assignments:
        create_notification(db, project_id=access.project.id, recipient_user_id=assignment.reviewerUserId, type="review_reopened", title="Revisão reaberta", body="Uma revisão atribuída a você foi reaberta.", entity_type="article", entity_id=article_id, payload={"phase": phase})
    await db.flush()
    return article
