"""RAG service for project-level chat orchestrating MCP Tools."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.core.dependencies import get_mcp_host

logger = logging.getLogger(__name__)


class RAGAgentService:
    """Hybrid RAG orchestrator using local MCP tools (vector, graph, sql)."""
    
    def __init__(self):
        self.mcp = get_mcp_host()
        self._diagnostics = {
            "backend": "hybrid-mcp",
            "requests": 0,
            "scopeDenied": 0,
            "lastProjectId": None,
            "projectScopeEnforced": True,
            "sourcesWithProvenance": 0,
            "sourcesWithoutProvenance": 0,
            "tool_calls": {"tool3_vector": 0, "tool1_graph": 0, "tool2_sql": 0},
        }
    
    async def retrieve(
        self,
        query: str,
        project_id: int,
        db: AsyncSession,
        top_k: int = 5,
        owner_id: int | None = None,
    ) -> dict:
        self._diagnostics["requests"] += 1
        self._diagnostics["lastProjectId"] = project_id

        # 1. Validate scope and project context.
        project = await db.get(Project, project_id)
        if not project:
            raise ValueError(f"Projeto {project_id} não encontrado")

        if owner_id is not None and project.ownerId != owner_id:
            self._diagnostics["scopeDenied"] += 1
            raise PermissionError("Projeto não pertence ao usuário autenticado")
            
        project_context = {
            "title": project.title,
            "objetivo": project.objetivo,
            "researchQuestions": project.researchQuestions or [],
        }

        seed_papers = []
        graph_papers = []
        ranked_papers = []

        try:
            vector_result = await self.mcp.call_tool("search_semantic", {
                "query": query,
                "project_id": project_id,
                "top_k": top_k
            })
            seed_papers = vector_result.get("papers", [])
            self._diagnostics["tool_calls"]["tool3_vector"] += 1
        except Exception as e:
            logger.error(f"Tool 3 (Vector) falhou: {e}")
            # Sem busca vetorial, não há como iniciar o seed. Retorna o que tem (nada).
            return {"project": project_context, "articles": []}

        seed_ids = [p.get("paper_id") for p in seed_papers if p.get("paper_id")]

        if seed_ids:
            try:
                graph_result = await self.mcp.call_tool("execute_expansion", {
                    "ids": seed_ids,
                    "relations": ["SAME_METHODOLOGY", "SIMILAR_TO"],
                    "max_hops": 2,
                    "project_id": project_id,
                })
                graph_papers = graph_result.get("related_papers", [])
                self._diagnostics["tool_calls"]["tool1_graph"] += 1
            except Exception as e:
                logger.warning(f"Tool 1 (Graph) ignorada ou falhou: {e}")

        all_ids = list(set(seed_ids + [p.get("paper_id") for p in graph_papers if p.get("paper_id")]))

        ranked_papers = seed_papers + graph_papers
        if all_ids:
            try:
                sql_result = await self.mcp.call_tool("rerank_by_impact", {
                    "ids": all_ids,
                    "project_id": project_id,
                    "filters": {"status": ["pendente", "analisado"]},
                })
                ranked_papers = sql_result.get("papers", [])
                self._diagnostics["tool_calls"]["tool2_sql"] += 1
            except Exception as e:
                logger.warning(f"Tool 2 (SQL) ignorada ou falhou: {e}")

        final_articles = []
        for paper in ranked_papers:
            paper_id = paper.get("paper_id")
            source = paper.get("source_type", "unknown")
            provenance = self._build_provenance(
                existing=paper.get("provenance"),
                source_type=source,
                project_id=project_id,
                paper_id=paper_id,
                distance=paper.get("distance"),
            )
            final_articles.append({
                "id": paper.get("id") or paper.get("article_id"),
                "paper_id": paper_id,
                "title": paper.get("title", "N/A"),
                "authors": paper.get("authors"),
                "year": paper.get("year"),
                "journal": paper.get("journal"),
                "abstract": paper.get("abstract"),
                "notas": paper.get("notas"),
                "methodology": paper.get("methodology") or paper.get("aiMethodology"),
                "domain": paper.get("domain") or paper.get("aiDomain"),
                "keywords": paper.get("keywords") or paper.get("aiKeywords"),
                "source_type": source,
                "distance": paper.get("distance"),
                "provenance": provenance,
            })

        self._update_provenance_counts(final_articles)

        return {
            "project": project_context,
            "articles": final_articles,
            "diagnostics": self.diagnostics(),
        }

    def diagnostics(self) -> dict:
        return {
            "backend": self._diagnostics["backend"],
            "requests": self._diagnostics["requests"],
            "scopeDenied": self._diagnostics["scopeDenied"],
            "lastProjectId": self._diagnostics["lastProjectId"],
            "projectScopeEnforced": self._diagnostics["projectScopeEnforced"],
            "sourcesWithProvenance": self._diagnostics["sourcesWithProvenance"],
            "sourcesWithoutProvenance": self._diagnostics["sourcesWithoutProvenance"],
            "tool_calls": dict(self._diagnostics["tool_calls"]),
        }

    def _build_provenance(
        self,
        *,
        existing: dict | None,
        source_type: str,
        project_id: int,
        paper_id: str | None,
        distance: float | None,
    ) -> dict:
        if isinstance(existing, dict):
            normalized = dict(existing)
            normalized.setdefault("projectId", project_id)
            normalized.setdefault("paperId", paper_id)
            if distance is not None:
                normalized.setdefault("distance", distance)
            return normalized

        if source_type == "sql_validated":
            subsystem = "sql"
            backend = "postgres"
        elif source_type == "vector":
            subsystem = "vector"
            backend = "qdrant"
        elif source_type.startswith("graph_expansion"):
            subsystem = "graph"
            backend = "neo4j"
        else:
            subsystem = "unknown"
            backend = "hybrid-mcp"

        provenance = {
            "subsystem": subsystem,
            "backend": backend,
            "projectId": project_id,
            "paperId": paper_id,
        }
        if distance is not None:
            provenance["distance"] = distance
        return provenance

    def _update_provenance_counts(self, articles: list[dict]) -> None:
        with_provenance = sum(1 for art in articles if art.get("provenance"))
        without_provenance = max(0, len(articles) - with_provenance)
        self._diagnostics["sourcesWithProvenance"] += with_provenance
        self._diagnostics["sourcesWithoutProvenance"] += without_provenance

# Singleton
_rag_agent_service: RAGAgentService | None = None

def get_rag_service() -> RAGAgentService:
    global _rag_agent_service
    if _rag_agent_service is None:
        _rag_agent_service = RAGAgentService()
    return _rag_agent_service


# Backward-compatible alias used in existing tests.
RAGService = RAGAgentService