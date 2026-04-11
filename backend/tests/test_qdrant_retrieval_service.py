import importlib
import sys
from types import SimpleNamespace

import pytest


def _load_qdrant_service_class(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")
    sys.modules.pop("app.services.qdrant_retrieval_service", None)

    import app.config as config_module

    importlib.reload(config_module)
    module = importlib.import_module("app.services.qdrant_retrieval_service")
    module = importlib.reload(module)
    return module.QdrantRetrievalService


@pytest.mark.asyncio
async def test_search_uses_query_points_and_maps_hits(monkeypatch):
    QdrantRetrievalService = _load_qdrant_service_class(monkeypatch)
    service = QdrantRetrievalService()
    service.collection = "test_collection"

    async def fake_ensure_collection():
        return None

    service._ensure_collection = fake_ensure_collection

    captured = {}

    class FakeClient:
        async def query_points(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                points=[
                    SimpleNamespace(
                        score=0.12345,
                        payload={
                            "article_id": 42,
                            "paper_id": "paper-42",
                            "title": "Vector hit",
                            "authors": "Author",
                            "year": 2025,
                        },
                    )
                ]
            )

    service.client = FakeClient()

    result = await service.search(
        query_embedding=[0.1, 0.2, 0.3],
        project_id=7,
        top_k=3,
    )

    assert captured["collection_name"] == "test_collection"
    assert captured["query"] == [0.1, 0.2, 0.3]
    assert captured["limit"] == 3
    assert captured["with_payload"] is True
    assert captured["query_filter"].must[0].key == "project_id"
    assert captured["query_filter"].must[0].match.value == 7

    assert result["papers"] == [
        {
            "id": 42,
            "paper_id": "paper-42",
            "title": "Vector hit",
            "authors": "Author",
            "year": 2025,
            "journal": None,
            "abstract": None,
            "methodology": None,
            "domain": None,
            "keywords": None,
            "notas": None,
            "distance": 0.1235,
            "source_type": "vector",
            "provenance": {
                "subsystem": "vector",
                "backend": "qdrant",
                "projectId": 7,
                "paperId": "paper-42",
                "distance": 0.1235,
            },
        }
    ]
    assert result["provenance"] == {
        "subsystem": "vector",
        "backend": "qdrant",
        "projectId": 7,
    }
