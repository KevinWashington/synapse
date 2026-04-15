import importlib
import sys

import pytest


def _load_neo4j_service_class(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")
    sys.modules.pop("app.services.neo4j_service", None)

    import app.config as config_module

    importlib.reload(config_module)
    module = importlib.import_module("app.services.neo4j_service")
    module = importlib.reload(module)
    return module.Neo4jService


@pytest.mark.asyncio
async def test_execute_expansion_uses_paper_ids_and_returns_article_ids(monkeypatch):
    Neo4jService = _load_neo4j_service_class(monkeypatch)
    service = Neo4jService()

    captured = {}

    async def fake_mcp_query(cypher, params=None):
        captured["cypher"] = cypher
        captured["params"] = params
        return {
            "ok": True,
            "rows": [
                {
                    "article_id": 21,
                    "paper_id": "paper-21",
                    "title": "Expanded paper",
                    "methodology": "survey",
                    "relation_type": "SIMILAR_TO",
                }
            ],
        }

    service.mcp_query = fake_mcp_query

    result = await service.execute_expansion(
        ids=["paper-seed"],
        project_id=3,
        relations=["SIMILAR_TO"],
    )

    assert "a.paperId IN $seedIds" in captured["cypher"]
    assert "NOT related.paperId IN $seedIds" in captured["cypher"]
    assert captured["params"] == {"projectId": 3, "seedIds": ["paper-seed"]}
    assert result == {
        "related_papers": [
            {
                "id": 21,
                "paper_id": "paper-21",
                "title": "Expanded paper",
                "methodology": "survey",
                "source_type": "graph_expansion (SIMILAR_TO)",
            }
        ]
    }


@pytest.mark.asyncio
async def test_recommend_related_reads_uses_weighted_graph_signals(monkeypatch):
    Neo4jService = _load_neo4j_service_class(monkeypatch)
    service = Neo4jService()

    captured = {}

    async def fake_mcp_query(cypher, params=None):
        captured["cypher"] = cypher
        captured["params"] = params
        return {
            "ok": True,
            "rows": [
                {
                    "article_id": 9,
                    "paper_id": "paper-9",
                    "title": "Related read",
                    "authors": "Author A and Author B",
                    "year": 2025,
                    "methodology": "review",
                    "domain": "ai",
                    "signal": "SIMILAR_TO",
                },
                {
                    "article_id": 9,
                    "paper_id": "paper-9",
                    "title": "Related read",
                    "authors": "Author A and Author B",
                    "year": 2025,
                    "methodology": "review",
                    "domain": "ai",
                    "signal": "SHARES_KEYWORD",
                }
            ],
        }

    service.mcp_query = fake_mcp_query

    result = await service.recommend_related_reads(
        project_id=5,
        paper_id="paper-focus",
        limit=3,
    )

    assert "type(r) IN ['SIMILAR_TO', 'SAME_METHODOLOGY', 'SAME_AUTHOR', 'SHARES_KEYWORD', 'SAME_VENUE']" in captured["cypher"]
    assert captured["params"] == {
        "projectId": 5,
        "paperId": "paper-focus",
        "articleId": None,
        "limit": 3,
    }
    assert result == {
        "recommendations": [
            {
                "article_id": 9,
                "paper_id": "paper-9",
                "title": "Related read",
                "authors": "Author A and Author B",
                "year": 2025,
                "methodology": "review",
                "domain": "ai",
                "signals": ["SIMILAR_TO", "SHARES_KEYWORD"],
                "score": 1.45,
            }
        ]
    }


@pytest.mark.asyncio
async def test_cluster_project_groups_articles_by_methodology_and_domain(monkeypatch):
    Neo4jService = _load_neo4j_service_class(monkeypatch)
    service = Neo4jService()

    captured = {}

    async def fake_mcp_query(cypher, params=None):
        captured["cypher"] = cypher
        captured["params"] = params
        return {
            "ok": True,
            "rows": [
                {
                    "cluster_id": "review|ai",
                    "methodology": "review",
                    "domain": "ai",
                    "article_count": 4,
                    "top_authors": ["Author A"],
                    "sample_articles": [{"id": 1, "paper_id": "paper-1", "title": "A", "year": 2024}],
                }
            ],
        }

    service.mcp_query = fake_mcp_query

    result = await service.cluster_project(project_id=2, limit=7)

    assert "coalesce(a.methodology, 'unknown')" in captured["cypher"]
    assert "cluster_id" in captured["cypher"]
    assert captured["params"] == {"projectId": 2, "limit": 7}
    assert result["clusters"][0]["cluster_id"] == "review|ai"
