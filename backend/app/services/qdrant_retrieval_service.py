from app.config import settings


class QdrantRetrievalService:
    """Qdrant adapter with mandatory project isolation for all searches."""

    def __init__(self):
        self.url = settings.QDRANT_URL
        self.collection = settings.QDRANT_COLLECTION

    async def search(
        self,
        *,
        query_embedding: list[float],
        project_id: int,
        top_k: int = 5,
    ) -> list[dict]:
        if project_id is None:
            raise ValueError("project_id is required for scoped retrieval")

        # Placeholder adapter result. The transport call to Qdrant should always
        # include payload filter: {"must": [{"key": "project_id", "match": {"value": project_id}}]}
        # before this service is switched to production retrieval mode.
        return []


_qdrant_retrieval_service: QdrantRetrievalService | None = None


def get_qdrant_retrieval_service() -> QdrantRetrievalService:
    global _qdrant_retrieval_service
    if _qdrant_retrieval_service is None:
        _qdrant_retrieval_service = QdrantRetrievalService()
    return _qdrant_retrieval_service
