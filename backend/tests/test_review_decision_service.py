from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.services.review_decision_service import (
    _inherit_eligibility_assignments,
    resolution_state,
    visible_decision_payloads,
)


def decision(user_id, value, reason="reason"):
    return SimpleNamespace(
        id=user_id,
        reviewerUserId=user_id,
        decision=value,
        reasonText=reason,
        checklistAnswers={"q1": True},
        answeringRQs=[1],
        status="submitted",
    )


def test_resolution_waits_until_every_active_assignment_submits():
    assert resolution_state([decision(1, "included")], assignment_count=2) == "waiting_for_reviewer"


def test_resolution_consolidates_one_or_equal_dual_decisions():
    assert resolution_state([decision(1, "included")], assignment_count=1) == "consolidated"
    assert resolution_state([decision(1, "excluded"), decision(2, "excluded")], assignment_count=2) == "consolidated"


def test_resolution_opens_conflict_for_different_decisions():
    assert resolution_state([decision(1, "included"), decision(2, "excluded")], assignment_count=2) == "conflict"


def test_peer_decision_is_redacted_until_set_is_complete():
    values = visible_decision_payloads(
        [decision(1, "included"), decision(2, "excluded")],
        current_user_id=1,
        complete=False,
    )

    assert values[0]["decision"] == "included"
    assert values[1] == {"reviewerUserId": 2, "status": "submitted"}


def test_all_decisions_are_visible_after_completion():
    values = visible_decision_payloads(
        [decision(1, "included"), decision(2, "excluded")],
        current_user_id=1,
        complete=True,
    )

    assert [value["decision"] for value in values] == ["included", "excluded"]


def test_resolution_rejects_more_decisions_than_assignments():
    with pytest.raises(ValueError, match="atribuições"):
        resolution_state([decision(1, "included"), decision(2, "included")], assignment_count=1)


@pytest.mark.asyncio
async def test_eligibility_inheritance_reuses_historical_assignment_rows():
    screening = [
        SimpleNamespace(id=1, projectId=7, articleId=10, reviewerUserId=21, slot=1),
        SimpleNamespace(id=2, projectId=7, articleId=10, reviewerUserId=22, slot=2),
    ]
    existing = SimpleNamespace(reviewerUserId=21, status="cancelled", slot=1, submittedAt="old", inheritedFromAssignmentId=None)
    active_member = SimpleNamespace(userId=22, role="reviewer", participatesInReview=True)
    db = SimpleNamespace(
        execute=AsyncMock(side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [existing])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [active_member])),
        ]),
        add=Mock(),
    )

    await _inherit_eligibility_assignments(
        db,
        article=SimpleNamespace(id=10),
        assignments=screening,
        actor_user_id=9,
        owner_user_id=21,
    )

    assert existing.status == "pending"
    assert existing.submittedAt is None
    assert existing.inheritedFromAssignmentId == 1
    added_assignment = next(call.args[0] for call in db.add.call_args_list if hasattr(call.args[0], "reviewerUserId"))
    assert added_assignment.reviewerUserId == 22


@pytest.mark.asyncio
async def test_eligibility_inheritance_marks_inactive_reviewer_for_reassignment():
    screening = [SimpleNamespace(id=1, projectId=7, articleId=10, reviewerUserId=21, slot=1)]
    results = [
        SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [])),
        SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [])),
        SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [])),
    ]
    db = SimpleNamespace(execute=AsyncMock(side_effect=results), add=Mock())

    await _inherit_eligibility_assignments(
        db,
        article=SimpleNamespace(id=10),
        assignments=screening,
        actor_user_id=9,
        owner_user_id=99,
    )

    inherited = next(call.args[0] for call in db.add.call_args_list if hasattr(call.args[0], "reviewerUserId"))
    assert inherited.reviewerUserId == 21
    assert inherited.status == "needs_reassignment"
