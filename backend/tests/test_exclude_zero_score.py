import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from app.models.article import Article


def make_screening_article(article_id: int) -> Article:
    return Article(
        id=article_id,
        title=f"Estudo {article_id}",
        authors="Autora Teste",
        year=2024,
        currentPhase="screening",
        reviewOutcome="active",
        screeningDecision="pending",
        eligibilityDecision="pending",
        fullTextStatus="not_requested",
        aiRelevanceScore=0,
    )


def scalars_result(values):
    result = Mock()
    result.scalars.return_value.all.return_value = values
    return result


def run_exclusion(monkeypatch, candidates, assigned_ids):
    from app.routers import articles

    monkeypatch.setattr(
        articles,
        "resolve_project_access",
        AsyncMock(return_value=SimpleNamespace(project=SimpleNamespace(id=7), role="owner")),
    )
    monkeypatch.setattr(articles, "require_capability", Mock())
    enqueue = AsyncMock()
    monkeypatch.setattr(articles, "enqueue_article_index", enqueue)

    responses = [scalars_result(candidates)]
    if candidates:
        responses.append(scalars_result(assigned_ids))
    db = SimpleNamespace(execute=AsyncMock(side_effect=responses), commit=AsyncMock())

    response = asyncio.run(
        articles.exclude_zero_score_articles(7, current_user=SimpleNamespace(id=1), db=db)
    )
    return response, enqueue, db


def test_excludes_unassigned_zero_score_articles_and_keeps_assigned_ones(monkeypatch):
    free = make_screening_article(1)
    assigned = make_screening_article(2)

    response, enqueue, db = run_exclusion(monkeypatch, [free, assigned], [2])

    assert response.excludedCount == 1
    assert response.skippedAssignedCount == 1
    assert free.screeningDecision == "excluded"
    assert free.reviewOutcome == "excluded_screening"
    assert "nota de relevância da IA igual a 0" in free.screeningReasonText
    assert assigned.screeningDecision == "pending"
    assert assigned.reviewOutcome == "active"
    enqueue.assert_awaited_once()
    db.commit.assert_awaited_once()


def test_exclusion_with_no_candidates_is_a_noop(monkeypatch):
    response, enqueue, _ = run_exclusion(monkeypatch, [], [])

    assert response.excludedCount == 0
    assert response.skippedAssignedCount == 0
    enqueue.assert_not_awaited()
