from app.services.project_access_service import capabilities_for_role


def test_reviewer_can_read_every_article_but_only_review_assigned_items():
    capabilities = capabilities_for_role("reviewer", participates_in_review=True)

    assert "read_project" in capabilities
    assert "review_assigned" in capabilities
    assert "edit_project" not in capabilities
    assert "manage_members" not in capabilities


def test_inactive_coordinator_has_no_capabilities():
    assert capabilities_for_role("coordinator", participates_in_review=True, active=False) == frozenset()
