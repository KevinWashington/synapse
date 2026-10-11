"""Canonical article review transitions and pure legacy-field projection."""

from dataclasses import dataclass, field
from datetime import datetime

from app.core.errors import ApplicationError


@dataclass(frozen=True)
class ReviewDecisionData:
    decision: str
    reason_text: str | None = None
    checklist_answers: dict = field(default_factory=dict)
    answering_rqs: list[int] = field(default_factory=list)


def validate_review_decision(article, *, phase: str, decision: ReviewDecisionData) -> None:
    if phase not in {"screening", "eligibility"}:
        raise ApplicationError(
            "INVALID_REVIEW_PHASE", "Etapa de revisão inválida.", status_code=400
        )
    valid_decisions = (
        {"included", "excluded"}
        if phase == "screening"
        else {"included", "excluded", "full_text_unavailable"}
    )
    if decision.decision not in valid_decisions:
        raise ApplicationError(
            "INVALID_REVIEW_DECISION", "Decisão inválida para esta etapa.", status_code=400
        )
    if (
        decision.decision in {"excluded", "full_text_unavailable"}
        and not (decision.reason_text or "").strip()
    ):
        raise ApplicationError(
            "REASON_REQUIRED", "Informe a justificativa da decisão.", status_code=400
        )
    if (
        phase == "eligibility"
        and decision.decision == "included"
        and article.pdfData is None
        and article.fullTextStatus != "uploaded"
    ):
        raise ApplicationError(
            "PDF_REQUIRED",
            "Faça upload do texto completo antes de incluir.",
            status_code=400,
        )


def legacy_review_fields(article) -> dict:
    """Return legacy API fields as a projection without changing the article."""
    outcome = article.reviewOutcome
    if outcome == "included":
        return {
            "status": "analisado",
            "manualDecision": "incluido",
            "manualDecisionReason": article.eligibilityReasonText,
            "decisionUpdatedAt": article.eligibilityReviewedAt or article.includedAt,
            "exclusionCriteria": [],
        }

    if outcome in {
        "excluded_screening",
        "excluded_eligibility",
        "full_text_unavailable",
        "duplicate_removed",
    }:
        if outcome == "excluded_screening":
            exclusion_reason = article.screeningReasonText
        elif outcome == "duplicate_removed":
            exclusion_reason = article.duplicateReasonText
        else:
            exclusion_reason = article.eligibilityReasonText
        return {
            "status": "excluido",
            "manualDecision": "excluido",
            "manualDecisionReason": (
                article.eligibilityReasonText
                or article.screeningReasonText
                or article.duplicateReasonText
            ),
            "decisionUpdatedAt": article.eligibilityReviewedAt
            or article.screeningReviewedAt
            or article.updatedAt,
            "exclusionCriteria": [exclusion_reason] if exclusion_reason else [],
        }

    if article.currentPhase == "eligibility":
        status = "analisado"
    else:
        status = "pendente"

    if article.screeningDecision == "excluded":
        manual_decision = "excluido"
        reason = article.screeningReasonText
    elif article.currentPhase == "eligibility" and article.screeningDecision == "included":
        manual_decision = "incluido"
        reason = article.screeningReasonText
    else:
        manual_decision = None
        reason = None

    return {
        "status": status,
        "manualDecision": manual_decision,
        "manualDecisionReason": reason,
        "decisionUpdatedAt": article.eligibilityReviewedAt or article.screeningReviewedAt,
        "exclusionCriteria": [reason] if manual_decision == "excluido" and reason else [],
    }


def apply_legacy_review_state(article) -> None:
    """Apply the compatibility projection to a caller-owned entity."""
    for name, value in legacy_review_fields(article).items():
        setattr(article, name, value)


def apply_review_decision(
    article,
    *,
    phase: str,
    decision: ReviewDecisionData,
    now: datetime,
) -> None:
    validate_review_decision(article, phase=phase, decision=decision)
    reason = (decision.reason_text or "").strip() or None

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
        apply_legacy_review_state(article)
        return

    article.eligibilityReviewedAt = now
    article.eligibilityChecklistAnswers = decision.checklist_answers or {}
    if decision.decision == "included":
        article.currentPhase = "included"
        article.reviewOutcome = "included"
        article.fullTextStatus = "uploaded"
        article.eligibilityDecision = "included"
        article.eligibilityReasonText = reason
        article.includedAt = now
        article.answeringRQs = sorted(
            {rq for rq in (decision.answering_rqs or []) if isinstance(rq, int) and rq > 0}
        )
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
    apply_legacy_review_state(article)


def reset_review_for_reopen(article, *, phase: str) -> None:
    """Clear downstream decisions and extraction data for an authorized reopen."""
    if phase not in {"screening", "eligibility"}:
        raise ApplicationError(
            "INVALID_REVIEW_PHASE", "Etapa de revisão inválida.", status_code=400
        )
    article.currentPhase = phase
    article.reviewOutcome = "active"
    if phase == "screening":
        article.screeningDecision = "pending"
        article.screeningReasonText = None
        article.screeningReviewedAt = None
    article.fullTextStatus = (
        "uploaded"
        if article.pdfData is not None
        else ("pending_upload" if phase == "eligibility" else "not_requested")
    )
    article.eligibilityDecision = "pending"
    article.eligibilityReasonText = None
    article.eligibilityReviewedAt = None
    article.eligibilityChecklistAnswers = {}
    article.answeringRQs = []
    article.includedAt = None
    article.extractionData = {}
    article.extractionCompletedAt = None
    article.qualityAssessmentAnswers = {}
    article.qualityScore = None
    article.qualityRating = "unrated"
    apply_legacy_review_state(article)
