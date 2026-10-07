from collections import Counter
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.review_assignment_service import build_balanced_plan, mark_reviewer_unavailable


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
