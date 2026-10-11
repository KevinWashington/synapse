from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import article_index_service


@pytest.mark.asyncio
async def test_index_sync_failure_does_not_turn_a_committed_decision_into_an_error(monkeypatch, caplog):
    service = SimpleNamespace(sync=AsyncMock(side_effect=RuntimeError("index unavailable")))
    monkeypatch.setattr(article_index_service, "get_article_index_service", lambda: service)

    await article_index_service.sync_article_indexes(SimpleNamespace(id=42), db=None)

    assert "Article 42 index synchronization failed" in caplog.text
