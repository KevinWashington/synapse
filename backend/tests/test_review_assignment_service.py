from collections import Counter
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.services.project_access_service import CAP_MANAGE_DISTRIBUTION, ProjectAccess
from app.services.review_assignment_service import (
    build_balanced_plan,
    mark_reviewer_unavailable,
    reassign_review,
)


def test_distribution_requires_at_least_one_eligible_reviewer():
    with pytest.raises(ValueError, match="revisor"):
        build_balanced_plan([1], [], {})


def test_one_reviewer_receives_one_slot_per_article():
    plan = build_balanced_plan([10, 11, 12], [7], {7: 0})

    assert [(item.article_id, item.reviewer_user_id, item.slot) for item in plan] == [
        (10, 7, 1),
        (11, 7, 1),
        (12, 7, 1),
    ]


def test_two_or_more_reviewers_receive_distinct_balanced_pairs():
    plan = build_balanced_plan([10, 11, 12, 13], [3, 1, 2], {1: 0, 2: 0, 3: 0})

    grouped = {}
    for item in plan:
        grouped.setdefault(item.article_id, []).append(item.reviewer_user_id)
    assert all(len(reviewers) == 2 and len(set(reviewers)) == 2 for reviewers in grouped.values())
    loads = Counter(item.reviewer_user_id for item in plan)
    assert max(loads.values()) - min(loads.values()) <= 1
    assert grouped[10] == [1, 2]


def test_existing_pending_load_is_used_with_stable_user_id_tiebreak():
    plan = build_balanced_plan([10], [5, 2, 9], {2: 4, 5: 1, 9: 1})

    assert [item.reviewer_user_id for item in plan] == [5, 9]


@pytest.mark.asyncio
async def test_removed_reviewer_assignments_are_marked_for_reassignment():
    assignments = [SimpleNamespace(status="pending"), SimpleNamespace(status="submitted")]
    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: assignments))
    db = SimpleNamespace(execute=AsyncMock(return_value=result))

    changed = await mark_reviewer_unavailable(db, project_id=7, reviewer_user_id=22)

    assert changed == 1
    assert assignments[0].status == "needs_reassignment"
    assert assignments[1].status == "submitted"


@pytest.mark.asyncio
async def test_reassignment_notifies_reviewer_and_records_audit(monkeypatch):
    previous = SimpleNamespace(
        id=31,
        projectId=7,
        articleId=12,
        phase="screening",
        reviewerUserId=22,
        slot=2,
        status="needs_reassignment",
        cancelledAt=None,
        inheritedFromAssignmentId=None,
    )
    member = SimpleNamespace(userId=44, role="reviewer", participatesInReview=True)
    previous_result = SimpleNamespace(scalar_one_or_none=lambda: previous)
    members_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [member]))
    duplicate_result = SimpleNamespace(scalar_one_or_none=lambda: None)
    added = []

    async def assign_generated_id():
        added[0].id = 32

    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[previous_result, members_result, duplicate_result]),
        add=Mock(side_effect=added.append),
        flush=AsyncMock(side_effect=assign_generated_id),
    )
    access = ProjectAccess(
        project=SimpleNamespace(id=7, ownerId=1),
        role="owner",
        capabilities=frozenset({CAP_MANAGE_DISTRIBUTION}),
        participates_in_review=True,
    )
    notification = Mock()
    audit = Mock()
    monkeypatch.setattr("app.services.review_assignment_service.settings.ASSIGNED_REVIEW_FLOW_ENABLED", True)
    monkeypatch.setattr("app.services.review_assignment_service.create_notification", notification)
    monkeypatch.setattr("app.services.review_assignment_service.create_audit_event", audit)

    replacement = await reassign_review(
        db,
        access=access,
        assignment_id=31,
        reviewer_user_id=44,
        assigned_by_user_id=1,
    )

    assert previous.status == "cancelled"
    assert previous.cancelledAt is not None
    assert previous.cancelledAt.tzinfo is not None
    assert replacement.reviewerUserId == 44
    notification.assert_called_once_with(
        db,
        project_id=7,
        recipient_user_id=44,
        type="review_reassigned",
        title="Revisão reatribuída",
        body="Um artigo foi reatribuído a você na etapa de screening.",
        entity_type="article",
        entity_id=12,
        payload={"phase": "screening", "assignmentId": 32},
    )
    audit.assert_called_once_with(
        db,
        project_id=7,
        actor_user_id=1,
        action="review_reassigned",
        entity_type="assignment",
        entity_id=32,
        payload={"articleId": 12, "phase": "screening", "previousReviewerUserId": 22, "reviewerUserId": 44},
    )
