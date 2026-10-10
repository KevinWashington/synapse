from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException

from app.services.project_access_service import CAP_MANAGE_DISTRIBUTION, ProjectAccess
from app.services.review_adaptation_service import build_adaptation_plan, adapt_reviews


def assignment(id, user, slot, status="pending", article=10):
    return SimpleNamespace(id=id, articleId=article, reviewerUserId=user, slot=slot, status=status)


def test_reducing_to_one_reviewer_cancels_only_unfinished_slots():
    rows = [assignment(1, 1, 1), assignment(2, 2, 2, "needs_reassignment")]
    plan = build_adaptation_plan([10], [1], rows)
    assert plan.cancel_ids == (2,)
    assert plan.additions == ()
    assert plan.consolidate_ids == ()
    assert rows[1].status == "needs_reassignment"  # preview never mutates


def test_existing_submitted_decision_is_kept_and_ready_to_consolidate():
    rows = [assignment(1, 1, 1, "submitted"), assignment(2, 2, 2, "needs_reassignment")]
    plan = build_adaptation_plan([10], [1], rows)
    assert plan.cancel_ids == (2,)
    assert plan.consolidate_ids == (10,)


def test_submitted_decision_from_removed_reviewer_is_not_deleted():
    rows = [assignment(1, 1, 1), assignment(2, 2, 2, "submitted")]
    plan = build_adaptation_plan([10], [1], rows)
    assert plan.cancel_ids == (1,)
    assert plan.consolidate_ids == (10,)


def test_growing_to_three_reviewers_fills_second_slots_with_distinct_balanced_reviewers():
    rows = [assignment(1, 1, 1), assignment(2, 1, 1, article=11)]
    plan = build_adaptation_plan([10, 11], [1, 2, 3], rows)
    assert [(a.article_id, a.reviewer_user_id, a.slot) for a in plan.additions] == [(10, 2, 2), (11, 3, 2)]
    assert plan.cancel_ids == ()


def test_removed_reviewer_is_replaced_and_completed_pairs_are_untouched():
    rows = [assignment(1, 1, 1), assignment(2, 99, 2, "needs_reassignment"),
            assignment(3, 99, 1, "submitted", 11), assignment(4, 1, 2, "submitted", 11)]
    plan = build_adaptation_plan([10, 11], [1, 2], rows)
    assert plan.cancel_ids == (2,)
    assert [(a.article_id, a.reviewer_user_id, a.slot) for a in plan.additions] == [(10, 2, 2)]
    assert plan.consolidate_ids == ()


def test_plan_is_idempotent_ignores_other_articles_and_requires_a_reviewer():
    rows = [assignment(1, 1, 1), assignment(2, 99, 2, "needs_reassignment", 50)]
    plan = build_adaptation_plan([10], [1], rows)
    assert not plan.cancel_ids and not plan.additions and not plan.consolidate_ids
    with pytest.raises(ValueError, match="revisor"):
        build_adaptation_plan([10], [], rows)


def result(rows):
    return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: rows))


