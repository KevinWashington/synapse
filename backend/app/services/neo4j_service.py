"""Neo4j service for managing article relationship graphs."""

from neo4j import AsyncGraphDatabase
from app.config import settings


class Neo4jService:
    """Service for managing article nodes and relationships in Neo4j."""
    
    def __init__(self):
        self._driver = None
    
    @property
    def driver(self):
        """Lazy loading of Neo4j driver."""
        if self._driver is None:
            self._driver = AsyncGraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
        return self._driver
    
    async def close(self):
        """Close the driver connection."""
        if self._driver:
            await self._driver.close()
    
    async def create_article_node(
        self,
        article_id: int,
        paper_id: str | None,
        project_id: int,
        title: str,
        authors: str,
        year: int,
        status: str = "pendente",
        current_phase: str | None = None,
        review_outcome: str | None = None,
        methodology: str | None = None,
        domain: str | None = None,
        venue: str | None = None,
        keywords: list[str] | None = None,
        abstract: str | None = None,
    ) -> None:
        """Create or update an article node in Neo4j."""
        async with self.driver.session() as session:
            await session.run(
                """
                MERGE (a:Article {id: $id})
                SET a.projectId = $projectId,
                    a.paperId = $paperId,
                    a.title = $title,
                    a.authors = $authors,
                    a.year = $year,
                    a.status = $status,
                    a.currentPhase = $currentPhase,
                    a.reviewOutcome = $reviewOutcome,
                    a.methodology = $methodology,
                    a.domain = $domain,
                    a.venue = $venue,
                    a.keywords = $keywords,
                    a.abstract = $abstract
                """,
                id=article_id,
                paperId=paper_id,
                projectId=project_id,
                title=title,
                authors=authors,
                year=year,
                status=status,
                currentPhase=current_phase,
                reviewOutcome=review_outcome,
                methodology=methodology,
                domain=domain,
                venue=venue,
                keywords=keywords or [],
                abstract=abstract,
            )
    
    async def delete_article_node(self, article_id: int) -> None:
        """Delete an article node and all its relationships."""
        async with self.driver.session() as session:
            await session.run(
                """
                MATCH (a:Article {id: $id})
                DETACH DELETE a
                """,
                id=article_id
            )
    
    async def create_semantic_relationship(
        self,
        article_id: int,
        related_id: int,
        similarity_score: float
    ) -> None:
        """Create a semantic similarity relationship between articles."""
        async with self.driver.session() as session:
            await session.run(
                """
                MATCH (a:Article {id: $articleId})
                MATCH (b:Article {id: $relatedId})
                MERGE (a)-[r:SIMILAR_TO]->(b)
                SET r.score = $score
                """,
                articleId=article_id,
                relatedId=related_id,
                score=similarity_score
            )
    
    async def create_same_methodology_relationship(
        self,
        article_id: int,
        related_id: int
    ) -> None:
        """Create relationship for articles using same methodology."""
        async with self.driver.session() as session:
            await session.run(
                """
                MATCH (a:Article {id: $articleId})
                MATCH (b:Article {id: $relatedId})
                MERGE (a)-[:SAME_METHODOLOGY]->(b)
                """,
                articleId=article_id,
                relatedId=related_id
            )
    
    
    async def create_same_author_relationship(
        self,
        article_id: int,
        related_id: int,
        shared_authors: list[str]
    ) -> None:
        """Create relationship for articles with shared authors."""
        async with self.driver.session() as session:
            await session.run(
                """
                MATCH (a:Article {id: $articleId})
                MATCH (b:Article {id: $relatedId})
                MERGE (a)-[r:SAME_AUTHOR]->(b)
                SET r.sharedAuthors = $sharedAuthors
                """,
                articleId=article_id,
                relatedId=related_id,
                sharedAuthors=shared_authors
            )

    async def create_shared_keyword_relationship(
        self,
        article_id: int,
        related_id: int,
        shared_keywords: list[str],
    ) -> None:
        """Create relationship for articles that share keywords."""
        async with self.driver.session() as session:
            await session.run(
                """
                MATCH (a:Article {id: $articleId})
                MATCH (b:Article {id: $relatedId})
                MERGE (a)-[r:SHARES_KEYWORD]->(b)
                SET r.sharedKeywords = $sharedKeywords,
                    r.sharedKeywordCount = size($sharedKeywords)
                """,
                articleId=article_id,
                relatedId=related_id,
                sharedKeywords=shared_keywords,
            )

    async def create_same_venue_relationship(
        self,
        article_id: int,
        related_id: int,
        venue: str,
    ) -> None:
        """Create relationship for articles published in the same venue."""
        async with self.driver.session() as session:
            await session.run(
                """
                MATCH (a:Article {id: $articleId})
                MATCH (b:Article {id: $relatedId})
                MERGE (a)-[r:SAME_VENUE]->(b)
                SET r.venue = $venue
                """,
                articleId=article_id,
                relatedId=related_id,
                venue=venue,
            )

    async def sync_article_entities(
        self,
        *,
        article_id: int,
        project_id: int,
        authors: list[str],
        keywords: list[str],
        venue: str | None,
    ) -> None:
        """Create author/keyword/venue nodes connected to the article."""
        async with self.driver.session() as session:
            if authors:
                await session.run(
                    """
                    MATCH (a:Article {id: $articleId, projectId: $projectId})
                    UNWIND $authors AS authorName
                    MERGE (au:Author {projectId: $projectId, name: authorName})
                    MERGE (au)-[:AUTHORED]->(a)
                    """,
                    articleId=article_id,
                    projectId=project_id,
                    authors=authors,
                )

            if keywords:
                await session.run(
                    """
                    MATCH (a:Article {id: $articleId, projectId: $projectId})
                    UNWIND $keywords AS keywordTerm
                    MERGE (k:Keyword {projectId: $projectId, term: keywordTerm})
                    MERGE (a)-[:HAS_KEYWORD]->(k)
                    """,
                    articleId=article_id,
                    projectId=project_id,
                    keywords=keywords,
                )

            if venue:
                await session.run(
                    """
                    MATCH (a:Article {id: $articleId, projectId: $projectId})
                    MERGE (v:Venue {projectId: $projectId, name: $venue})
                    MERGE (a)-[:PUBLISHED_IN]->(v)
                    """,
                    articleId=article_id,
                    projectId=project_id,
                    venue=venue,
                )
    
    async def get_project_graph(
        self,
        project_id: int,
        relationship_type: str = "all",
        min_similarity: float = 0.5
    ) -> dict:
        """Get graph data for a project with optional relationship filter."""
        async with self.driver.session() as session:
            canonical_type = str(relationship_type or "all").strip().lower()
            aliases = {
                "authors": "same-author",
                "methodology": "same-methodology",
                "semantic": "similar-to",
                "keywords": "shares-keyword",
                "venue": "same-venue",
                "all": "all",
            }
            canonical_type = aliases.get(canonical_type, canonical_type)

            all_relationship_types = [
                "SIMILAR_TO",
                "SAME_METHODOLOGY",
                "SAME_AUTHOR",
                "SHARES_KEYWORD",
                "SAME_VENUE",
                "AUTHORED",
                "HAS_KEYWORD",
                "PUBLISHED_IN",
            ]

            single_type_map = {
                "similar-to": "SIMILAR_TO",
                "same-methodology": "SAME_METHODOLOGY",
                "same-author": "SAME_AUTHOR",
                "shares-keyword": "SHARES_KEYWORD",
                "same-venue": "SAME_VENUE",
                "authored": "AUTHORED",
                "has-keyword": "HAS_KEYWORD",
                "published-in": "PUBLISHED_IN",
            }

            min_similarity = max(0.0, min(float(min_similarity), 1.0))
            params = {
                "projectId": project_id,
                "minSimilarity": min_similarity,
            }

            if canonical_type == "all":
                where_clause = (
                    "type(r) IN $relationshipTypes "
                    "AND (type(r) <> 'SIMILAR_TO' OR coalesce(r.score, 1.0) >= $minSimilarity)"
                )
                params["relationshipTypes"] = all_relationship_types
            elif canonical_type == "similar-to":
                where_clause = "type(r) = 'SIMILAR_TO' AND coalesce(r.score, 1.0) >= $minSimilarity"
            elif canonical_type in single_type_map:
                where_clause = "type(r) = $relationshipType"
                params["relationshipType"] = single_type_map[canonical_type]
            else:
                where_clause = (
                    "type(r) IN $relationshipTypes "
                    "AND (type(r) <> 'SIMILAR_TO' OR coalesce(r.score, 1.0) >= $minSimilarity)"
                )
                params["relationshipTypes"] = all_relationship_types

            links_query = f"""
                MATCH (a {{projectId: $projectId}})-[r]-(b {{projectId: $projectId}})
                WHERE {where_clause}
                RETURN DISTINCT
                    CASE
                        WHEN 'Article' IN labels(a) THEN 'article:' + toString(a.id)
                        WHEN 'Author' IN labels(a) THEN 'author:' + coalesce(a.name, '')
                        WHEN 'Keyword' IN labels(a) THEN 'keyword:' + coalesce(a.term, '')
                        WHEN 'Venue' IN labels(a) THEN 'venue:' + coalesce(a.name, '')
                        ELSE 'node:' + elementId(a)
                    END AS source,
                    CASE
                        WHEN 'Article' IN labels(b) THEN 'article:' + toString(b.id)
                        WHEN 'Author' IN labels(b) THEN 'author:' + coalesce(b.name, '')
                        WHEN 'Keyword' IN labels(b) THEN 'keyword:' + coalesce(b.term, '')
                        WHEN 'Venue' IN labels(b) THEN 'venue:' + coalesce(b.name, '')
                        ELSE 'node:' + elementId(b)
                    END AS target,
                    toLower(replace(type(r), '_', '-')) AS type,
                    coalesce(r.score, 1.0) AS score
            """

            links_result = await session.run(links_query, **params)
            links = []
            async for record in links_result:
                links.append(
                    {
                        "source": str(record["source"]),
                        "target": str(record["target"]),
                        "type": record["type"],
                        "score": record["score"],
                    }
                )

            # Get all nodes from supported labels so filters can show one relation type at a time.
            nodes_result = await session.run(
                """
                MATCH (n {projectId: $projectId})
                WHERE n:Article OR n:Author OR n:Keyword OR n:Venue
                RETURN DISTINCT
                    CASE
                        WHEN n:Article THEN 'article:' + toString(n.id)
                        WHEN n:Author THEN 'author:' + coalesce(n.name, '')
                        WHEN n:Keyword THEN 'keyword:' + coalesce(n.term, '')
                        WHEN n:Venue THEN 'venue:' + coalesce(n.name, '')
                        ELSE 'node:' + elementId(n)
                    END as id,
                    CASE
                        WHEN n:Article THEN 'article'
                        WHEN n:Author THEN 'author'
                        WHEN n:Keyword THEN 'keyword'
                        WHEN n:Venue THEN 'venue'
                        ELSE 'node'
                    END as kind,
                    CASE
                        WHEN n:Article THEN n.title
                        WHEN n:Author THEN n.name
                        WHEN n:Keyword THEN n.term
                        WHEN n:Venue THEN n.name
                        ELSE 'N/A'
                    END as title,
                    n.authors as authors,
                    n.year as year,
                    coalesce(n.reviewOutcome, n.status) as status,
                    n.methodology as methodology,
                    n.domain as domain
                """,
                projectId=project_id,
            )
            nodes = []
            async for record in nodes_result:
                nodes.append({
                    "id": str(record["id"]),
                    "kind": record.get("kind") or "article",
                    "title": record["title"],
                    "authors": record["authors"],
                    "year": record["year"],
                    "status": record["status"] or "pendente",
                    "methodology": record["methodology"],
                    "domain": record["domain"]
                })

            return {"nodes": nodes, "links": links}
    
    async def delete_project_graph(self, project_id: int) -> None:
        """Delete all nodes and relationships for a project."""
        async with self.driver.session() as session:
            await session.run(
                """
                MATCH (n {projectId: $projectId})
                DETACH DELETE n
                """,
                projectId=project_id
            )

    async def mcp_query(self, cypher: str, params: dict | None = None) -> dict:
        """MCP wrapper for graph.query operations."""
        params = params or {}
        try:
            async with self.driver.session() as session:
                result = await session.run(cypher, **params)
                rows = [record.data() async for record in result]
                return {
                    "ok": True,
                    "method": "graph.query",
                    "rows": rows,
                    "rowCount": len(rows),
                }
        except Exception as exc:
            return {
                "ok": False,
                "method": "graph.query",
                "error": {
                    "category": "graph",
                    "message": str(exc),
                    "hint": "Validate Cypher syntax and Neo4j connectivity.",
                },
            }

    async def mcp_write(self, cypher: str, params: dict | None = None) -> dict:
        """MCP wrapper for graph.write operations."""
        params = params or {}
        try:
            async with self.driver.session() as session:
                result = await session.run(cypher, **params)
                summary = await result.consume()
                counters = summary.counters
                return {
                    "ok": True,
                    "method": "graph.write",
                    "counters": {
                        "nodesCreated": counters.nodes_created,
                        "nodesDeleted": counters.nodes_deleted,
                        "relationshipsCreated": counters.relationships_created,
                        "relationshipsDeleted": counters.relationships_deleted,
                    },
                }
        except Exception as exc:
            return {
                "ok": False,
                "method": "graph.write",
                "error": {
                    "category": "graph",
                    "message": str(exc),
                    "hint": "Validate write query and permissions.",
                },
            }

    async def mcp_health(self) -> dict:
        """MCP wrapper for graph.health operation."""
        try:
            async with self.driver.session() as session:
                await session.run("RETURN 1 as ok")
            return {
                "connected": True,
                "server": "neo4j",
                "details": {
                    "uri": settings.NEO4J_URI,
                },
            }
        except Exception as exc:
            return {
                "connected": False,
                "server": "neo4j",
                "details": {
                    "error": str(exc),
                    "hint": "Check Neo4j URI, credentials, and container status.",
                },
            }

    async def execute_expansion(
        self,
        ids: list[str],
        project_id: int,
        relations: list[str] | None = None,
        max_hops: int = 1, # Mantendo 1 salto como fallback seguro. max_hops=2 requer queries mais complexas ou APOC.
    ) -> dict:
        """
        MCP Tool 1: Navega o grafo a partir de artigos 'seed' para encontrar conexões.
        """
        if not ids:
            return {"related_papers": []}
            
        relations = relations or ["SAME_METHODOLOGY", "SIMILAR_TO", "SAME_AUTHOR", "SHARES_KEYWORD", "SAME_VENUE"]
        
        # Formata o Cypher para incluir as relações de forma dinâmica (protegido contra injeção pelo uso de params)
        rel_pattern = "|".join(relations)
        
        cypher = f"""
            MATCH (a:Article)
            WHERE a.projectId = $projectId AND a.paperId IN $seedIds
            MATCH (a)-[r:{rel_pattern}]-(related:Article)
            WHERE related.projectId = $projectId AND NOT related.paperId IN $seedIds
            RETURN DISTINCT related.id AS article_id,
                            related.paperId AS paper_id,
                            related.title AS title, 
                            related.methodology AS methodology, 
                            type(r) AS relation_type
            LIMIT 30
        """
        
        result = await self.mcp_query(cypher, params={"projectId": project_id, "seedIds": ids})
        
        if not result.get("ok"):
             raise RuntimeError(f"Neo4j expansion failed: {result.get('error')}")
             
        # Formata a resposta adicionando o source_type para a rastreabilidade (Fase 5)
        related_papers = []
        for row in result.get("rows", []):
            related_papers.append({
                "id": row["article_id"],
                "paper_id": row["paper_id"],
                "title": row["title"],
                "methodology": row["methodology"],
                "source_type": f"graph_expansion ({row['relation_type']})"
            })
            
        return {"related_papers": related_papers}

    async def cluster_project(self, project_id: int, limit: int = 12) -> dict:
        """Return coarse project clusters grouped by methodology/domain."""
        cypher = """
            MATCH (a:Article {projectId: $projectId})
            WITH coalesce(a.methodology, 'unknown') AS methodology,
                 coalesce(a.domain, 'unknown') AS domain,
                 collect(a) AS articles
            WITH methodology, domain, articles,
                 methodology + '|' + domain AS cluster_id
            UNWIND articles AS article
            OPTIONAL MATCH (au:Author {projectId: $projectId})-[:AUTHORED]->(article)
            WITH cluster_id, methodology, domain,
                 collect(DISTINCT article) AS cluster_articles,
                 collect(DISTINCT au.name) AS cluster_authors
            RETURN cluster_id,
                   methodology,
                   domain,
                   size(cluster_articles) AS article_count,
                   cluster_authors[..5] AS top_authors,
                   [article IN cluster_articles | {id: article.id, paper_id: article.paperId, title: article.title, authors: article.authors, year: article.year}][..5] AS sample_articles
            ORDER BY article_count DESC, cluster_id ASC
            LIMIT $limit
        """
        result = await self.mcp_query(cypher, params={"projectId": project_id, "limit": limit})
        if not result.get("ok"):
            raise RuntimeError(f"Neo4j cluster analysis failed: {result.get('error')}")
        return {"clusters": result.get("rows", [])}

    async def bridge_authors(self, project_id: int, limit: int = 10) -> dict:
        """Return authors spanning multiple methodology/domain clusters."""
        cypher = """
            MATCH (au:Author {projectId: $projectId})-[:AUTHORED]->(a:Article {projectId: $projectId})
            WITH au,
                 collect(DISTINCT coalesce(a.methodology, 'unknown') + '|' + coalesce(a.domain, 'unknown')) AS clusters,
                 count(DISTINCT a) AS article_count
            WHERE size(clusters) > 1
            RETURN au.name AS author,
                   size(clusters) AS cluster_count,
                   article_count,
                   clusters[..10] AS clusters
            ORDER BY cluster_count DESC, article_count DESC, author ASC
            LIMIT $limit
        """
        result = await self.mcp_query(cypher, params={"projectId": project_id, "limit": limit})
        if not result.get("ok"):
            raise RuntimeError(f"Neo4j bridge author analysis failed: {result.get('error')}")
        return {"bridge_authors": result.get("rows", [])}

    async def timeline_by_methodology(
        self,
        project_id: int,
        methodology: str | None = None,
    ) -> dict:
        """Return timeline aggregates by methodology and year."""
        cypher = """
            MATCH (a:Article {projectId: $projectId})
            WHERE $methodology IS NULL
               OR toLower(coalesce(a.methodology, '')) CONTAINS toLower($methodology)
            RETURN coalesce(a.methodology, 'unknown') AS methodology,
                   a.year AS year,
                   count(*) AS article_count,
                   collect(a.title)[..5] AS sample_titles
            ORDER BY year ASC, article_count DESC
        """
        result = await self.mcp_query(
            cypher,
            params={"projectId": project_id, "methodology": methodology},
        )
        if not result.get("ok"):
            raise RuntimeError(f"Neo4j methodology timeline failed: {result.get('error')}")
        return {"timeline": result.get("rows", [])}

    async def recommend_related_reads(
        self,
        project_id: int,
        paper_id: str | None = None,
        article_id: int | None = None,
        limit: int = 5,
    ) -> dict:
        """Recommend related reads using graph relationships and weighted signals."""
        cypher = """
            MATCH (source:Article {projectId: $projectId})
            WHERE ($paperId IS NOT NULL AND source.paperId = $paperId)
               OR ($articleId IS NOT NULL AND source.id = $articleId)
            MATCH (source)-[r]-(related:Article {projectId: $projectId})
            WHERE related.id <> source.id
              AND type(r) IN ['SIMILAR_TO', 'SAME_METHODOLOGY', 'SAME_AUTHOR', 'SHARES_KEYWORD', 'SAME_VENUE']
            RETURN related.id AS article_id,
                   related.paperId AS paper_id,
                   related.title AS title,
                   related.authors AS authors,
                   related.year AS year,
                   related.methodology AS methodology,
                   related.domain AS domain,
                   type(r) AS signal
        """
        result = await self.mcp_query(
            cypher,
            params={
                "projectId": project_id,
                "paperId": paper_id,
                "articleId": article_id,
                "limit": limit,
            },
        )
        if not result.get("ok"):
            raise RuntimeError(f"Neo4j related reads failed: {result.get('error')}")

        weights = {
            "SIMILAR_TO": 1.0,
            "SAME_METHODOLOGY": 0.6,
            "SHARES_KEYWORD": 0.45,
            "SAME_AUTHOR": 0.35,
            "SAME_VENUE": 0.2,
        }

        grouped: dict[tuple[int | None, str | None], dict] = {}
        for row in result.get("rows", []):
            key = (row.get("article_id"), row.get("paper_id"))
            if key == (None, None):
                continue

            item = grouped.setdefault(
                key,
                {
                    "article_id": row.get("article_id"),
                    "paper_id": row.get("paper_id"),
                    "title": row.get("title"),
                    "authors": row.get("authors"),
                    "year": row.get("year"),
                    "methodology": row.get("methodology"),
                    "domain": row.get("domain"),
                    "signals": [],
                    "score": 0.0,
                },
            )

            signal = row.get("signal")
            if signal and signal not in item["signals"]:
                item["signals"].append(signal)
            item["score"] += weights.get(signal, 0.1)

        recommendations = sorted(
            grouped.values(),
            key=lambda item: (item["score"], item.get("year") or 0, item.get("title") or ""),
            reverse=True,
        )[:limit]

        for item in recommendations:
            item["score"] = round(item["score"], 4)

        return {"recommendations": recommendations}

    async def find_author_topic_paths(
        self,
        project_id: int,
        author_query: str,
        topic_query: str,
        limit: int = 10,
    ) -> dict:
        """Find project articles that connect an author clue with a topic/keyword clue."""
        cypher = """
            MATCH (au:Author {projectId: $projectId})-[:AUTHORED]->(a:Article {projectId: $projectId})
            WHERE toLower(au.name) CONTAINS toLower($authorQuery)
            OPTIONAL MATCH (a)-[:HAS_KEYWORD]->(k:Keyword {projectId: $projectId})
            WITH au, a, collect(DISTINCT k.term) AS keywords
            WHERE any(term IN keywords WHERE toLower(term) CONTAINS toLower($topicQuery))
               OR toLower(coalesce(a.title, '')) CONTAINS toLower($topicQuery)
               OR toLower(coalesce(a.abstract, '')) CONTAINS toLower($topicQuery)
            RETURN au.name AS author,
                   a.id AS article_id,
                   a.paperId AS paper_id,
                   a.title AS title,
                   a.year AS year,
                   keywords[..10] AS keywords
        """
        result = await self.mcp_query(
            cypher,
            params={
                "projectId": project_id,
                "authorQuery": author_query,
                "topicQuery": topic_query,
                "limit": limit,
            },
        )
        if not result.get("ok"):
            raise RuntimeError(f"Neo4j author-topic path search failed: {result.get('error')}")

        paths = sorted(
            result.get("rows", []),
            key=lambda item: (item.get("year") or 0, item.get("title") or ""),
            reverse=True,
        )[:limit]
        return {"paths": paths}

    async def read_schema(self) -> dict:
        """
        Retorna as propriedades e labels disponíveis no grafo. 
        """
        return {
            "nodes": {
                "Article": ["id", "paperId", "projectId", "title", "authors", "year", "status", "currentPhase", "reviewOutcome", "methodology", "domain", "venue", "keywords", "abstract"],
                "Author": ["projectId", "name"],
                "Keyword": ["projectId", "term"],
                "Venue": ["projectId", "name"],
            },
            "relationships": [
                "SIMILAR_TO",
                "SAME_METHODOLOGY",
                "SAME_AUTHOR",
                "SHARES_KEYWORD",
                "SAME_VENUE",
                "AUTHORED",
                "HAS_KEYWORD",
                "PUBLISHED_IN",
            ]
        }
# Singleton instance
_neo4j_service: Neo4jService | None = None


def get_neo4j_service() -> Neo4jService:
    """Get or create Neo4j service instance."""
    global _neo4j_service
    if _neo4j_service is None:
        _neo4j_service = Neo4jService()
    return _neo4j_service
