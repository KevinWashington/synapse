"""Transactional outbox for graph/vector projections.

Workers keep row and per-article transaction locks through external writes. A crash
rolls back the claim, so no lease recovery is required. Requests enqueue before
commit under the same article lock; later work always reads current SQL state.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from app.models.article import Article
from app.models.article_index import ArticleIndexTask

logger = logging.getLogger(__name__)
RETRY_DELAYS = (5, 15, 60, 300)
LOCK_NAMESPACE = 190431


async def lock_article_index(db, article_id: int) -> None:
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:namespace, :article_id)"),
        {"namespace": LOCK_NAMESPACE, "article_id": article_id},
    )


async def enqueue_article_index(db, *, article_id: int, project_id: int) -> None:
    await lock_article_index(db, article_id)
    db.add(ArticleIndexTask(articleId=article_id, projectId=project_id))
    await db.flush()


async def process_article_index_task(task_id: int, *, session_factory, index_service) -> None:
    async with session_factory() as db:
        task = await db.scalar(
            select(ArticleIndexTask)
            .where(
                ArticleIndexTask.id == task_id,
                ArticleIndexTask.status == "queued",
                ArticleIndexTask.nextAttemptAt <= datetime.now(timezone.utc),
            )
            .with_for_update(skip_locked=True)
        )
        if task is None:
            return
        await lock_article_index(db, task.articleId)
        # No snapshot/entity is carried from the originating request.
        article = await db.scalar(
            select(Article).where(Article.id == task.articleId, Article.projectId == task.projectId)
        )
        task.attempts += 1
        try:
            operation = (
                index_service.sync(article, db)
                if article is not None
                else index_service.remove(article_id=task.articleId, project_id=task.projectId)
            )
            await operation
        except asyncio.CancelledError:
            raise  # Transaction rollback releases both claims for restart.
        except Exception:
            logger.exception("Index task %s failed on attempt %s", task.id, task.attempts)
            task.lastError = "INDEX_SYNC_FAILED"
            if task.attempts >= 5:
                task.status = "failed"
                task.completedAt = datetime.now(timezone.utc)
            else:
                task.nextAttemptAt = datetime.now(timezone.utc) + timedelta(
                    seconds=RETRY_DELAYS[task.attempts - 1]
                )
        else:
            task.status = "succeeded"
            task.lastError = None
            task.completedAt = datetime.now(timezone.utc)
        await db.commit()


async def pending_article_index_tasks(db, *, limit=20) -> list[int]:
    return list(
        (
            await db.scalars(
                select(ArticleIndexTask.id)
                .where(
                    ArticleIndexTask.status == "queued",
                    ArticleIndexTask.nextAttemptAt <= datetime.now(timezone.utc),
                )
                .order_by(ArticleIndexTask.id)
                .limit(limit)
            )
        ).all()
    )


async def reconcile_project_indexes(db, *, project_id: int, apply: bool = False) -> list[int]:
    """Inspect SQL and historical job IDs; apply also cleans deleted articles."""
    current = set(
        (await db.scalars(select(Article.id).where(Article.projectId == project_id))).all()
    )
    historical = set(
        (
            await db.scalars(
                select(ArticleIndexTask.articleId).where(ArticleIndexTask.projectId == project_id)
            )
        ).all()
    )
    ids = sorted(current | historical)
    if apply:
        for article_id in ids:
            await enqueue_article_index(db, article_id=article_id, project_id=project_id)
        failed = (
            await db.scalars(
                select(ArticleIndexTask).where(
                    ArticleIndexTask.projectId == project_id, ArticleIndexTask.status == "failed"
                )
            )
        ).all()
        for task in failed:
            task.status = "queued"
            task.attempts = 0
            task.nextAttemptAt = datetime.now(timezone.utc)
            task.completedAt = None
            task.lastError = None
    return ids
