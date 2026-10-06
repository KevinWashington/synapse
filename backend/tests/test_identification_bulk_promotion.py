from types import SimpleNamespace

from app.routers import articles


def make_article(
    article_id: int,
    title: str,
    *,
    doi: str | None = None,
    phase: str = "identification",
    outcome: str = "active",
):
    return SimpleNamespace(
        id=article_id,
        title=title,
        authors="Autora Teste",
        year=2024,
        journal="Journal",
        doi=doi,
        sourceName="Scopus",
        sourceCategory="database",
        currentPhase=phase,
        reviewOutcome=outcome,
        duplicateGroupKey=None,
        duplicateReasonCode=None,
        duplicateReasonText=None,
        screeningDecision="pending",
        screeningReasonText=None,
        screeningReviewedAt=None,
        eligibilityReasonText=None,
        eligibilityReviewedAt=None,
        includedAt=None,
        updatedAt=None,
        status="pendente",
        manualDecision=None,
        manualDecisionReason=None,
        decisionUpdatedAt=None,
        exclusionCriteria=[],
    )


def test_promotes_every_unique_identification_record_and_keeps_duplicate_groups():
    unique_a = make_article(1, "Estudo único A")
    duplicate_a = make_article(2, "Mesmo estudo", doi="10.1000/repetido")
    duplicate_b = make_article(3, "Mesmo estudo em outra base", doi="10.1000/repetido")
    unique_b = make_article(4, "Estudo único B")

    result = articles._promote_unique_identification_articles(
        [unique_a, duplicate_a, duplicate_b, unique_b]
    )

    assert result == {
        "movedCount": 2,
        "unresolvedDuplicateGroups": 1,
        "unresolvedDuplicateRecords": 2,
    }
    assert unique_a.currentPhase == "screening"
    assert unique_b.currentPhase == "screening"
    assert duplicate_a.currentPhase == "identification"
    assert duplicate_b.currentPhase == "identification"
    assert duplicate_a.duplicateGroupKey
    assert duplicate_b.duplicateGroupKey == duplicate_a.duplicateGroupKey


def test_bulk_promotion_does_not_reprocess_records_outside_identification():
    screening = make_article(1, "Já em triagem", phase="screening")
    removed = make_article(2, "Duplicata removida", outcome="duplicate_removed")
    unique = make_article(3, "Novo estudo")

    result = articles._promote_unique_identification_articles([screening, removed, unique])

    assert result["movedCount"] == 1
    assert screening.currentPhase == "screening"
    assert screening.duplicateGroupKey is None
    assert removed.currentPhase == "identification"


def test_bulk_promotion_accepts_an_empty_identification_queue():
    assert articles._promote_unique_identification_articles([]) == {
        "movedCount": 0,
        "unresolvedDuplicateGroups": 0,
        "unresolvedDuplicateRecords": 0,
    }
