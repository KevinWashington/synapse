from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.routers import articles


@pytest.mark.asyncio
async def test_index_sync_failure_does_not_turn_a_committed_decision_into_an_error(monkeypatch):
    monkeypatch.setattr(
        articles,
        "_sync_article_graph_state",
        AsyncMock(side_effect=RuntimeError("neo4j unavailable")),
    )
    monkeypatch.setattr(articles, "_sync_article_vector_payload", AsyncMock())

    await articles._sync_article_indexes(SimpleNamespace(id=42), db=None)
