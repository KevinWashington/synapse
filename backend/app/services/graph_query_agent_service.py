"""Agent-oriented graph query service for exploratory multi-step questions."""

import re
import unicodedata

from app.core.dependencies import get_mcp_host


class GraphQueryAgentService:
    """Incremental step toward agentic GraphRAG using explicit tool plans and traces."""

    def __init__(self):
        self.mcp = get_mcp_host()

    def plan(self, query: str) -> dict:
        normalized = self._normalize(query)
        padded = f" {normalized} "

        if " cluster" in padded or " clusters " in padded or (" ponte " in padded and " autor" in padded):
            return {
                "intent": "cluster_bridge_analysis",
                "tools": ["graph.cluster_project", "graph.bridge_authors"],
                "needs": [],
            }

        if (" evolu" in padded or " timeline " in padded or " ao longo do tempo " in padded) and " metodologia" in padded:
            return {
                "intent": "methodology_timeline",
                "tools": ["graph.timeline_by_methodology"],
                "needs": [],
            }

        if " autor " in padded and any(marker in padded for marker in (" tecnica ", " tema ", " topico ", " keyword ", " palavras chave ")):
            return {
                "intent": "author_topic_paths",
                "tools": ["graph.find_author_topic_paths"],
                "needs": ["author_query", "topic_query"],
            }

        if any(marker in padded for marker in (" depois deste ", " ler depois ", " relacionado ", " relacionados ")):
            return {
                "intent": "related_reads",
                "tools": ["graph.recommend_related_reads"],
                "needs": ["paper_id_or_article_id"],
            }

        return {
            "intent": "fallback_hybrid_rag",
            "tools": ["search_semantic", "execute_expansion", "rerank_by_impact"],
            "needs": [],
        }

    def derive_context(self, query: str, context: dict | None = None) -> dict:
        merged = dict(context or {})
        normalized_query = self._normalize(query)

        if not merged.get("author_query"):
            author_match = re.search(r"autor\s+([a-z0-9][a-z0-9\s\-]{2,})", normalized_query)
            if author_match:
                merged["author_query"] = author_match.group(1).strip()

        if not merged.get("topic_query"):
            topic_match = re.search(r"(?:tecnica|tema|topico|keyword|palavras chave)\s+([a-z0-9][a-z0-9\s\-]{2,})", normalized_query)
            if topic_match:
                merged["topic_query"] = topic_match.group(1).strip()

        if not merged.get("methodology"):
            methodology = self._extract_methodology_from_query(normalized_query)
            if methodology:
                merged["methodology"] = methodology

        return merged

    def _extract_methodology_from_query(self, normalized_query: str) -> str | None:
        match = re.search(
            r"metodologia\s+([a-z0-9][a-z0-9\s\-]{1,120}?)(?=\s+(?:evolu\w*|ao\s+longo\s+do\s+tempo|no\s+projeto|neste\s+projeto|nesse\s+projeto|entre\b|qual\b|quais\b|como\b)\b|$)",
            normalized_query,
        )
        if not match:
            return None

        methodology = re.sub(r"^(?:de|do|da|dos|das)\s+", "", match.group(1).strip())
        methodology = re.sub(r"\s+", " ", methodology).strip()

        if len(methodology) < 3:
            return None

        return methodology

    async def run(self, query: str, project_id: int, context: dict | None = None) -> dict:
        context = self.derive_context(query, context)
        plan = self.plan(query)
        trace: list[dict] = []

        if plan["intent"] == "related_reads":
            paper_id = context.get("paper_id") or context.get("paperId")
            article_id = context.get("article_id") or context.get("articleId")
            limit = context.get("limit") or 5
            if not paper_id and not article_id:
                resolve_params = {
                    "query": query,
                    "project_id": project_id,
                    "top_k": context.get("resolution_k", 3),
                }
                resolution = await self.mcp.call_tool("search_semantic", resolve_params)
                resolved_candidates = resolution.get("papers", [])
                trace.append(
                    {
                        "tool": "search_semantic",
                        "params": resolve_params,
                        "observation": {
                            "candidateCount": len(resolved_candidates),
                            "resolvedPaperId": (resolved_candidates[0] or {}).get("paper_id") if resolved_candidates else None,
                        },
                    }
                )
                if resolved_candidates:
                    paper_id = resolved_candidates[0].get("paper_id")
                    article_id = resolved_candidates[0].get("id")

            if not paper_id and not article_id:
                return {
                    "plan": plan,
                    "trace": trace,
                    "result": None,
                    "missing": ["paper_id_or_article_id"],
                }
            params = {
                "project_id": project_id,
                "paper_id": paper_id,
                "article_id": article_id,
                "limit": limit,
            }
            result = await self.mcp.call_tool("graph.recommend_related_reads", params)
            trace.append({"tool": "graph.recommend_related_reads", "params": params})
            if result.get("recommendations"):
                return {"plan": plan, "trace": trace, "result": result}

            if paper_id:
                expand_params = {
                    "ids": [paper_id],
                    "project_id": project_id,
                    "relations": ["SIMILAR_TO", "SHARES_KEYWORD", "SAME_METHODOLOGY", "SAME_AUTHOR", "SAME_VENUE"],
                }
                expansion = await self.mcp.call_tool("execute_expansion", expand_params)
                trace.append({"tool": "execute_expansion", "params": expand_params})
                return {
                    "plan": plan,
                    "trace": trace,
                    "result": {"recommendations": expansion.get("related_papers", [])[:limit]},
                }
            return {"plan": plan, "trace": trace, "result": result}

        if plan["intent"] == "cluster_bridge_analysis":
            cluster_params = {"project_id": project_id, "limit": context.get("cluster_limit") or 12}
            bridge_params = {"project_id": project_id, "limit": context.get("bridge_limit") or 10}
            clusters = await self.mcp.call_tool("graph.cluster_project", cluster_params)
            trace.append({"tool": "graph.cluster_project", "params": cluster_params})
            bridges = await self.mcp.call_tool("graph.bridge_authors", bridge_params)
            trace.append({"tool": "graph.bridge_authors", "params": bridge_params})
            return {
                "plan": plan,
                "trace": trace,
                "result": {"clusters": clusters.get("clusters", []), "bridge_authors": bridges.get("bridge_authors", [])},
            }

        if plan["intent"] == "methodology_timeline":
            params = {
                "project_id": project_id,
                "methodology": context.get("methodology"),
            }
            result = await self.mcp.call_tool("graph.timeline_by_methodology", params)
            trace.append({"tool": "graph.timeline_by_methodology", "params": params})
            return {"plan": plan, "trace": trace, "result": result}

        if plan["intent"] == "author_topic_paths":
            author_query = context.get("author_query")
            topic_query = context.get("topic_query")
            if not author_query or not topic_query:
                return {
                    "plan": plan,
                    "trace": trace,
                    "result": None,
                    "missing": ["author_query", "topic_query"],
                }
            params = {
                "project_id": project_id,
                "author_query": author_query,
                "topic_query": topic_query,
                "limit": context.get("limit") or 10,
            }
            result = await self.mcp.call_tool("graph.find_author_topic_paths", params)
            trace.append({"tool": "graph.find_author_topic_paths", "params": params})
            return {"plan": plan, "trace": trace, "result": result}

        return {
            "plan": plan,
            "trace": trace,
            "result": None,
        }

    def _normalize(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value or "")
        normalized = normalized.encode("ascii", "ignore").decode("ascii")
        normalized = normalized.lower()
        normalized = re.sub(r"[^a-z0-9\s]+", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return normalized


_graph_query_agent_service: GraphQueryAgentService | None = None


def get_graph_query_agent_service() -> GraphQueryAgentService:
    global _graph_query_agent_service
    if _graph_query_agent_service is None:
        _graph_query_agent_service = GraphQueryAgentService()
    return _graph_query_agent_service
