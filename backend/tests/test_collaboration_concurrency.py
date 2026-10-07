from app.models.collaboration import ReviewAssignment


def test_active_assignment_slot_index_treats_reassignment_as_occupied():
    index = next(item for item in ReviewAssignment.__table__.indexes if item.name == "uq_review_assignments_active_slot")

    assert "status <> 'cancelled'" in str(index.dialect_options["postgresql"]["where"])
