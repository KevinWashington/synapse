"""RAG service for project-level chat with semantic article retrieval."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models.article import Article
from app.models.project import Project
from app.config import settings
from app.services.embedding_service import get_embedding_service
from app.services.qdrant_retrieval_service import get_qdrant_retrieval_service


class RAGService:
    """Retrieval-Augmented Generation service.
    
    Uses SPECTER2 embeddings + pgvector to retrieve relevant articles
    from a project and assemble context for LLM responses.
    """
    
    def __init__(self):
        self.embedding = get_embedding_service()
        self.qdrant = get_qdrant_retrieval_service()
        self.retrieval_backend = (settings.RETRIEVAL_BACKEND or "pgvector").lower()
        self._diagnostics = {
            "requests": 0,
            "scopeDenied": 0,
            "lastProjectId": None,
            "lastBackend": self.retrieval_backend,
        }
    
    async def retrieve(
        self,
        query: str,
        project_id: int,
        db: AsyncSession,
        top_k: int = 5,
        owner_id: int | None = None,
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
        self._diagnostics["requests"] += 1
        self._diagnostics["lastProjectId"] = project_id

        # 1. Get the project data
        project = await db.get(Project, project_id)
        if not project:
            raise ValueError(f"Projeto {project_id} não encontrado")

        if owner_id is not None and project.ownerId != owner_id:
            self._diagnostics["scopeDenied"] += 1
            raise PermissionError("Projeto não pertence ao usuário autenticado")
        
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
        elif self.retrieval_backend == "qdrant":
            rows = await self.qdrant.search(
                query_embedding=query_embedding,
                project_id=project_id,
                top_k=top_k,
            )
            articles = rows
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
            if isinstance(art, dict):
                retrieved_articles.append({
                    "id": art.get("id"),
                    "title": art.get("title", "N/A"),
                    "authors": art.get("authors"),
                    "year": art.get("year"),
                    "journal": art.get("journal"),
                    "abstract": art.get("abstract"),
                    "notas": art.get("notas"),
                    "methodology": art.get("methodology"),
                    "domain": art.get("domain"),
                    "keywords": art.get("keywords"),
                    "distance": art.get("distance"),
                })
            elif hasattr(art, 'id'):
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

    def diagnostics(self) -> dict:
        return {
            "backend": self.retrieval_backend,
            "requests": self._diagnostics["requests"],
            "scopeDenied": self._diagnostics["scopeDenied"],
            "lastProjectId": self._diagnostics["lastProjectId"],
            "projectScopeEnforced": True,
        }


# Singleton
_rag_service: RAGService | None = None


def get_rag_service() -> RAGService:
    """Get or create RAG service instance."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
