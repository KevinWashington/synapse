"""Exercise implicit commit failures with the driver's real session cleanup."""

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.services import neo4j_service
from app.services.article_index_jobs_service import process_article_index_task
from app.services.article_index_service import ArticleIndexService
from app.services.neo4j_service import Neo4jService
from neo4j._async.work.session import AsyncSession
from neo4j._conf import SessionConfig
from neo4j.exceptions import ClientError


def service_with_result(consume):
    session = AsyncSession(MagicMock(), SessionConfig())
    result = SimpleNamespace(consume=consume, _bookmark=None)

    async def run(*args, **kwargs):
        session._connection = SimpleNamespace(send_all=AsyncMock(), fetch_all=AsyncMock())
        session._auto_result = result
        return result

    async def disconnect(*args, **kwargs):
        session._connection = None

    session.run = AsyncMock(side_effect=run)
    session._disconnect = disconnect
    service = Neo4jService()
    service._driver = SimpleNamespace(session=lambda: session)
    return service, session


WRITES = [
    ("create_article_node", (1, "paper", 2, "Title", "Author", 2026)),
    ("delete_article_node", (1,)),
    ("create_semantic_relationship", (1, 2, 0.9)),
    ("create_same_methodology_relationship", (1, 2)),
    ("create_same_author_relationship", (1, 2, ["Author"])),
    ("create_shared_keyword_relationship", (1, 2, ["topic"])),
    ("create_same_venue_relationship", (1, 2, "Venue")),
    ("delete_project_graph", (2,)),
]


@pytest.mark.parametrize("method,args", WRITES)
async def test_implicit_commit_failure_is_not_swallowed_by_session_close(method, args):
    service, _ = service_with_result(AsyncMock(side_effect=ClientError("commit failed")))
    with pytest.raises(ClientError, match="commit failed"):
        await getattr(service, method)(*args)


async def test_entity_writes_confirm_the_last_result():
    consume = AsyncMock(side_effect=ClientError("entity commit failed"))
    service, _ = service_with_result(consume)
    with pytest.raises(ClientError, match="entity commit failed"):
        await service.sync_article_entities(
            article_id=1, project_id=2, authors=[], keywords=[], venue="Venue"
        )


async def test_success_waits_for_write_confirmation():
    entered, release = asyncio.Event(), asyncio.Event()

    async def consume():
        entered.set()
        await release.wait()

    service, _ = service_with_result(consume)
    operation = asyncio.create_task(service.delete_article_node(1))
    await asyncio.wait_for(entered.wait(), timeout=1)
    assert not operation.done()
    release.set()
    await operation


async def test_write_timeout_includes_result_consumption(monkeypatch):
    monkeypatch.setattr(neo4j_service, "QUERY_TIMEOUT", 0.01, raising=False)
    service = session = None

    async def consume():
        try:
            await asyncio.Event().wait()
        finally:
            # Like the driver, cancellation discards the active result/connection.
            session._auto_result = None

    service, session = service_with_result(consume)
    with pytest.raises(TimeoutError):
        await asyncio.wait_for(service.delete_article_node(1), timeout=0.5)
    assert session._closed, "the internal timeout must close the session before returning"


async def test_worker_retries_when_graph_commit_fails_then_confirms_success():
    consume = AsyncMock(side_effect=ClientError("commit failed"))
    neo4j, session = service_with_result(consume)

    async def sync_graph(article, db, embedding=None):
        await neo4j.create_article_node(article.id, None, article.projectId, "T", "A", 2026)

    index = ArticleIndexService(
        SimpleNamespace(sync_article_to_graph=sync_graph),
        SimpleNamespace(get_article_point=AsyncMock(return_value=None)),
        None,
    )
    task = SimpleNamespace(
        id=1,
        articleId=1,
        projectId=2,
        attempts=0,
        status="queued",
        completedAt=None,
        lastError=None,
        nextAttemptAt=datetime.now(timezone.utc),
    )
    article = SimpleNamespace(id=1, projectId=2, reviewOutcome="included", abstract=None)
    db = MagicMock()
    db.scalar = AsyncMock(side_effect=[task, article, task, article])
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.__aenter__ = AsyncMock(return_value=db)
    db.__aexit__ = AsyncMock(return_value=False)
    await process_article_index_task(1, session_factory=lambda: db, index_service=index)
    assert task.status == "queued"
    assert task.lastError == "INDEX_SYNC_FAILED"
    assert task.nextAttemptAt > datetime.now(timezone.utc)
    assert task.completedAt is None

    consume.side_effect = None
    session._closed = False
    await process_article_index_task(1, session_factory=lambda: db, index_service=index)
    assert task.status == "succeeded"
    assert task.attempts == 2
    assert task.lastError is None


async def test_health_does_not_report_success_before_consumption():
    service, _ = service_with_result(AsyncMock(side_effect=ClientError("health failed")))
    assert (await service.mcp_health())["connected"] is False
