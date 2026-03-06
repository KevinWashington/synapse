"""Graph synchronization service for maintaining article relationships in Neo4j."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.article import Article
from app.services.neo4j_service import get_neo4j_service
from app.services.embedding_service import get_embedding_service


class GraphSyncService:
    """Service for synchronizing article data with Neo4j graph database."""
    
    def __init__(self):
        self.neo4j = get_neo4j_service()
        self.embedding = get_embedding_service()
    
    async def sync_article_to_graph(
        self,
        article: Article,
        db: AsyncSession
    ) -> None:
        """Sync a single article to Neo4j and create relationships with existing articles."""
        
        # Create/update node in Neo4j
        await self.neo4j.create_article_node(
            article_id=article.id,
            project_id=article.projectId,
            title=article.title,
            authors=article.authors,
            year=article.year,
            status=article.status,
            methodology=article.aiMethodology,
            domain=article.aiDomain
        )
        print(f"[GRAPH] Node created for article {article.id}")
        
        # Get all other articles in the same project
        result = await db.execute(
            select(Article).where(
                Article.projectId == article.projectId,
                Article.id != article.id
            )
        )
        other_articles = result.scalars().all()
        
        if not other_articles:
            print(f"[GRAPH] No other articles in project to create relationships")
            return
        
        print(f"[GRAPH] Comparing with {len(other_articles)} other articles...")
        
        # Create relationships based on various criteria
        for other in other_articles:
            # Semantic similarity (if both have embeddings)
            if article.embedding is not None and other.embedding is not None:
                similarity = self.embedding.calculate_similarity(
                    list(article.embedding),
                    list(other.embedding)
                )
                print(f"[GRAPH] Similarity({article.id} <-> {other.id}): {similarity:.4f}")
                if similarity >= 0.92:  # High threshold - papers in same domain score 0.85+
                    await self.neo4j.create_semantic_relationship(
                        article.id, other.id, round(similarity, 4)
                    )
                    print(f"[GRAPH] Created SIMILAR_TO relationship: {article.id} -> {other.id} (score={similarity:.4f})")
            else:
                has_emb = article.embedding is not None
                other_has_emb = other.embedding is not None
                print(f"[GRAPH] Skipping similarity: article.embedding={has_emb}, other({other.id}).embedding={other_has_emb}")
            
            # Same methodology (exclude 'other' since it's meaningless)
            if (article.aiMethodology and other.aiMethodology and 
                article.aiMethodology == other.aiMethodology and
                article.aiMethodology != "other"):
                await self.neo4j.create_same_methodology_relationship(
                    article.id, other.id
                )
                print(f"[GRAPH] Created SAME_METHODOLOGY: {article.id} -> {other.id} ({article.aiMethodology})")
            
            
            # Same authors (check for overlap)
            shared_authors = self._find_shared_authors(
                article.authors, other.authors
            )
            if shared_authors:
                await self.neo4j.create_same_author_relationship(
                    article.id, other.id, shared_authors
                )
                print(f"[GRAPH] Created SAME_AUTHOR: {article.id} -> {other.id} ({shared_authors})")
    
    def _find_shared_authors(
        self,
        authors1: str,
        authors2: str
    ) -> list[str]:
        """Find shared authors between two author strings."""
        if not authors1 or not authors2:
            return []
        
        # Split authors by common separators and normalize
        def normalize_author(name: str) -> str:
            return name.strip().lower()
        
        def split_authors(authors: str) -> set[str]:
            # Try common separators
            for sep in [";", " and ", ", "]:
                if sep in authors:
                    return {normalize_author(a) for a in authors.split(sep) if a.strip()}
            return {normalize_author(authors)}
        
        set1 = split_authors(authors1)
        set2 = split_authors(authors2)
        
        shared = set1 & set2
        return list(shared) if shared else []
    
    async def delete_article_from_graph(self, article_id: int) -> None:
        """Remove an article and its relationships from Neo4j."""
        await self.neo4j.delete_article_node(article_id)


# Singleton
_graph_sync_service: GraphSyncService | None = None


def get_graph_sync_service() -> GraphSyncService:
    """Get or create graph sync service instance."""
    global _graph_sync_service
    if _graph_sync_service is None:
        _graph_sync_service = GraphSyncService()
    return _graph_sync_service
