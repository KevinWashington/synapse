from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.article_response_service import build_article_response, legacy_review_fields


def article(**overrides):
    values = {
        "id": 1,
        "paperId": None,
        "title": "Study",
        "authors": "Author",
        "year": 2026,
        "journal": "Journal",
        "sourceCategory": "database",
        "sourceName": "PubMed",
        "entryMethod": "manual",
        "currentPhase": "included",
        "reviewOutcome": "included",
        "screeningDecision": "included",
        "fullTextStatus": "uploaded",
        "eligibilityDecision": "included",
        "status": "stale status",
        "manualDecision": "excluido",
        "manualDecisionReason": "stale reason",
        "decisionUpdatedAt": None,
        "exclusionCriteria": ["stale exclusion"],
        "eligibilityReasonText": "Incluído",
        "eligibilityReviewedAt": datetime(2026, 10, 10, tzinfo=timezone.utc),
        "screeningReviewedAt": None,
        "includedAt": None,
        "screeningReasonText": None,
        "duplicateReasonText": None,
        "pdfData": b"pdf",
        "eligibilityChecklistAnswers": None,
        "extractionData": None,
        "qualityAssessmentAnswers": None,
        "aiSuggestedRQs": None,
        "aiKeywords": None,
        "answeringRQs": None,
        "qualityRating": None,
        "projectId": 7,
        "ownerId": 2,
        "createdAt": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updatedAt": datetime(2026, 1, 2, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_legacy_fields_are_a_pure_projection_including_screening_compatibility():
    record = article(
        currentPhase="eligibility",
        reviewOutcome="active",
        screeningDecision="included",
        eligibilityReviewedAt=None,
    )
    before = vars(record).copy()

    projected = legacy_review_fields(record)

    assert projected == {
        "status": "analisado",
        "manualDecision": "incluido",
        "manualDecisionReason": None,
        "decisionUpdatedAt": None,
        "exclusionCriteria": [],
    }
    assert vars(record) == before


def test_article_response_uses_projected_fields_without_mutating_entity():
    record = article()
    before = vars(record).copy()

    response = build_article_response(record)

    assert response.reviewOutcome == record.reviewOutcome
    assert response.status == "analisado"
    assert response.manualDecision == "incluido"
    assert response.manualDecisionReason == "Incluído"
    assert response.decisionUpdatedAt == record.eligibilityReviewedAt
    assert response.exclusionCriteria == []
    assert response.hasPdf is True
    assert response.extractionData == {}
    assert vars(record) == before
