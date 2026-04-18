"""RAG service for project-level chat orchestrating MCP Tools."""

import logging
import re
import unicodedata
from difflib import SequenceMatcher

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_mcp_host
from app.models.article import Article
from app.models.project import Project

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
            "lastPlan": None,
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

        project = await db.get(Project, project_id)
        if not project:
            raise ValueError(f"Projeto {project_id} nao encontrado")

        if owner_id is not None and project.ownerId != owner_id:
            self._diagnostics["scopeDenied"] += 1
            raise PermissionError("Projeto nao pertence ao usuario autenticado")

        project_context = {
            "title": project.title,
            "objetivo": project.objetivo,
            "framework": getattr(project, "framework", "PICOC") or "PICOC",
            "picoc": getattr(project, "picoc", {}) or {},
            "researchQuestions": project.researchQuestions or [],
        }

        retrieval_plan = self._plan_retrieval(query=query, top_k=top_k)
        self._diagnostics["lastPlan"] = dict(retrieval_plan)

        if retrieval_plan["route"] == "article_focus":
            focus_article = await self._find_direct_article_focus(
                query=query,
                project_id=project_id,
                owner_id=owner_id,
                db=db,
            )
            if focus_article and retrieval_plan.get("prefer_direct_match"):
                project_context["focusArticle"] = {
                    "title": focus_article.get("title"),
                    "paperId": focus_article.get("paper_id"),
                    "matchType": "direct_title_match",
                }
                self._update_provenance_counts([focus_article])
                return {
                    "project": project_context,
                    "articles": [focus_article],
                    "diagnostics": self.diagnostics(),
                }

            project_context["focusArticle"] = {
                "title": None,
                "paperId": None,
                "matchType": "semantic_focus",
            }

        seed_papers: list[dict] = []
        graph_papers: list[dict] = []
        ranked_papers: list[dict] = []

        if retrieval_plan["use_vector"]:
            try:
                vector_result = await self.mcp.call_tool(
                    "search_semantic",
                    {
                        "query": query,
                        "project_id": project_id,
                        "top_k": retrieval_plan["vector_top_k"],
                    },
                )
                seed_papers = vector_result.get("papers", [])
                self._diagnostics["tool_calls"]["tool3_vector"] += 1
            except Exception as e:
                logger.error(f"Tool 3 (Vector) falhou: {e}")
                return {"project": project_context, "articles": []}

        seed_ids = [p.get("paper_id") for p in seed_papers if p.get("paper_id")]

        if seed_ids and retrieval_plan["use_graph"]:
            try:
                graph_result = await self.mcp.call_tool(
                    "execute_expansion",
                    {
                        "ids": seed_ids,
                        "relations": ["SAME_METHODOLOGY", "SIMILAR_TO"],
                        "max_hops": 2,
                        "project_id": project_id,
                    },
                )
                graph_papers = graph_result.get("related_papers", [])
                self._diagnostics["tool_calls"]["tool1_graph"] += 1
            except Exception as e:
                logger.warning(f"Tool 1 (Graph) ignorada ou falhou: {e}")

        all_ids = self._ordered_unique_ids(
            seed_ids + [p.get("paper_id") for p in graph_papers if p.get("paper_id")]
        )

        ranked_papers = self._sort_papers_by_id_order(seed_papers + graph_papers, all_ids)
        candidate_by_id = self._index_papers_by_id(ranked_papers)
        if all_ids and retrieval_plan["use_sql"]:
            try:
                sql_result = await self.mcp.call_tool(
                    "rerank_by_impact",
                    {
                        "ids": all_ids,
                        "project_id": project_id,
                        "filters": {"review_outcome": ["included"]},
                    },
                )
                ranked_sql_papers = self._sort_papers_by_id_order(
                    sql_result.get("papers", []),
                    all_ids,
                )
                ranked_papers = self._merge_sql_rows_with_candidates(
                    sql_papers=ranked_sql_papers,
                    candidate_by_id=candidate_by_id,
                    project_id=project_id,
                )
                self._diagnostics["tool_calls"]["tool2_sql"] += 1
            except Exception as e:
                logger.warning(f"Tool 2 (SQL) ignorada ou falhou: {e}")

        ranked_papers = self._apply_plan_limits(ranked_papers, retrieval_plan)
        if retrieval_plan["route"] == "article_focus" and ranked_papers:
            project_context["focusArticle"] = {
                "title": ranked_papers[0].get("title"),
                "paperId": ranked_papers[0].get("paper_id"),
                "matchType": "semantic_focus",
            }

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
            final_articles.append(
                {
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
                }
            )

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
            "lastPlan": self._diagnostics["lastPlan"],
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
        elif source_type == "direct_article_focus":
            subsystem = "focus"
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

    def _ordered_unique_ids(self, ids: list[str | None]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for paper_id in ids:
            if not paper_id or paper_id in seen:
                continue
            seen.add(paper_id)
            ordered.append(paper_id)
        return ordered

    def _sort_papers_by_id_order(self, papers: list[dict], ordered_ids: list[str]) -> list[dict]:
        if not papers or not ordered_ids:
            return papers

        rank_by_id = {paper_id: index for index, paper_id in enumerate(ordered_ids)}
        indexed_papers = list(enumerate(papers))
        indexed_papers.sort(
            key=lambda item: (
                rank_by_id.get(item[1].get("paper_id"), len(ordered_ids)),
                item[0],
            )
        )
        return [paper for _, paper in indexed_papers]

    def _index_papers_by_id(self, papers: list[dict]) -> dict[str, dict]:
        indexed: dict[str, dict] = {}
        for paper in papers:
            paper_id = paper.get("paper_id")
            if paper_id and paper_id not in indexed:
                indexed[paper_id] = paper
        return indexed

    def _merge_sql_rows_with_candidates(
        self,
        *,
        sql_papers: list[dict],
        candidate_by_id: dict[str, dict],
        project_id: int,
    ) -> list[dict]:
        merged_papers: list[dict] = []

        for sql_paper in sql_papers:
            paper_id = sql_paper.get("paper_id")
            base_paper = dict(candidate_by_id.get(paper_id, {}))
            merged = {**base_paper, **sql_paper}

            source_type = base_paper.get("source_type") or sql_paper.get("source_type") or "sql_validated"
            merged["source_type"] = source_type

            distance = base_paper.get("distance")
            if distance is not None:
                merged["distance"] = distance

            provenance = self._build_provenance(
                existing=base_paper.get("provenance"),
                source_type=source_type,
                project_id=project_id,
                paper_id=paper_id,
                distance=distance,
            )

            sql_provenance = sql_paper.get("provenance")
            if isinstance(sql_provenance, dict):
                provenance["validatedBy"] = dict(sql_provenance)

            merged["provenance"] = provenance
            merged_papers.append(merged)

        return merged_papers

    def _plan_retrieval(self, *, query: str, top_k: int) -> dict:
        normalized = self._normalize_text(query)
        padded = f" {normalized} "

        article_markers = (" artigo ", " paper ", " estudo ", " trabalho ")
        compare_markers = (" compare ", " comparar ", " diferenca ", " versus ", " vs ")
        relation_markers = (
            " relacionado ",
            " relacionados ",
            " parecido ",
            " parecidos ",
            " conex",
            " similar ",
            " compare ",
            " comparar ",
        )

        asks_for_specific_article = (
            any(marker in padded for marker in article_markers)
            or bool(re.search(r"10\s+[0-9]{4}", normalized))
            or bool(re.findall(r"[\"“”']([^\"“”']{12,})[\"“”']", query))
        )
        asks_for_comparison = any(marker in padded for marker in compare_markers)
        asks_for_relations = any(marker in padded for marker in relation_markers)

        if asks_for_specific_article and not asks_for_comparison and not asks_for_relations:
            return {
                "route": "article_focus",
                "use_vector": True,
                "use_graph": False,
                "use_sql": True,
                "vector_top_k": 3,
                "max_sources": 1,
                "prefer_direct_match": False,
            }

        if asks_for_comparison or asks_for_relations:
            return {
                "route": "relationship_exploration",
                "use_vector": True,
                "use_graph": True,
                "use_sql": True,
                "vector_top_k": max(top_k, 5),
                "max_sources": 10,
                "prefer_direct_match": False,
            }

        return {
            "route": "hybrid_broad",
            "use_vector": True,
            "use_graph": True,
            "use_sql": True,
            "vector_top_k": top_k,
            "max_sources": None,
            "prefer_direct_match": False,
        }

    def _apply_plan_limits(self, papers: list[dict], retrieval_plan: dict) -> list[dict]:
        max_sources = retrieval_plan.get("max_sources")
        if not max_sources:
            return papers
        return papers[:max_sources]

    async def _find_direct_article_focus(
        self,
        *,
        query: str,
        project_id: int,
        owner_id: int | None,
        db: AsyncSession,
    ) -> dict | None:
        candidate_phrases = self._extract_article_title_candidates(query)
        if not candidate_phrases or not hasattr(db, "execute"):
            return None

        stmt = select(Article).where(
            Article.projectId == project_id,
            Article.reviewOutcome == "included",
        )
        if owner_id is not None:
            stmt = stmt.where(Article.ownerId == owner_id)

        result = await db.execute(stmt)
        articles = result.scalars().all()
        if not articles:
            return None

        best_article = None
        best_score = 0.0

        for article in articles:
            normalized_title = self._normalize_text(article.title)
            if not normalized_title:
                continue

            for phrase in candidate_phrases:
                score = self._title_match_score(phrase, normalized_title)
                if score > best_score:
                    best_score = score
                    best_article = article

        if best_article is None or best_score < 0.93:
            return None

        provenance = self._build_provenance(
            existing={
                "subsystem": "focus",
                "backend": "postgres",
                "projectId": project_id,
                "paperId": best_article.paperId,
                "matchScore": round(best_score, 4),
            },
            source_type="direct_article_focus",
            project_id=project_id,
            paper_id=best_article.paperId,
            distance=None,
        )

        return {
            "id": best_article.id,
            "paper_id": best_article.paperId,
            "title": best_article.title,
            "authors": best_article.authors,
            "year": best_article.year,
            "journal": best_article.journal,
            "abstract": best_article.abstract,
            "notas": best_article.notas,
            "methodology": best_article.aiMethodology,
            "domain": best_article.aiDomain,
            "keywords": best_article.aiKeywords,
            "source_type": "direct_article_focus",
            "provenance": provenance,
        }

    def _extract_article_title_candidates(self, query: str) -> list[str]:
        candidates: list[str] = []

        for quoted in re.findall(r"[\"“”']([^\"“”']{12,})[\"“”']", query):
            normalized = self._normalize_text(quoted)
            if normalized:
                candidates.append(normalized)

        lowered = query.lower()
        marker = "artigo "
        if marker in lowered:
            after_marker = query[lowered.index(marker) + len(marker):]
            stop_match = re.search(
                r"(\?|\.|!|,?\s+diz\b|,?\s+fala\b|,?\s+aborda\b|,?\s+apresenta\b|,?\s+resume\b|,?\s+descreve\b)",
                after_marker,
                flags=re.IGNORECASE,
            )
            snippet = after_marker[: stop_match.start()] if stop_match else after_marker
            normalized = self._normalize_text(snippet)
            if normalized:
                candidates.append(normalized)

        deduped: list[str] = []
        seen: set[str] = set()
        for candidate in candidates:
            if candidate and candidate not in seen:
                seen.add(candidate)
                deduped.append(candidate)
        return deduped

    def _normalize_text(self, value: str | None) -> str:
        if not value:
            return ""

        normalized = unicodedata.normalize("NFKD", value)
        normalized = normalized.encode("ascii", "ignore").decode("ascii")
        normalized = normalized.lower()
        normalized = re.sub(r"[^a-z0-9\s]+", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return normalized

    def _title_match_score(self, normalized_query: str, normalized_title: str) -> float:
        if not normalized_query or not normalized_title:
            return 0.0
        if normalized_query == normalized_title:
            return 1.0
        if normalized_query in normalized_title or normalized_title in normalized_query:
            return 0.97
        return SequenceMatcher(None, normalized_query, normalized_title).ratio()


_rag_agent_service: RAGAgentService | None = None


def get_rag_service() -> RAGAgentService:
    global _rag_agent_service
    if _rag_agent_service is None:
        _rag_agent_service = RAGAgentService()
    return _rag_agent_service


RAGService = RAGAgentService
