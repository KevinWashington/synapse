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
        project_id: int,
        title: str,
        authors: str,
        year: int,
        status: str = "pendente",
        methodology: str | None = None,
        domain: str | None = None
    ) -> None:
        """Create or update an article node in Neo4j."""
        async with self.driver.session() as session:
            await session.run(
                """
                MERGE (a:Article {id: $id})
                SET a.projectId = $projectId,
                    a.title = $title,
                    a.authors = $authors,
                    a.year = $year,
                    a.status = $status,
                    a.methodology = $methodology,
                    a.domain = $domain
                """,
                id=article_id,
                projectId=project_id,
                title=title,
                authors=authors,
                year=year,
                status=status,
                methodology=methodology,
                domain=domain
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
    
    async def get_project_graph(
        self,
        project_id: int,
        relationship_type: str = "all",
        min_similarity: float = 0.5
    ) -> dict:
        """Get graph data for a project with optional relationship filter."""
        async with self.driver.session() as session:
            # Build relationship pattern based on type
            if relationship_type == "semantic":
                rel_pattern = f"-[r:SIMILAR_TO WHERE r.score >= {min_similarity}]->"
            elif relationship_type == "methodology":
                rel_pattern = "-[r:SAME_METHODOLOGY]->"
            elif relationship_type == "authors":
                rel_pattern = "-[r:SAME_AUTHOR]->"
            else:  # all
                rel_pattern = "-[r]->"
            
            # Get nodes
            nodes_result = await session.run(
                """
                MATCH (a:Article {projectId: $projectId})
                RETURN a.id as id, a.title as title, a.authors as authors,
                       a.year as year, a.status as status, a.methodology as methodology,
                       a.domain as domain
                """,
                projectId=project_id
            )
            nodes = []
            async for record in nodes_result:
                nodes.append({
                    "id": str(record["id"]),
                    "title": record["title"],
                    "authors": record["authors"],
                    "year": record["year"],
                    "status": record["status"] or "pendente",
                    "methodology": record["methodology"],
                    "domain": record["domain"]
                })
            
            # Get links based on relationship type
            if relationship_type == "all":
                links_query = """
                    MATCH (a:Article {projectId: $projectId})-[r]->(b:Article {projectId: $projectId})
                    WITH
                        CASE WHEN a.id < b.id THEN a.id ELSE b.id END as source,
                        CASE WHEN a.id < b.id THEN b.id ELSE a.id END as target,
                        type(r) as type,
                        CASE WHEN r.score IS NOT NULL THEN r.score ELSE 1.0 END as score
                    RETURN source, target, type, max(score) as score
                """
            else:
                links_query = f"""
                    MATCH (a:Article {{projectId: $projectId}}){rel_pattern}(b:Article {{projectId: $projectId}})
                    WITH
                        CASE WHEN a.id < b.id THEN a.id ELSE b.id END as source,
                        CASE WHEN a.id < b.id THEN b.id ELSE a.id END as target,
                        type(r) as type,
                        CASE WHEN r.score IS NOT NULL THEN r.score ELSE 1.0 END as score
                    RETURN source, target, type, max(score) as score
                """
            
            links_result = await session.run(links_query, projectId=project_id)
            links = []
            async for record in links_result:
                links.append({
                    "source": str(record["source"]),
                    "target": str(record["target"]),
                    "type": record["type"].lower().replace("_", "-"),
                    "score": record["score"]
                })
            
            return {"nodes": nodes, "links": links}
    
    async def delete_project_graph(self, project_id: int) -> None:
        """Delete all nodes and relationships for a project."""
        async with self.driver.session() as session:
            await session.run(
                """
                MATCH (a:Article {projectId: $projectId})
                DETACH DELETE a
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
            
        relations = relations or ["SAME_METHODOLOGY", "SIMILAR_TO", "SAME_AUTHOR"]
        
        # Formata o Cypher para incluir as relações de forma dinâmica (protegido contra injeção pelo uso de params)
        rel_pattern = "|".join(relations)
        
        cypher = f"""
            MATCH (a:Article)
            WHERE a.projectId = $projectId AND a.id IN $seedIds
            MATCH (a)-[r:{rel_pattern}]-(related:Article)
            WHERE related.projectId = $projectId AND NOT related.id IN $seedIds
            RETURN DISTINCT related.id AS paper_id, 
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
                "paper_id": row["paper_id"],
                "title": row["title"],
                "methodology": row["methodology"],
                "source_type": f"graph_expansion ({row['relation_type']})"
            })
            
        return {"related_papers": related_papers}

    async def read_schema(self) -> dict:
        """
        Retorna as propriedades e labels disponíveis no grafo. 
        """
        return {
            "nodes": {
                "Article": ["id", "projectId", "title", "authors", "year", "status", "methodology", "domain"]
            },
            "relationships": ["SIMILAR_TO", "SAME_METHODOLOGY", "SAME_AUTHOR"]
        }
# Singleton instance
_neo4j_service: Neo4jService | None = None


def get_neo4j_service() -> Neo4jService:
    """Get or create Neo4j service instance."""
    global _neo4j_service
    if _neo4j_service is None:
        _neo4j_service = Neo4jService()
    return _neo4j_service
