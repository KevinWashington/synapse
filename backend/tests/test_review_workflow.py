from datetime import datetime, timezone

import pytest
from app.core.errors import ApplicationError
from app.services.review_workflow_service import (
    ReviewDecisionData,
    apply_review_decision,
    legacy_review_fields,
    reset_review_for_reopen,
)


def article(**overrides):
    values = {
        "currentPhase": "screening",
        "reviewOutcome": "active",
        "screeningDecision": "pending",
        "screeningReasonText": None,
        "screeningReviewedAt": None,
        "duplicateGroupKey": "group:1",
        "duplicateReasonCode": "same_doi",
        "duplicateReasonText": "Duplicata detectada",
        "pdfData": None,
        "fullTextStatus": "not_requested",
        "eligibilityDecision": "pending",
        "eligibilityReasonText": None,
        "eligibilityReviewedAt": None,
        "eligibilityChecklistAnswers": {},
        "includedAt": None,
        "answeringRQs": [],
        "extractionData": {"result": "old"},
        "extractionCompletedAt": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "qualityAssessmentAnswers": {"quality": True},
        "qualityScore": 1.0,
        "qualityRating": "high",
        "status": "pendente",
        "manualDecision": None,
        "manualDecisionReason": None,
        "decisionUpdatedAt": None,
        "exclusionCriteria": [],
        "updatedAt": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return type("ArticleFixture", (), values)()


def decision(value, *, reason=None, answers=None, answering_rqs=None):
    return ReviewDecisionData(
        decision=value,
        reason_text=reason,
        checklist_answers=answers or {},
        answering_rqs=answering_rqs or [],
    )


def test_screening_inclusion_keeps_legacy_included_projection_without_final_corpus_inclusion():
    record = article()
    now = datetime(2026, 10, 10, tzinfo=timezone.utc)

    apply_review_decision(
        record, phase="screening", decision=decision("included", reason="Segue"), now=now
    )

    assert (record.currentPhase, record.reviewOutcome) == ("eligibility", "active")
    assert record.manualDecision == "incluido"
    assert record.manualDecisionReason == "Segue"
    assert record.decisionUpdatedAt == now
    assert record.status == "analisado"


@pytest.mark.parametrize("phase", ["screening", "eligibility"])
def test_exclusion_requires_reason_and_does_not_mutate_article_before_validation(phase):
    record = article()
    before = vars(record).copy()

    with pytest.raises(ApplicationError) as error:
        apply_review_decision(
            record, phase=phase, decision=decision("excluded"), now=datetime.now(timezone.utc)
        )

    assert error.value.code == "REASON_REQUIRED"
    assert vars(record) == before


def test_screening_exclusion_projects_excluded_fields_and_reason():
    record = article()
    now = datetime(2026, 10, 10, tzinfo=timezone.utc)

    apply_review_decision(
        record, phase="screening", decision=decision("excluded", reason=" Fora "), now=now
    )

    assert (record.currentPhase, record.reviewOutcome, record.screeningDecision) == (
        "screening",
        "excluded_screening",
        "excluded",
    )
    assert record.screeningReasonText == "Fora"
    assert record.manualDecision == "excluido"
    assert record.exclusionCriteria == ["Fora"]


def test_eligibility_inclusion_requires_pdf_and_normalizes_rq_links():
    record = article(currentPhase="eligibility", fullTextStatus="uploaded")
    now = datetime(2026, 10, 10, tzinfo=timezone.utc)
    payload = decision(
        "included", reason="Aceito", answers={"q": True}, answering_rqs=[3, 0, 3, -1, 1]
    )

    apply_review_decision(record, phase="eligibility", decision=payload, now=now)
    assert (record.currentPhase, record.reviewOutcome, record.eligibilityDecision) == (
        "included",
        "included",
        "included",
    )
    assert record.includedAt == now
    assert record.eligibilityChecklistAnswers == {"q": True}
    assert record.answeringRQs == [1, 3]

    missing_pdf = article(currentPhase="eligibility")
    with pytest.raises(ApplicationError) as error:
        apply_review_decision(missing_pdf, phase="eligibility", decision=payload, now=now)
    assert error.value.code == "PDF_REQUIRED"


def test_full_text_unavailable_projects_eligibility_exclusion():
    record = article(currentPhase="eligibility")
    now = datetime(2026, 10, 10, tzinfo=timezone.utc)

    apply_review_decision(
        record,
        phase="eligibility",
        decision=decision("full_text_unavailable", reason="Indisponível"),
        now=now,
    )

    assert record.reviewOutcome == "full_text_unavailable"
    assert record.fullTextStatus == "unavailable"
    assert record.eligibilityDecision == "excluded"
    assert record.manualDecision == "excluido"
    assert record.exclusionCriteria == ["Indisponível"]


def test_legacy_projection_handles_duplicate_and_active_reopened_states_purely():
    duplicate = article(reviewOutcome="duplicate_removed", currentPhase="identification")
    original = vars(duplicate).copy()

    fields = legacy_review_fields(duplicate)

    assert fields["status"] == "excluido"
    assert fields["manualDecision"] == "excluido"
    assert fields["manualDecisionReason"] == "Duplicata detectada"
    assert fields["exclusionCriteria"] == ["Duplicata detectada"]
    assert vars(duplicate) == original

    reopened = article(
        currentPhase="eligibility", screeningDecision="included", screeningReasonText="Segue"
    )
    reopened_fields = legacy_review_fields(reopened)
    assert reopened_fields["status"] == "analisado"
    assert reopened_fields["manualDecision"] == "incluido"
    assert reopened_fields["manualDecisionReason"] == "Segue"


def test_reopening_clears_downstream_canonical_state_and_reprojects_legacy_fields():
    record = article(
        currentPhase="included",
        reviewOutcome="included",
        screeningDecision="included",
        eligibilityDecision="included",
    )

    reset_review_for_reopen(record, phase="eligibility")

    assert (record.currentPhase, record.reviewOutcome, record.eligibilityDecision) == (
        "eligibility",
        "active",
        "pending",
    )
    assert record.extractionData == {}
    assert record.extractionCompletedAt is None
    assert record.qualityAssessmentAnswers == {}
    assert record.manualDecision == "incluido"


def test_individual_and_consolidated_flow_apply_same_canonical_transition():
    individually_applied = article(currentPhase="eligibility", fullTextStatus="uploaded")
    consolidated = article(currentPhase="eligibility", fullTextStatus="uploaded")
    now = datetime(2026, 10, 10, tzinfo=timezone.utc)
    payload = decision("included", reason="Sim", answering_rqs=[1])

    apply_review_decision(individually_applied, phase="eligibility", decision=payload, now=now)
    apply_review_decision(consolidated, phase="eligibility", decision=payload, now=now)

    for field in (
        "currentPhase",
        "reviewOutcome",
        "eligibilityDecision",
        "manualDecision",
        "answeringRQs",
    ):
        assert getattr(individually_applied, field) == getattr(consolidated, field)
