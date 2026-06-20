import os
import numpy as np
from huggingface_hub import InferenceClient


class EmbeddingService:
    def __init__(self):
        self._client = None
        self.model_name = "allenai/specter2_base"

    def _get_client(self) -> InferenceClient:
        """Lazy load HF client."""
        if self._client is None:
            hf_token = os.getenv("HF_TOKEN")
            if not hf_token:
                raise ValueError("HF_TOKEN not set")

            self._client = InferenceClient(api_key=hf_token)

        return self._client

    # SPECTER2 has a 512-token limit; truncate by word count as a safe proxy
    _MAX_WORDS = 250

    def _truncate(self, text: str) -> str:
        words = text.split()
        if len(words) > self._MAX_WORDS:
            return " ".join(words[: self._MAX_WORDS])
        return text

    def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding using HF API."""
        if not text or not text.strip():
            return []

        client = self._get_client()

        embedding = client.feature_extraction(
            self._truncate(text),
            model=self.model_name,
        )

        # HF may return token-level embeddings as a 2D NumPy array.
        vector = self._normalize_embedding_output(embedding)
        return [float(x) for x in vector]

    def _normalize_embedding_output(self, embedding: object) -> np.ndarray:
        """Normalize HF embedding output into a 1D vector."""
        vector = np.asarray(embedding, dtype=np.float32)

        if vector.size == 0:
            return np.array([], dtype=np.float32)

        if vector.ndim == 0:
            return vector.reshape(1)

        if vector.ndim == 1:
            return vector

        # Mean pool any token/batch dimensions until only feature dimension remains.
        while vector.ndim > 1:
            vector = vector.mean(axis=0)

        return vector

    def calculate_similarity(
        self,
        embedding1: list[float],
        embedding2: list[float]
    ) -> float:
        if not embedding1 or not embedding2:
            return 0.0

        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)

        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return float(dot_product / (norm1 * norm2))

    def find_similar_embeddings(
        self,
        target_embedding: list[float],
        candidate_embeddings: list[tuple[int, list[float]]],
        min_similarity: float = 0.7
    ) -> list[tuple[int, float]]:
        similar = []

        for article_id, embedding in candidate_embeddings:
            if not embedding:
                continue

            similarity = self.calculate_similarity(target_embedding, embedding)
            if similarity >= min_similarity:
                similar.append((article_id, similarity))

        similar.sort(key=lambda x: x[1], reverse=True)
        return similar

_embedding_service: EmbeddingService | None = None

def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service