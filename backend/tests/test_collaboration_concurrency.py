import asyncio
from types import SimpleNamespace

import asyncpg
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.database import Base
from app.models.article import Article
from app.models.collaboration import (
    ProjectMember,
    ProjectNotification,
    ReviewAssignment,
    ReviewConflict,
    ReviewDecision,
)
from app.models.project import Project
from app.models.user import User
from app.schemas.article import ScreeningDecisionRequest
from app.services.project_access_service import (
    CAP_MANAGE_DISTRIBUTION,
    CAP_REVIEW_ASSIGNED,
    ProjectAccess,
)
from app.services.review_assignment_service import distribute_reviews
from app.services.review_decision_service import submit_review_decision
from app.services.review_adaptation_service import preview_adaptation, adapt_reviews
from app.services.review_assignment_service import mark_reviewer_unavailable
from app.services.team_lock_service import lock_project_team


DATABASE = "synapse_assignment_concurrency_test"
URL = f"postgresql+asyncpg://synapse:synapse@localhost:5432/{DATABASE}"


def test_active_assignment_slot_index_treats_reassignment_as_occupied():
    index = next(item for item in ReviewAssignment.__table__.indexes if item.name == "uq_review_assignments_active_slot")

    assert "status <> 'cancelled'" in str(index.dialect_options["postgresql"]["where"])


@pytest.fixture(scope="module")
def assignment_database():
    async def reset(create: bool) -> None:
        connection = await asyncpg.connect("postgresql://synapse:synapse@localhost:5432/postgres")
        try:
            await connection.execute(f'DROP DATABASE IF EXISTS "{DATABASE}"')
            if create:
                await connection.execute(f'CREATE DATABASE "{DATABASE}"')
        finally:
            await connection.close()
        if create:
            engine = create_async_engine(URL)
            async with engine.begin() as database_connection:
                await database_connection.run_sync(Base.metadata.create_all)
            await engine.dispose()

    asyncio.run(reset(True))
    yield
    asyncio.run(reset(False))


@pytest.mark.asyncio
async def test_removal_waits_for_adaptation_then_invalidates_new_assignments(assignment_database):
    engine = create_async_engine(URL)
    first_session = AsyncSession(engine, expire_on_commit=False)
    second_session = AsyncSession(engine, expire_on_commit=False)
    try:
        async with AsyncSession(engine, expire_on_commit=False) as setup:
            owner = User(name="Adaptation owner", email="owner@adapt-lock.test")
            reviewer = User(name="Leaving reviewer", email="reviewer@adapt-lock.test")
            setup.add_all([owner, reviewer])
            await setup.flush()
            project = Project(title="Adaptation race", objetivo="Test", ownerId=owner.id)
            setup.add(project)
            await setup.flush()
            member = ProjectMember(projectId=project.id, userId=reviewer.id, role="reviewer", status="active", participatesInReview=True)
            article = Article(projectId=project.id, ownerId=owner.id, title="Race fixture", authors="QA", year=2026, journal="QA", currentPhase="screening", reviewOutcome="active")
            setup.add_all([member, article])
            await setup.flush()
            setup.add(ReviewAssignment(projectId=project.id, articleId=article.id, phase="screening", reviewerUserId=owner.id, slot=1, status="pending"))
            await setup.commit()
        access = ProjectAccess(project=project, role="owner", capabilities=frozenset({CAP_MANAGE_DISTRIBUTION}), participates_in_review=True)
        preview = await preview_adaptation(first_session, access=access, phase="screening")
        assert preview["assignedCount"] == 1
        await adapt_reviews(first_session, access=access, phase="screening", fingerprint=preview["fingerprint"], actor_user_id=owner.id)

        async def remove_reviewer():
            await lock_project_team(second_session, project.id)
            row = (await second_session.execute(select(ProjectMember).where(ProjectMember.id == member.id))).scalar_one()
            row.status = "inactive"
            count = await mark_reviewer_unavailable(second_session, project_id=project.id, reviewer_user_id=reviewer.id)
            await second_session.commit()
            return count

        removal = asyncio.create_task(remove_reviewer())
        try:
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(asyncio.shield(removal), timeout=0.2)
            await first_session.commit()
            assert await asyncio.wait_for(removal, timeout=5) == 1
            async with AsyncSession(engine) as check:
                replacement = (await check.execute(select(ReviewAssignment).where(ReviewAssignment.articleId == article.id, ReviewAssignment.reviewerUserId == reviewer.id))).scalar_one()
                assert replacement.status == "needs_reassignment"
        finally:
            if not removal.done():
                removal.cancel()
                await asyncio.gather(removal, return_exceptions=True)
    finally:
        await first_session.close()
        await second_session.close()
        await engine.dispose()


