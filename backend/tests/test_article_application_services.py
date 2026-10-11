from types import SimpleNamespace

import pytest
from app.core.errors import ApplicationError
from app.services.article_file_service import ArticleFileService


def test_pdf_storage_preserves_reopening_policy():
    article = SimpleNamespace(
        currentPhase="eligibility",
        reviewOutcome="full_text_unavailable",
        screeningDecision="included",
        screeningReasonText=None,
        screeningReviewedAt=None,
        eligibilityDecision="excluded",
        eligibilityReasonText="Unavailable",
        eligibilityReviewedAt=None,
    )
    service = ArticleFileService()
    service.store_pdf(
        article, content=b"%PDF", filename="study.pdf", content_type="application/pdf"
    )
    assert article.reviewOutcome == "active"
    assert article.eligibilityDecision == "pending"
    assert article.manualDecision == "incluido"
    assert service.read_pdf(article) == (b"%PDF", "application/pdf", "study.pdf")


@pytest.mark.parametrize(
    "phase, content_type, content, code",
    [
        ("screening", "application/pdf", b"%PDF", "INVALID_REVIEW_PHASE"),
        ("eligibility", "text/plain", b"plain", "INVALID_FILE_TYPE"),
        ("eligibility", "application/pdf", b"x" * (10 * 1024 * 1024 + 1), "FILE_TOO_LARGE"),
    ],
    ids=["wrong-phase", "wrong-type", "too-large"],
)
def test_pdf_validation_precedes_storage(phase, content_type, content, code):
    article = SimpleNamespace(currentPhase=phase, pdfData=None)
    with pytest.raises(ApplicationError) as error:
        ArticleFileService().store_pdf(
            article, content=content, filename="study.pdf", content_type=content_type
        )
    assert error.value.code == code
    assert article.pdfData is None


def test_selection_summary_counts_pending_extraction_across_full_corpus():
    from app.services.article_report_service import selection_summary_from_articles

    def item(article_id, outcome="included", completed=None):
        return SimpleNamespace(
            id=article_id,
            currentPhase="included",
            reviewOutcome=outcome,
            extractionCompletedAt=completed,
            sourceCategory="database",
            sourceName="Scopus",
        )

    summary = selection_summary_from_articles(
        7, [item(1), item(2, completed="done"), item(3, outcome="excluded_eligibility")]
    )
    assert summary.included == 2
    assert summary.pendingExtraction == 1
