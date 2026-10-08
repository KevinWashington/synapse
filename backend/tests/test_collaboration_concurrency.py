import asyncio
from types import SimpleNamespace

import asyncpg
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.database import Base
from app.models.article import Article
from app.models.collaboration import ProjectNotification, ReviewAssignment
from app.models.project import Project
from app.models.user import User
from app.services.project_access_service import CAP_MANAGE_DISTRIBUTION, ProjectAccess
from app.services.review_assignment_service import distribute_reviews


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
async def test_concurrent_distribution_is_serialized_and_idempotent(assignment_database, monkeypatch):
    monkeypatch.setattr("app.services.review_assignment_service.settings.ASSIGNED_REVIEW_FLOW_ENABLED", True)
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
            assignment_count = await verification.scalar(select(func.count(ReviewAssignment.id)))
            notification_count = await verification.scalar(select(func.count(ProjectNotification.id)))
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
