import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from app.models.article import Article
from app.schemas.article import ImportBibTeXRequest
from app.services.article_import_service import import_bibtex_articles


def existing_article(article_id, title, *, doi=None, year=2024, phase="eligibility"):
    return Article(
        id=article_id,
        title=title,
        authors="Autora",
        year=year,
        doi=doi,
        journal="Journal",
        sourceName="Scopus",
        sourceCategory="database",
        currentPhase=phase,
        reviewOutcome="active",
    )


def entry(title, *, doi=None, year=2024):
    return {"title": title, "authors": "Autora", "year": year, "journal": "Journal", "doi": doi}


def run_import(existing, entries, *, ai_service=None):
    added = []
    next_id = iter(range(1000, 2000))

    def add(article):
        added.append(article)

    async def flush():
        for article in added:
            if article.id is None:
                article.id = next(next_id)

    result = Mock()
    result.scalars.return_value.all.return_value = existing
    db = SimpleNamespace(execute=AsyncMock(return_value=result), add=add, flush=flush)
    access = SimpleNamespace(
        role="owner",
        capabilities={"edit_project"},
        project=SimpleNamespace(
            id=7, criteriosInclusao=[], criteriosExclusao=[], researchQuestions=[]
        ),
    )
    request = ImportBibTeXRequest(sourceCategory="database", sourceName="Scopus", entries=entries)
    response = asyncio.run(
        import_bibtex_articles(
            db, access=access, request=request, actor_user_id=1, ai_service=ai_service
        )
    )
    return response, added


@pytest.fixture(autouse=True)
def allow_access(monkeypatch):
    from app.services import project_access_service

    monkeypatch.setattr(project_access_service, "require_capability", lambda *args, **kwargs: None)


def test_reimport_marks_existing_records_as_duplicates_without_calling_ai():
    advanced = existing_article(1, "Chess tutor", doi="10.1/abc")
    included = existing_article(2, "Robot chess", phase="included")
    ai_service = SimpleNamespace(evaluate_article=AsyncMock())

    response, added = run_import(
        [advanced, included],
        [entry("Chess tutor (reprint)", doi="10.1/ABC"), entry("Robot  Chess"), entry("New study")],
        ai_service=ai_service,
    )

    assert response.importedCount == 3
    assert response.duplicateCount == 2
    by_title = {article.title: article for article in added}
    assert by_title["Chess tutor (reprint)"].duplicateOfArticleId == 1
    assert by_title["Chess tutor (reprint)"].duplicateReasonCode == "same_doi"
    assert by_title["Robot  Chess"].duplicateOfArticleId == 2
    assert by_title["Robot  Chess"].reviewOutcome == "duplicate_removed"
    assert by_title["New study"].reviewOutcome == "active"
    assert by_title["New study"].currentPhase == "identification"
    ai_service.evaluate_article.assert_not_awaited()
    assert advanced.reviewOutcome == "active" and advanced.currentPhase == "eligibility"


def test_repeated_entries_in_the_same_file_keep_only_the_first():
    response, added = run_import(
        [], [entry("Proceedings DUXU"), entry("Proceedings DUXU"), entry("Other")]
    )

    assert response.duplicateCount == 1
    first, repeated, other = added
    assert first.reviewOutcome == "active"
    assert repeated.duplicateOfArticleId == first.id
    assert other.reviewOutcome == "active"


def test_same_title_in_a_different_year_is_not_a_duplicate():
    response, _ = run_import(
        [existing_article(1, "Annual report", year=2023)], [entry("Annual report", year=2024)]
    )

    assert response.duplicateCount == 0


def test_duplicate_groups_list_the_advanced_record_as_default_original():
    from app.services.article_dedup_service import analyze_duplicates

    new_copy = existing_article(9, "Fuzzy chess study", doi="10.1/x", phase="identification")
    advanced = existing_article(3, "Fuzzy chess study", doi="10.1/x", phase="screening")

    [group] = analyze_duplicates([new_copy, advanced])

    assert group.candidateIds == [3, 9]