@pytest.mark.asyncio
async def test_concurrent_distribution_is_serialized_and_idempotent(assignment_database):
    engine = create_async_engine(URL)
    session_one = AsyncSession(engine, expire_on_commit=False)
    session_two = AsyncSession(engine, expire_on_commit=False)
    try:
        async with AsyncSession(engine, expire_on_commit=False) as setup:
            owner = User(name="Owner", email="owner@distribution.test")
            setup.add(owner)
            await setup.flush()
            project = Project(title="Concurrent distribution", objetivo="Test", ownerId=owner.id)
            setup.add(project)
            await setup.flush()
            setup.add(
                Article(
                    projectId=project.id,
                    ownerId=owner.id,
                    title="Concurrent study",
                    authors="Author",
                    year=2026,
                    journal="Journal",
                    currentPhase="screening",
                )
            )
            await setup.commit()
            project_id = project.id
            owner_id = owner.id

        access = ProjectAccess(
            project=SimpleNamespace(id=project_id, ownerId=owner_id),
            role="owner",
            capabilities=frozenset({CAP_MANAGE_DISTRIBUTION}),
            participates_in_review=True,
        )

        first = await distribute_reviews(
            session_one,
            access=access,
            phase="screening",
            assigned_by_user_id=owner_id,
        )
        assert first.article_count == 1

        async def run_second_distribution():
            result = await distribute_reviews(
                session_two,
                access=access,
                phase="screening",
                assigned_by_user_id=owner_id,
            )
            await session_two.commit()
            return result

        second_task = asyncio.create_task(run_second_distribution())
        await asyncio.sleep(0.1)
        assert not second_task.done()

        await session_one.commit()
        second = await asyncio.wait_for(second_task, timeout=2)

        assert second.article_count == 0
        assert second.assignments == ()
        async with AsyncSession(engine) as verification:
            assignment_count = await verification.scalar(select(func.count(ReviewAssignment.id)).where(ReviewAssignment.projectId == project_id))
            notification_count = await verification.scalar(select(func.count(ProjectNotification.id)).where(ProjectNotification.projectId == project_id))
        assert assignment_count == 1
        assert notification_count == 1
    finally:
        if session_one.in_transaction():
            await session_one.rollback()
        if session_two.in_transaction():
            await session_two.rollback()
        await session_one.close()
        await session_two.close()
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "second_value,expected_state,expected_outcome,expected_conflicts,expected_notifications",
    [
        ("excluded", "consolidated", "excluded_screening", 0, 0),
        ("included", "conflict", "active", 1, 1),
    ],
)
async def test_concurrent_decisions_finalize_exactly_once(
    assignment_database,
    second_value,
    expected_state,
    expected_outcome,
    expected_conflicts,
    expected_notifications,
):
    engine = create_async_engine(URL)
    session_one = AsyncSession(engine, expire_on_commit=False)
    session_two = AsyncSession(engine, expire_on_commit=False)
    try:
        async with AsyncSession(engine, expire_on_commit=False) as setup:
            owner = User(name="Decision owner", email=f"owner-{second_value}@decision.test")
            reviewer_one = User(name="Reviewer one", email=f"one-{second_value}@decision.test")
            reviewer_two = User(name="Reviewer two", email=f"two-{second_value}@decision.test")
            setup.add_all([owner, reviewer_one, reviewer_two])
            await setup.flush()
            project = Project(title="Concurrent decisions", objetivo="Test", ownerId=owner.id)
            setup.add(project)
            await setup.flush()
            setup.add_all([
                ProjectMember(projectId=project.id, userId=reviewer_one.id, role="reviewer", status="active", participatesInReview=True),
                ProjectMember(projectId=project.id, userId=reviewer_two.id, role="reviewer", status="active", participatesInReview=True),
            ])
            article = Article(
                projectId=project.id,
                ownerId=owner.id,
                title="Concurrent decision study",
                authors="Author",
                year=2026,
                journal="Journal",
                currentPhase="screening",
            )
            setup.add(article)
            await setup.flush()
            setup.add_all([
                ReviewAssignment(projectId=project.id, articleId=article.id, reviewerUserId=reviewer_one.id, assignedByUserId=owner.id, phase="screening", slot=1, status="pending"),
                ReviewAssignment(projectId=project.id, articleId=article.id, reviewerUserId=reviewer_two.id, assignedByUserId=owner.id, phase="screening", slot=2, status="pending"),
            ])
            await setup.commit()
            project_id, article_id, owner_id = project.id, article.id, owner.id
            reviewer_one_id, reviewer_two_id = reviewer_one.id, reviewer_two.id

        project_ref = SimpleNamespace(id=project_id, ownerId=owner_id, qualityAssessmentSchema=[])
        access_one = ProjectAccess(project_ref, "reviewer", frozenset({CAP_REVIEW_ASSIGNED}), True)
        access_two = ProjectAccess(project_ref, "reviewer", frozenset({CAP_REVIEW_ASSIGNED}), True)

        first = await submit_review_decision(
            session_one,
            access=access_one,
            article_id=article_id,
            phase="screening",
            payload=ScreeningDecisionRequest(decision="excluded", reasonText="Fora do escopo"),
            reviewer_user_id=reviewer_one_id,
        )
        assert first.state == "waiting_for_reviewer"

        async def submit_second():
            result = await submit_review_decision(
                session_two,
                access=access_two,
                article_id=article_id,
                phase="screening",
                payload=ScreeningDecisionRequest(
                    decision=second_value,
                    reasonText="Fora do escopo" if second_value == "excluded" else None,
                ),
                reviewer_user_id=reviewer_two_id,
            )
            await session_two.commit()
            return result

        second_task = asyncio.create_task(submit_second())
        await asyncio.sleep(0.1)
        assert not second_task.done()
        await session_one.commit()
        second = await asyncio.wait_for(second_task, timeout=2)
        assert second.state == expected_state

        async with AsyncSession(engine) as verification:
            outcome = await verification.scalar(select(Article.reviewOutcome).where(Article.id == article_id))
            decision_count = await verification.scalar(select(func.count(ReviewDecision.id)).where(ReviewDecision.articleId == article_id))
            conflict_count = await verification.scalar(select(func.count(ReviewConflict.id)).where(ReviewConflict.articleId == article_id))
            notification_count = await verification.scalar(select(func.count(ProjectNotification.id)).where(ProjectNotification.projectId == project_id))
        assert outcome == expected_outcome
        assert decision_count == 2
        assert conflict_count == expected_conflicts
        assert notification_count == expected_notifications
    finally:
        if session_one.in_transaction():
            await session_one.rollback()
        if session_two.in_transaction():
            await session_two.rollback()
        await session_one.close()
        await session_two.close()
        await engine.dispose()
