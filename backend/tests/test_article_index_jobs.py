import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from app.database import Base
from app.models.article import Article
from app.models.article_index import ArticleIndexTask
from app.models.project import Project
from app.models.user import User
from app.services.article_index_jobs_service import (
    enqueue_article_index,
    process_article_index_task,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from db_test_support import (
    create_test_database,
    database_url_for_test,
    drop_test_database,
    new_test_database,
)


@pytest_asyncio.fixture
async def index_db():
    name = new_test_database("article_index")
    url = database_url_for_test(name)
    await create_test_database(name)
    engine = create_async_engine(url)
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as db:
            user = User(name="Indexer", email=f"{name}@test.local", passwordHash="unused")
            db.add(user)
            await db.flush()
            project = Project(
                title="Index test",
                objetivo="Test index recovery",
                ownerId=user.id,
                framework="PICO",
            )
            db.add(project)
            await db.flush()
            article = Article(
                title="Study",
                authors="Author",
                year=2025,
                journal="Journal",
                projectId=project.id,
                ownerId=user.id,
                reviewOutcome="included",
                currentPhase="included",
                paperId="study",
            )
            db.add(article)
            await db.commit()
            yield factory, article.id, project.id
    finally:
        await engine.dispose()
        await drop_test_database(name)


@pytest.mark.asyncio
async def test_queue_participates_in_mutation_transaction(index_db):
    factory, article_id, project_id = index_db
    async with factory() as db:
        await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        await db.rollback()
    async with factory() as db:
        assert (await db.scalars(select(ArticleIndexTask))).all() == []
        await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        await db.commit()
        assert len((await db.scalars(select(ArticleIndexTask))).all()) == 1


@pytest.mark.asyncio
async def test_failure_retries_then_survives_new_worker(index_db):
    factory, article_id, project_id = index_db
    async with factory() as db:
        await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        await db.commit()
        task_id = await db.scalar(select(ArticleIndexTask.id))
    service = AsyncMock()
    service.sync.side_effect = RuntimeError("private provider details")
    await process_article_index_task(task_id, session_factory=factory, index_service=service)
    async with factory() as db:
        task = await db.get(ArticleIndexTask, task_id)
        assert task.status == "queued"
        assert task.attempts == 1
        assert task.lastError == "INDEX_SYNC_FAILED"
        assert task.nextAttemptAt > datetime.now(timezone.utc)
        task.nextAttemptAt = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.commit()
    service.sync.side_effect = None
    await process_article_index_task(task_id, session_factory=factory, index_service=service)
    async with factory() as db:
        task = await db.get(ArticleIndexTask, task_id)
        assert task.status == "succeeded"
        assert task.attempts == 2


@pytest.mark.asyncio
async def test_old_update_task_reads_deletion_and_never_upserts(index_db):
    factory, article_id, project_id = index_db
    async with factory() as db:
        await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        await db.commit()
        task_id = await db.scalar(select(ArticleIndexTask.id))
        await db.delete(await db.get(Article, article_id))
        await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        await db.commit()
    service = AsyncMock()
    await process_article_index_task(task_id, session_factory=factory, index_service=service)
    service.sync.assert_not_awaited()
    service.remove.assert_awaited_once_with(article_id=article_id, project_id=project_id)


@pytest.mark.asyncio
async def test_workers_serialize_same_article_and_delete_wins(index_db):
    factory, article_id, project_id = index_db
    async with factory() as db:
        await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        await db.commit()
        ids = list(
            (await db.scalars(select(ArticleIndexTask.id).order_by(ArticleIndexTask.id))).all()
        )
    entered, release = asyncio.Event(), asyncio.Event()
    active = 0
    maximum = 0

    async def slow_sync(article, db):
        nonlocal active, maximum
        active += 1
        maximum = max(maximum, active)
        entered.set()
        await release.wait()
        active -= 1

    service = AsyncMock()
    service.sync.side_effect = slow_sync
    first = asyncio.create_task(
        process_article_index_task(ids[0], session_factory=factory, index_service=service)
    )
    await asyncio.wait_for(entered.wait(), timeout=5)
    second = asyncio.create_task(
        process_article_index_task(ids[1], session_factory=factory, index_service=service)
    )

    async def delete():
        async with factory() as db:
            await db.delete(await db.get(Article, article_id))
            await enqueue_article_index(db, article_id=article_id, project_id=project_id)
            await db.commit()

    deletion = asyncio.create_task(delete())
    await asyncio.sleep(0.05)
    release.set()
    await asyncio.wait_for(asyncio.gather(first, second, deletion), timeout=5)
    async with factory() as db:
        pending = list(
            (
                await db.scalars(
                    select(ArticleIndexTask.id).where(ArticleIndexTask.status == "queued")
                )
            ).all()
        )
    for task_id in pending:
        await process_article_index_task(task_id, session_factory=factory, index_service=service)
    assert maximum == 1
    service.remove.assert_awaited()


@pytest.mark.asyncio
async def test_exhausted_task_remains_visible(index_db):
    factory, article_id, project_id = index_db
    service = AsyncMock()
    service.sync.side_effect = RuntimeError("outage")
    async with factory() as db:
        await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        await db.commit()
        task_id = await db.scalar(select(ArticleIndexTask.id))
    for attempt in range(5):
        async with factory() as db:
            task = await db.get(ArticleIndexTask, task_id)
            task.nextAttemptAt = datetime.now(timezone.utc) - timedelta(seconds=1)
            await db.commit()
        await process_article_index_task(task_id, session_factory=factory, index_service=service)
    async with factory() as db:
        task = await db.get(ArticleIndexTask, task_id)
        assert (task.status, task.attempts) == ("failed", 5)


@pytest.mark.asyncio
async def test_duplicate_removal_enqueues_cleanup_for_previously_included_article(index_db):
    from app.routers.articles import apply_duplicate_decisions
    from app.schemas.article import DedupApplyRequest

    factory, article_id, project_id = index_db
    async with factory() as db:
        duplicate = await db.get(Article, article_id)
        owner = await db.get(User, duplicate.ownerId)
        canonical = Article(
            title="Canonical",
            authors="Author",
            year=2025,
            journal="Journal",
            projectId=project_id,
            ownerId=owner.id,
            duplicateGroupKey="group",
        )
        db.add(canonical)
        await db.commit()
        await apply_duplicate_decisions(
            project_id,
            DedupApplyRequest(
                decisions=[
                    {
                        "groupKey": "group",
                        "canonicalArticleId": canonical.id,
                        "duplicateArticleIds": [article_id],
                        "reasonCode": "same_doi",
                    }
                ]
            ),
            owner,
            db,
        )
        task_id = await db.scalar(
            select(ArticleIndexTask.id).where(ArticleIndexTask.articleId == article_id)
        )
        assert task_id is not None
    service = AsyncMock()
    await process_article_index_task(task_id, session_factory=factory, index_service=service)
    service.sync.assert_awaited_once()
    assert service.sync.call_args.args[0].reviewOutcome == "duplicate_removed"


@pytest.mark.asyncio
async def test_worker_cancellation_releases_claim_for_restart(index_db):
    factory, article_id, project_id = index_db
    async with factory() as db:
        await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        await db.commit()
        task_id = await db.scalar(select(ArticleIndexTask.id))
    entered = asyncio.Event()

    async def stalled(*args):
        entered.set()
        await asyncio.Event().wait()

    service = AsyncMock()
    service.sync.side_effect = stalled
    worker = asyncio.create_task(
        process_article_index_task(task_id, session_factory=factory, index_service=service)
    )
    await asyncio.wait_for(entered.wait(), timeout=5)
    worker.cancel()
    with pytest.raises(asyncio.CancelledError):
        await worker
    service.sync.side_effect = None
    await process_article_index_task(task_id, session_factory=factory, index_service=service)
    async with factory() as db:
        task = await db.get(ArticleIndexTask, task_id)
        assert (task.status, task.attempts) == ("succeeded", 1)


@pytest.mark.asyncio
async def test_project_delete_blocks_new_article_until_cleanup_is_recorded(index_db):
    from app.routers.projects import delete_project
    from sqlalchemy.exc import IntegrityError

    factory, article_id, project_id = index_db
    async with factory() as db:
        article = await db.get(Article, article_id)
        owner_id = article.ownerId
        await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        await db.commit()
        task_id = await db.scalar(select(ArticleIndexTask.id))
    entered, release = asyncio.Event(), asyncio.Event()
    service = AsyncMock()

    async def slow_sync(*args):
        entered.set()
        await release.wait()

    service.sync.side_effect = slow_sync
    worker = asyncio.create_task(
        process_article_index_task(task_id, session_factory=factory, index_service=service)
    )
    await asyncio.wait_for(entered.wait(), timeout=5)

    async def delete():
        async with factory() as db:
            await delete_project(project_id, await db.get(User, owner_id), db)

    deletion = asyncio.create_task(delete())
    # Wait for the project row lock without relying on scheduling delays.
    async with factory() as db:
        for _ in range(100):
            from sqlalchemy import text

            locked = await db.scalar(
                text(
                    "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE relation = 'projects'::regclass AND mode = 'RowShareLock')"
                )
            )
            if locked:
                break
            await asyncio.sleep(0.01)
        assert locked

    async def insert():
        async with factory() as db:
            db.add(
                Article(
                    title="Concurrent",
                    authors="Author",
                    year=2025,
                    journal="Journal",
                    projectId=project_id,
                    ownerId=owner_id,
                )
            )
            with pytest.raises(IntegrityError):
                await db.commit()

    insertion = asyncio.create_task(insert())
    await asyncio.sleep(0.05)
    assert not insertion.done()
    release.set()
    await asyncio.wait_for(asyncio.gather(worker, deletion, insertion), timeout=10)
    async with factory() as db:
        assert await db.get(Project, project_id) is None
        assert (
            await db.scalar(select(ArticleIndexTask.id).where(ArticleIndexTask.status == "queued"))
            is not None
        )
