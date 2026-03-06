"""RAG service for project-level chat with semantic article retrieval."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models.article import Article
from app.models.project import Project
from app.services.embedding_service import get_embedding_service


class RAGService:
    """Retrieval-Augmented Generation service.
    
    Uses SPECTER2 embeddings + pgvector to retrieve relevant articles
    from a project and assemble context for LLM responses.
    """
    
    def __init__(self):
        self.embedding = get_embedding_service()
    
    async def retrieve(
        self,
        query: str,
        project_id: int,
        db: AsyncSession,
        top_k: int = 5
    ) -> dict:
        """Retrieve relevant articles and project context for a query.
        
        Args:
            query: User's question
            project_id: ID of the project to search within
            db: Database session
            top_k: Number of articles to retrieve
            
        Returns:
            Dict with 'project' context and 'articles' list of retrieved articles
        """
        # 1. Get the project data
        project = await db.get(Project, project_id)
        if not project:
            raise ValueError(f"Projeto {project_id} não encontrado")
        
        project_context = {
            "title": project.title,
            "objetivo": project.objetivo,
            "picoc": project.picoc or {},
            "researchQuestions": project.researchQuestions or [],
            "criteriosInclusao": project.criteriosInclusao or [],
            "criteriosExclusao": project.criteriosExclusao or [],
        }
        
        # 2. Generate embedding for the query
        query_embedding = self.embedding.generate_embedding(query)
        
        if not query_embedding:
            # Fallback: return articles without semantic ranking
            result = await db.execute(
                select(Article).where(
                    Article.projectId == project_id,
                    Article.abstract.isnot(None)
                ).limit(top_k)
            )
            articles = result.scalars().all()
        else:
            # 3. Vector search using pgvector cosine distance (<=>)
            embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
            
            result = await db.execute(
                text("""
                    SELECT id, title, authors, year, journal, abstract, notas,
                           "aiMethodology", "aiDomain", "aiKeywords",
                           embedding <=> :query_embedding AS distance
                    FROM articles
                    WHERE "projectId" = :project_id
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> :query_embedding
                    LIMIT :top_k
                """),
                {
                    "query_embedding": embedding_str,
                    "project_id": project_id,
                    "top_k": top_k
                }
            )
            articles = result.fetchall()
        
        # 4. Format retrieved articles
        retrieved_articles = []
        for art in articles:
            if hasattr(art, 'id'):
                # SQLAlchemy model object (fallback path)
                retrieved_articles.append({
                    "id": art.id,
                    "title": art.title,
                    "authors": art.authors,
                    "year": art.year,
                    "journal": art.journal,
                    "abstract": art.abstract,
                    "notas": art.notas,
                    "methodology": art.aiMethodology,
                    "domain": art.aiDomain,
                    "keywords": art.aiKeywords,
                    "distance": None,
                })
            else:
                # Raw row from vector search
                retrieved_articles.append({
                    "id": art.id,
                    "title": art.title,
                    "authors": art.authors,
                    "year": art.year,
                    "journal": art.journal,
                    "abstract": art.abstract,
                    "notas": art.notas,
                    "methodology": art.aiMethodology,
                    "domain": art.aiDomain,
                    "keywords": art.aiKeywords,
                    "distance": round(float(art.distance), 4) if art.distance else None,
                })
        
        return {
            "project": project_context,
            "articles": retrieved_articles,
        }


# Singleton
_rag_service: RAGService | None = None


def get_rag_service() -> RAGService:
    """Get or create RAG service instance."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
