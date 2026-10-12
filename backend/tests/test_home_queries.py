from datetime import datetime, timezone

import pytest
from sqlalchemy import event
from fastapi import HTTPException

from app.models import Article, Project, ProjectMember, ReviewAssignment, User
from synthesis_test_support import synthesis_database, synthesis_session


async def seed(db, *, status="pending", phase="screening", outcome="active", role="owner", member_status="active", participates=True, reviewer=1, current_phase=None):
    for uid in (1, 2):
        if await db.get(User, uid) is None:
            db.add(User(id=uid, name=f"User {uid}", email=f"{uid}@home.test"))
    await db.flush()
    project = Project(title="Review", objetivo="Test", ownerId=1 if role == "owner" else 2)
    db.add(project)
    await db.flush()
    if role != "owner":
        db.add(ProjectMember(projectId=project.id, userId=1, role=role, status=member_status, participatesInReview=participates))
    article = Article(projectId=project.id, ownerId=project.ownerId, title="Study", authors="Author", year=2026, journal="Journal", currentPhase=current_phase or phase, reviewOutcome=outcome, createdAt=datetime(2026, 10, 1, tzinfo=timezone.utc), pdfData=b"private pdf")
    db.add(article)
    await db.flush()
    assignment = ReviewAssignment(projectId=project.id, articleId=article.id, phase=phase, reviewerUserId=reviewer, slot=1, status=status, assignedAt=datetime(2026, 10, 2, tzinfo=timezone.utc))
    db.add(assignment)
    await db.flush()
    return project, article, assignment


@pytest.mark.integration
@pytest.mark.parametrize("options", [
    {"status": "submitted"}, {"status": "cancelled"}, {"status": "needs_reassignment"},
    {"reviewer": 2}, {"current_phase": "eligibility"}, {"outcome": "excluded"},
    {"role": "reviewer", "member_status": "inactive"},
    {"role": "coordinator", "participates": False},
])
async def test_non_actionable_assignments_are_not_personal_work(synthesis_session, options):
    from app.services.home_query_service import get_home_summary, get_home_tasks
    await seed(synthesis_session, **options)
    assert await get_home_summary(synthesis_session, user_id=1) == {"screeningPending": 0, "eligibilityPending": 0}
    result = await get_home_tasks(synthesis_session, user_id=1, phase="screening", page=1, page_size=4)
    assert result["total"] == 0
    assert result["items"] == []


@pytest.mark.integration
async def test_all_projects_are_counted_and_paged_without_pdf_selection(synthesis_session):
    from app.services.home_query_service import get_home_summary, get_home_tasks
    assignments = []
    for _ in range(23):
        _, _, assignment = await seed(synthesis_session)
        assignments.append(assignment.id)
    await seed(synthesis_session, phase="eligibility", role="reviewer")
    statements = []
    engine = synthesis_session.bind.engine.sync_engine
    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)
    event.listen(engine, "before_cursor_execute", capture)
    try:
        assert await get_home_summary(synthesis_session, user_id=1) == {"screeningPending": 23, "eligibilityPending": 1}
        result = await get_home_tasks(synthesis_session, user_id=1, phase="screening", page=2, page_size=4)
        assert result["total"] == 23
        assert [item["assignmentId"] for item in result["items"]] == list(reversed(assignments))[4:8]
        assert result["page"] == 2 and result["pageSize"] == 4
        assert len(statements) <= 4
        assert all('pdfData' not in sql and 'abstract' not in sql for sql in statements)
    finally:
        event.remove(engine, "before_cursor_execute", capture)


@pytest.mark.integration
async def test_owner_without_assignment_has_zero_tasks(synthesis_session):
    from app.services.home_query_service import get_home_summary
    await seed(synthesis_session, reviewer=2)
    assert await get_home_summary(synthesis_session, user_id=1) == {"screeningPending": 0, "eligibilityPending": 0}


@pytest.mark.integration
async def test_activity_is_access_scoped_stable_and_uses_current_phase(synthesis_session):
    from app.services.home_query_service import get_home_activity
    _, article, _ = await seed(synthesis_session, phase="eligibility")
    now = datetime(2026, 10, 3, tzinfo=timezone.utc)
    article.screeningReviewedAt = now
    article.eligibilityReviewedAt = now
    article.includedAt = now
    article.currentPhase = "included"
    _, hidden, _ = await seed(synthesis_session, role="reviewer", member_status="inactive")
    hidden.includedAt = now
    await synthesis_session.flush()
    result = await get_home_activity(synthesis_session, user_id=1, page=1, page_size=2)
    second = await get_home_activity(synthesis_session, user_id=1, page=2, page_size=2)
    assert result["total"] == second["total"] == 4
    items = result["items"] + second["items"]
    assert len({item["id"] for item in items}) == 4
    assert {item["type"] for item in items} == {"created", "screening", "eligibility", "included"}
    assert all(item["articleId"] == article.id and item["phase"] == "included" for item in items)
    assert items[-1]["type"] == "created"


@pytest.mark.integration
async def test_resume_metadata_is_access_checked_without_loading_content(synthesis_session):
    from app.services.home_query_service import get_home_reading
    project, article, _ = await seed(synthesis_session)
    article.abstract = "Private abstract"
    article.notas = "Private notes"
    await synthesis_session.flush()
    statements = []
    engine = synthesis_session.bind.engine.sync_engine
    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)
    event.listen(engine, "before_cursor_execute", capture)
    try:
        result = await get_home_reading(synthesis_session, user_id=1, project_id=project.id, article_id=article.id)
        assert result == {"article": {"id": article.id, "projectId": project.id, "title": "Study", "currentPhase": "screening", "reviewOutcome": "active"}, "project": {"id": project.id, "title": "Review"}}
        with pytest.raises(HTTPException) as denied:
            await get_home_reading(synthesis_session, user_id=2, project_id=project.id, article_id=article.id)
        assert denied.value.status_code == 404
        with pytest.raises(HTTPException):
            await get_home_reading(synthesis_session, user_id=1, project_id=project.id + 100, article_id=article.id)
        assert all(all(column not in sql for column in ('pdfData', 'abstract', 'notas')) for sql in statements)
    finally:
        event.remove(engine, "before_cursor_execute", capture)
