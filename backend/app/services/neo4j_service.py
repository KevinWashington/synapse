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
                    RETURN a.id as source, b.id as target, type(r) as type,
                           CASE WHEN r.score IS NOT NULL THEN r.score ELSE 1.0 END as score
                """
            else:
                links_query = f"""
                    MATCH (a:Article {{projectId: $projectId}}){rel_pattern}(b:Article {{projectId: $projectId}})
                    RETURN a.id as source, b.id as target, type(r) as type,
                           CASE WHEN r.score IS NOT NULL THEN r.score ELSE 1.0 END as score
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


# Singleton instance
_neo4j_service: Neo4jService | None = None


def get_neo4j_service() -> Neo4jService:
    """Get or create Neo4j service instance."""
    global _neo4j_service
    if _neo4j_service is None:
        _neo4j_service = Neo4jService()
    return _neo4j_service
