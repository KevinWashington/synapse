from app.config import settings
from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models
from app.services.embedding_service import get_embedding_service


class QdrantRetrievalService:
    """Qdrant adapter with mandatory project isolation for all searches."""

    def __init__(self):
        self.url = settings.QDRANT_URL
        self.collection = settings.QDRANT_COLLECTION
        self.client = AsyncQdrantClient(url=self.url)
        self.vector_size = 768
        self._collection_ready = False

    async def _ensure_collection(self) -> None:
        if self._collection_ready:
            return

        try:
            await self.client.get_collection(self.collection)
        except Exception:
            await self.client.create_collection(
                collection_name=self.collection,
                vectors_config=models.VectorParams(
                    size=self.vector_size,
                    distance=models.Distance.COSINE,
                ),
            )

        self._collection_ready = True

    async def search(
        self,
        *,
        query: str = "",
        query_embedding: list[float] | None = None,
        project_id: int,
        top_k: int = 5,
    ) -> dict:
        if project_id is None:
            raise ValueError("project_id is required for scoped retrieval")

        if not query_embedding:
            if not query:
                raise ValueError("Either 'query' or 'query_embedding' must be provided.")
            embedding_service = get_embedding_service()
            query_embedding = embedding_service.generate_embedding(query)

        project_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="project_id",
                    match=models.MatchValue(value=project_id),
                )
            ]
        )

        try:
            await self._ensure_collection()
            response = await self.client.query_points(
                collection_name=self.collection,
                query=query_embedding,
                query_filter=project_filter,
                limit=top_k,
                with_payload=True,
            )
            search_results = response.points

            papers = []
            for hit in search_results:
                payload = hit.payload or {}
                paper_id = payload.get("paper_id")
                provenance = {
                    "subsystem": "vector",
                    "backend": "qdrant",
                    "projectId": project_id,
                    "paperId": paper_id,
                    "distance": round(hit.score, 4),
                }
                papers.append({
                    "id": payload.get("article_id"),
                    "paper_id": payload.get("paper_id"),
                    "title": payload.get("title", "N/A"),
                    "authors": payload.get("authors"),
                    "year": payload.get("year"),
                    "journal": payload.get("journal"),
                    "abstract": payload.get("abstract"),
                    "methodology": payload.get("methodology"),
                    "domain": payload.get("domain"),
                    "keywords": payload.get("keywords"),
                    "notas": payload.get("notas"),
                    "distance": round(hit.score, 4),
                    "source_type": "vector",
                    "provenance": provenance,
                })

            return {
                "papers": papers, 
                "provenance": {
                    "subsystem": "vector",
                    "backend": "qdrant",
                    "projectId": project_id
                }
            }
            
        except Exception as e:
            raise RuntimeError(f"Qdrant search failed: {str(e)}")

    def build_payload(self, *, paper_id: str, project_id: int, metadata: dict | None = None) -> dict:
        payload = {
            "paper_id": paper_id,
            "project_id": project_id,
        }
        if metadata:
            payload.update(metadata)
        self._validate_payload(payload)
        return payload

    async def upsert_payload(self, *, payload: dict, embedding: list[float]) -> dict:
        self._validate_payload(payload)

        if not embedding:
            raise ValueError("embedding is required for vector upsert")

        await self._ensure_collection()

        point_id = payload.get("article_id") or payload.get("paper_id")
        await self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload,
                )
            ],
        )

        return {
            "ok": True,
            "collection": self.collection,
            "vector_size": len(embedding),
            "point_id": point_id,
            "payload": payload,
            "provenance": {
                "subsystem": "vector",
                "backend": "qdrant",
                "projectId": payload.get("project_id"),
                "paperId": payload.get("paper_id"),
            },
        }

    async def inspect_anchor_consistency(self, project_id: int) -> dict:
        if project_id is None:
            raise ValueError("project_id is required for anchor inspection")

        await self._ensure_collection()

        project_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="project_id",
                    match=models.MatchValue(value=project_id),
                )
            ]
        )

        total = 0
        missing_anchor = 0
        next_offset = None

        while True:
            points, next_offset = await self.client.scroll(
                collection_name=self.collection,
                scroll_filter=project_filter,
                limit=256,
                offset=next_offset,
                with_payload=["paper_id"],
                with_vectors=False,
            )

            if not points:
                break

            total += len(points)
            for point in points:
                payload = point.payload or {}
                if not payload.get("paper_id"):
                    missing_anchor += 1

            if next_offset is None:
                break

        return {
            "project_id": project_id,
            "expected_fields": ["paper_id", "project_id"],
            "vector_anchor_count": total - missing_anchor,
            "vector_missing_anchor_count": missing_anchor,
            "provenance": {
                "subsystem": "vector",
                "backend": "qdrant",
                "projectId": project_id,
            },
            "note": "Counts computed from live Qdrant payload scan with project isolation.",
        }

    async def mcp_health(self) -> dict:
        try:
            await self.client.get_collections()
            return {
                "connected": True,
                "server": "qdrant",
                "details": {
                    "url": self.url,
                    "collection": self.collection,
                },
            }
        except Exception as exc:
            return {
                "connected": False,
                "server": "qdrant",
                "details": {
                    "url": self.url,
                    "collection": self.collection,
                    "error": str(exc),
                },
            }

    def _validate_payload(self, payload: dict) -> None:
        if payload.get("project_id") is None:
            raise ValueError("project_id is required in vector payload")
        paper_id = payload.get("paper_id")
        if paper_id is None or not str(paper_id).strip():
            raise ValueError("paper_id is required in vector payload")


_qdrant_retrieval_service: QdrantRetrievalService | None = None

def get_qdrant_retrieval_service() -> QdrantRetrievalService:
    global _qdrant_retrieval_service
    if _qdrant_retrieval_service is None:
        _qdrant_retrieval_service = QdrantRetrievalService()
    return _qdrant_retrieval_service
