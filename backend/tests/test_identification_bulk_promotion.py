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


def test_distinct_dois_are_not_grouped_only_because_metadata_is_similar():
    first = make_article(1, "Registro único de escala 100", doi="10.5555/registro-100")
    second = make_article(2, "Registro único de escala 101", doi="10.5555/registro-101")

    result = articles._promote_unique_identification_articles([first, second])

    assert result == {
        "movedCount": 2,
        "unresolvedDuplicateGroups": 0,
        "unresolvedDuplicateRecords": 0,
    }
    assert first.duplicateGroupKey is None
    assert second.duplicateGroupKey is None


def test_bulk_promotion_moves_all_unique_records_beyond_two_frontend_pages_once():
    unique_records = [
        make_article(
            article_id,
            f"Registro unico de escala {article_id}",
            doi=f"10.5555/registro-{article_id}",
        )
        for article_id in range(1, 46)
    ]
    duplicate_a = make_article(46, "Duplicata na base A", doi="10.5555/duplicado")
    duplicate_b = make_article(47, "Duplicata na base B", doi="10.5555/duplicado")
    records = [*unique_records, duplicate_a, duplicate_b]

    first_result = articles._promote_unique_identification_articles(records)

    assert first_result == {
        "movedCount": 45,
        "unresolvedDuplicateGroups": 1,
        "unresolvedDuplicateRecords": 2,
    }
    assert all(record.currentPhase == "screening" for record in unique_records)
    assert duplicate_a.currentPhase == "identification"
    assert duplicate_b.currentPhase == "identification"

    second_result = articles._promote_unique_identification_articles(records)

    assert second_result == {
        "movedCount": 0,
        "unresolvedDuplicateGroups": 1,
        "unresolvedDuplicateRecords": 2,
    }
