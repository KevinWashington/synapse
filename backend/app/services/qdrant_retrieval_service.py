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
        return {
            "ok": True,
            "collection": self.collection,
            "vector_size": len(embedding),
            "payload": payload,
        }

    async def inspect_anchor_consistency(self, project_id: int) -> dict:
        if project_id is None:
            raise ValueError("project_id is required for anchor inspection")
        return {
            "project_id": project_id,
            "expected_fields": ["paper_id", "project_id"],
            "vector_anchor_count": 0,
            "vector_missing_anchor_count": 0,
            "note": "Qdrant integration placeholder: counts available after live adapter wiring.",
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