@pytest.mark.asyncio
async def test_adaptation_rejects_stale_preview_without_mutating(monkeypatch):
    from app.services import review_adaptation_service as service
    access = ProjectAccess(project=SimpleNamespace(id=7, ownerId=1), role="owner",
                           capabilities=frozenset({CAP_MANAGE_DISTRIBUTION}), participates_in_review=True)
    row = assignment(2, 99, 2, "needs_reassignment")
    article = SimpleNamespace(id=10, currentPhase="screening", reviewOutcome="active")
    db = SimpleNamespace(execute=AsyncMock(side_effect=[None, result([article]), result([row]), result([])]),
                         flush=AsyncMock(), add=Mock())
    monkeypatch.setattr(service, "_eligible_reviewer_ids", AsyncMock(return_value=[1]))
    monkeypatch.setattr(service, "lock_project_team", AsyncMock())
    with pytest.raises(HTTPException) as error:
        await adapt_reviews(db, access=access, phase="screening", fingerprint="outdated", actor_user_id=1)
    assert error.value.status_code == 409
    assert row.status == "needs_reassignment"
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_adaptation_requires_distribution_permission_before_reading_database():
    access = ProjectAccess(project=SimpleNamespace(id=7, ownerId=1), role="reviewer",
                           capabilities=frozenset(), participates_in_review=True)
    db = SimpleNamespace(execute=AsyncMock())
    with pytest.raises(HTTPException) as error:
        await adapt_reviews(db, access=access, phase="screening", fingerprint="x", actor_user_id=2)
    assert error.value.status_code == 403
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_confirm_cancels_orphan_slot_and_consolidates_saved_decision(monkeypatch):
    from app.models.article import Article
    from app.models.collaboration import ProjectAuditEvent
    from app.services import review_adaptation_service as service
    access = ProjectAccess(project=SimpleNamespace(id=7, ownerId=1), role="owner",
                           capabilities=frozenset({CAP_MANAGE_DISTRIBUTION}), participates_in_review=True)
    article = Article(id=10, projectId=7, currentPhase="screening", reviewOutcome="active")
    rows = [assignment(1, 1, 1, "submitted"), assignment(2, 99, 2, "needs_reassignment")]
    decision = SimpleNamespace(id=8, assignmentId=1, articleId=10, decision="excluded", reasonText="Fora do escopo",
                               checklistAnswers={}, answeringRQs=[])
    added = []
    db = SimpleNamespace(execute=AsyncMock(side_effect=[result([article]), result(rows), result([decision]),
                         None, result([article]), result(rows), result([decision])]),
                         flush=AsyncMock(), add=Mock(side_effect=added.append))
    monkeypatch.setattr(service, "_eligible_reviewer_ids", AsyncMock(return_value=[1]))
    monkeypatch.setattr(service, "lock_project_team", AsyncMock())
    preview = await service.preview_adaptation(db, access=access, phase="screening")
    assert rows[1].status == "needs_reassignment"
    assert preview["cancelledCount"] == 1 and preview["consolidatedCount"] == 1
    response, changed = await adapt_reviews(db, access=access, phase="screening", fingerprint=preview["fingerprint"], actor_user_id=1)
    assert rows[0].status == "submitted" and rows[1].status == "cancelled"
    assert rows[1].cancelledAt is not None
    assert article.reviewOutcome == "excluded_screening"
    assert article.screeningReasonText == "Fora do escopo"
    assert changed == [article]
    assert response["consolidatedCount"] == 1
    assert any(isinstance(row, ProjectAuditEvent) and row.action == "review_distribution_adapted" for row in added)


@pytest.mark.asyncio
async def test_adaptation_routes_preview_without_commit_and_confirm_with_commit(monkeypatch):
    from app.routers import collaboration as router
    from app.schemas.collaboration import DistributionRequest, AdaptationRequest
    access = SimpleNamespace(project=SimpleNamespace(id=7))
    preview = {"phase": "screening", "reviewerCount": 1, "reviewsPerArticle": 1, "articleCount": 1,
               "cancelledCount": 1, "assignedCount": 0, "consolidatedCount": 0, "loads": {}, "fingerprint": "a" * 64}
    monkeypatch.setattr(router, "resolve_project_access", AsyncMock(return_value=access))
    monkeypatch.setattr(router, "preview_adaptation", AsyncMock(return_value=preview))
    monkeypatch.setattr(router, "adapt_reviews", AsyncMock(return_value=(preview, [])))
    db = SimpleNamespace(commit=AsyncMock())
    await router.preview_team_adaptation(7, DistributionRequest(phase="screening"), current_user=SimpleNamespace(id=1), db=db)
    db.commit.assert_not_called()
    await router.adapt_team_assignments(7, AdaptationRequest(phase="screening", fingerprint="a" * 64), current_user=SimpleNamespace(id=1), db=db)
    db.commit.assert_awaited_once()
    router.adapt_reviews.assert_awaited_once_with(db, access=access, phase="screening", fingerprint="a" * 64, actor_user_id=1)
