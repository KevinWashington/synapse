import importlib
import sys

import pytest


def _load_graph_query_agent_service_class(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")
    sys.modules.pop("app.services.graph_query_agent_service", None)

    import app.config as config_module

    importlib.reload(config_module)
    module = importlib.import_module("app.services.graph_query_agent_service")
    module = importlib.reload(module)
    return module.GraphQueryAgentService


def test_plan_detects_related_reads(monkeypatch):
    Service = _load_graph_query_agent_service_class(monkeypatch)
    service = Service()

    plan = service.plan("que artigos relacionados eu deveria ler depois deste?")

    assert plan == {
        "intent": "related_reads",
        "tools": ["graph.recommend_related_reads"],
        "needs": ["paper_id_or_article_id"],
    }


def test_plan_detects_cluster_bridge_analysis(monkeypatch):
    Service = _load_graph_query_agent_service_class(monkeypatch)
    service = Service()

    plan = service.plan("quais clusters aparecem no projeto e quais autores fazem ponte entre eles?")

    assert plan == {
        "intent": "cluster_bridge_analysis",
        "tools": ["graph.cluster_project", "graph.bridge_authors"],
        "needs": [],
    }


def test_plan_prioritizes_methodology_timeline_over_related_reads(monkeypatch):
    Service = _load_graph_query_agent_service_class(monkeypatch)
    service = Service()

    plan = service.plan("como evoluiram os temas entre artigos relacionados por metodologia?")

    assert plan == {
        "intent": "methodology_timeline",
        "tools": ["graph.timeline_by_methodology"],
        "needs": [],
    }


def test_derive_context_extracts_methodology_without_suffix_noise(monkeypatch):
    Service = _load_graph_query_agent_service_class(monkeypatch)
    service = Service()

    context = service.derive_context("Como a metodologia Revisao Sistematica:[ evoluiu ao longo do tempo no projeto?")

    assert context["methodology"] == "revisao sistematica"


def test_derive_context_extracts_methodology_without_leading_preposition(monkeypatch):
    Service = _load_graph_query_agent_service_class(monkeypatch)
    service = Service()

    context = service.derive_context("Como a metodologia de aprendizado por reforco evoluiu no projeto?")

    assert context["methodology"] == "aprendizado por reforco"


@pytest.mark.asyncio
async def test_run_executes_related_reads_tool(monkeypatch):
    Service = _load_graph_query_agent_service_class(monkeypatch)
    service = Service()

    class FakeMCP:
        async def call_tool(self, method, params):
            assert method == "graph.recommend_related_reads"
            assert params == {"project_id": 1, "paper_id": "paper-1", "article_id": None, "limit": 5}
            return {"recommendations": [{"paper_id": "paper-2"}]}

    service.mcp = FakeMCP()

    result = await service.run(
        "que artigos relacionados eu deveria ler depois deste?",
        project_id=1,
        context={"paper_id": "paper-1"},
    )

    assert result["plan"]["intent"] == "related_reads"
    assert result["trace"] == [
        {
            "tool": "graph.recommend_related_reads",
            "params": {"project_id": 1, "paper_id": "paper-1", "article_id": None, "limit": 5},
        }
    ]
    assert result["result"] == {"recommendations": [{"paper_id": "paper-2"}]}


@pytest.mark.asyncio
async def test_run_resolves_focus_article_with_vector_search_before_related_reads(monkeypatch):
    Service = _load_graph_query_agent_service_class(monkeypatch)
    service = Service()

    class FakeMCP:
        async def call_tool(self, method, params):
            if method == "search_semantic":
                assert params == {"query": "que artigos relacionados eu deveria ler depois do artigo sobre generative ai?", "project_id": 1, "top_k": 3}
                return {"papers": [{"id": 7, "paper_id": "paper-7", "title": "Focus paper"}]}
            if method == "graph.recommend_related_reads":
                assert params == {"project_id": 1, "paper_id": "paper-7", "article_id": 7, "limit": 5}
                return {"recommendations": [{"paper_id": "paper-8"}]}
            raise AssertionError(f"Unexpected tool call: {method}")

    service.mcp = FakeMCP()

    result = await service.run(
        "que artigos relacionados eu deveria ler depois do artigo sobre generative ai?",
        project_id=1,
    )

    assert result["plan"]["intent"] == "related_reads"
    assert result["trace"][0]["tool"] == "search_semantic"
    assert result["trace"][0]["observation"] == {"candidateCount": 1, "resolvedPaperId": "paper-7"}
    assert result["trace"][1] == {
        "tool": "graph.recommend_related_reads",
        "params": {"project_id": 1, "paper_id": "paper-7", "article_id": 7, "limit": 5},
    }
    assert result["result"] == {"recommendations": [{"paper_id": "paper-8"}]}
