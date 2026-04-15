import importlib
import sys
from types import SimpleNamespace

import pytest


def _load_rag_service_class(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")
    sys.modules.pop("app.services.rag_service", None)

    import app.config as config_module

    importlib.reload(config_module)
    module = importlib.import_module("app.services.rag_service")
    module = importlib.reload(module)
    return module.RAGService


@pytest.mark.asyncio
async def test_retrieve_preserves_vector_relevance_order_after_sql_validation(monkeypatch):
    RAGService = _load_rag_service_class(monkeypatch)
    rag = RAGService()

    class FakeMCP:
        async def call_tool(self, method, params):
            if method == "search_semantic":
                return {
                    "papers": [
                        {
                            "paper_id": "paper-b",
                            "title": "B",
                            "source_type": "vector",
                            "distance": 0.05,
                        },
                        {
                            "paper_id": "paper-a",
                            "title": "A",
                            "source_type": "vector",
                            "distance": 0.15,
                        },
                    ]
                }

            if method == "execute_expansion":
                return {"related_papers": []}

            if method == "rerank_by_impact":
                # Simulate DB returning rows in a non-relevance order.
                return {
                    "papers": [
                        {
                            "id": 1,
                            "paper_id": "paper-a",
                            "title": "A",
                            "authors": "Author A",
                            "source_type": "sql_validated",
                        },
                        {
                            "id": 2,
                            "paper_id": "paper-b",
                            "title": "B",
                            "authors": "Author B",
                            "source_type": "sql_validated",
                        },
                    ]
                }

            raise AssertionError(f"Unexpected tool call: {method}")

    rag.mcp = FakeMCP()

    class FakeDB:
        async def get(self, model, project_id):
            return SimpleNamespace(
                id=project_id,
                ownerId=1,
                title="Projeto",
                objetivo="Objetivo",
                framework="PICOC",
                picoc={"population": "usuarios"},
                researchQuestions=[],
            )

    result = await rag.retrieve(
        query="quais artigos falam sobre switching cost?",
        project_id=1,
        db=FakeDB(),
        owner_id=1,
    )

    assert [article["paper_id"] for article in result["articles"]] == [
        "paper-b",
        "paper-a",
    ]
    assert result["articles"][0]["title"] == "B"
    assert result["articles"][1]["title"] == "A"
    assert result["project"]["framework"] == "PICOC"
    assert result["project"]["picoc"] == {"population": "usuarios"}


@pytest.mark.asyncio
async def test_retrieve_preserves_original_provenance_after_sql_validation(monkeypatch):
    RAGService = _load_rag_service_class(monkeypatch)
    rag = RAGService()

    class FakeMCP:
        async def call_tool(self, method, params):
            if method == "search_semantic":
                return {
                    "papers": [
                        {
                            "id": 7,
                            "paper_id": "paper-7",
                            "title": "Vector match",
                            "source_type": "vector",
                            "distance": 0.07,
                            "provenance": {
                                "subsystem": "vector",
                                "backend": "qdrant",
                                "projectId": 1,
                                "paperId": "paper-7",
                                "distance": 0.07,
                            },
                        }
                    ]
                }

            if method == "execute_expansion":
                return {"related_papers": []}

            if method == "rerank_by_impact":
                return {
                    "papers": [
                        {
                            "id": 7,
                            "paper_id": "paper-7",
                            "title": "Vector match",
                            "authors": "Author",
                            "source_type": "sql_validated",
                            "provenance": {
                                "subsystem": "sql",
                                "backend": "postgres",
                                "projectId": 1,
                                "paperId": "paper-7",
                            },
                        }
                    ]
                }

            raise AssertionError(f"Unexpected tool call: {method}")

    rag.mcp = FakeMCP()

    class FakeDB:
        async def get(self, model, project_id):
            return SimpleNamespace(
                id=project_id,
                ownerId=1,
                title="Projeto",
                objetivo="Objetivo",
                framework="PICOC",
                picoc={},
                researchQuestions=[],
            )

    result = await rag.retrieve(
        query="o que tem de metodologia?",
        project_id=1,
        db=FakeDB(),
        owner_id=1,
    )

    article = result["articles"][0]
    assert article["source_type"] == "vector"
    assert article["distance"] == 0.07
    assert article["provenance"]["subsystem"] == "vector"
    assert article["provenance"]["backend"] == "qdrant"
    assert article["provenance"]["validatedBy"] == {
        "subsystem": "sql",
        "backend": "postgres",
        "projectId": 1,
        "paperId": "paper-7",
    }


@pytest.mark.asyncio
async def test_retrieve_article_focus_uses_vector_and_sql_without_graph(monkeypatch):
    RAGService = _load_rag_service_class(monkeypatch)
    rag = RAGService()

    calls = []

    class FakeMCP:
        async def call_tool(self, method, params):
            calls.append(method)
            if method == "search_semantic":
                return {
                    "papers": [
                        {
                            "id": 3,
                            "paper_id": "paper-focus",
                            "title": "Generative AI Meets Large Language Models: Evolution, Challenges, and Future Directions",
                            "authors": "Vivekananda et al.",
                            "year": 2025,
                            "source_type": "vector",
                            "distance": 0.98,
                            "provenance": {
                                "subsystem": "vector",
                                "backend": "qdrant",
                                "projectId": 1,
                                "paperId": "paper-focus",
                                "distance": 0.98,
                            },
                        },
                        {
                            "id": 19,
                            "paper_id": "paper-other",
                            "title": "Recent Advances in Generative AI and Large Language Models",
                            "authors": "Other",
                            "year": 2024,
                            "source_type": "vector",
                            "distance": 0.91,
                        },
                    ]
                }

            if method == "rerank_by_impact":
                return {
                    "papers": [
                        {
                            "id": 3,
                            "paper_id": "paper-focus",
                            "title": "Generative AI Meets Large Language Models: Evolution, Challenges, and Future Directions",
                            "authors": "Vivekananda et al.",
                            "year": 2025,
                            "source_type": "sql_validated",
                            "provenance": {
                                "subsystem": "sql",
                                "backend": "postgres",
                                "projectId": 1,
                                "paperId": "paper-focus",
                            },
                        },
                        {
                            "id": 19,
                            "paper_id": "paper-other",
                            "title": "Recent Advances in Generative AI and Large Language Models",
                            "authors": "Other",
                            "year": 2024,
                            "source_type": "sql_validated",
                            "provenance": {
                                "subsystem": "sql",
                                "backend": "postgres",
                                "projectId": 1,
                                "paperId": "paper-other",
                            },
                        },
                    ]
                }

            raise AssertionError(f"Unexpected tool call in article-focus mode: {method}")

    rag.mcp = FakeMCP()

    class FakeDB:
        async def get(self, model, project_id):
            return SimpleNamespace(
                id=project_id,
                ownerId=1,
                title="Projeto",
                objetivo="Objetivo",
                framework="PICOC",
                picoc={},
                researchQuestions=[],
            )

    result = await rag.retrieve(
        query="o que o artigo Generative AI Meets Large Language Models: Evolution, Challenges, and Future Directions diz?",
        project_id=1,
        db=FakeDB(),
        owner_id=1,
    )

    assert calls == ["search_semantic", "rerank_by_impact"]
    assert len(result["articles"]) == 1
    assert result["articles"][0]["paper_id"] == "paper-focus"
    assert result["articles"][0]["source_type"] == "vector"
    assert result["articles"][0]["provenance"]["subsystem"] == "vector"
    assert result["project"]["focusArticle"] == {
        "title": "Generative AI Meets Large Language Models: Evolution, Challenges, and Future Directions",
        "paperId": "paper-focus",
        "matchType": "semantic_focus",
    }
    assert result["diagnostics"]["lastPlan"]["route"] == "article_focus"


def test_plan_retrieval_routes_specific_article_to_vector_only(monkeypatch):
    RAGService = _load_rag_service_class(monkeypatch)
    rag = RAGService()

    plan = rag._plan_retrieval(
        query="o que o artigo Generative AI Meets Large Language Models diz?",
        top_k=5,
    )

    assert plan == {
        "route": "article_focus",
        "use_vector": True,
        "use_graph": False,
        "use_sql": True,
        "vector_top_k": 3,
        "max_sources": 1,
        "prefer_direct_match": False,
    }


def test_extract_article_title_candidates_detects_explicit_title(monkeypatch):
    RAGService = _load_rag_service_class(monkeypatch)
    rag = RAGService()

    candidates = rag._extract_article_title_candidates(
        "o que o artigo Generative AI Meets Large Language Models: Evolution, Challenges, and Future Directions diz?"
    )

    assert candidates == [
        "generative ai meets large language models evolution challenges and future directions"
    ]
