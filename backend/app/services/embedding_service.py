"""Embedding service using SPECTER2 for scientific article similarity."""

import numpy as np
import torch
from transformers import AutoTokenizer, AutoModel


class EmbeddingService:
    """Service for generating embeddings from article abstracts using SPECTER2 base.
    
    Uses allenai/specter2_base which is pre-trained on scientific papers
    and produces 768-dimensional embeddings optimized for academic text.
    """
    
    def __init__(self):
        self._model = None
        self._tokenizer = None
    
    def _load_model(self):
        """Load SPECTER2 base model."""
        if self._model is None:
            print("[EMBEDDING] Loading SPECTER2 base model (allenai/specter2_base)...")
            self._tokenizer = AutoTokenizer.from_pretrained("allenai/specter2_base")
            self._model = AutoModel.from_pretrained("allenai/specter2_base")
            self._model.eval()
            print("[EMBEDDING] SPECTER2 base model loaded successfully! (768 dims)")
    
    def generate_embedding(self, text: str) -> list[float]:
        """Generate embedding for a text (typically an abstract).
        
        Args:
            text: The text to embed (abstract, title+abstract, etc.)
            
        Returns:
            List of floats representing the embedding vector (768 dimensions)
        """
        if not text or not text.strip():
            return []
        
        self._load_model()
        
        # Tokenize and encode
        inputs = self._tokenizer(
            text,
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=512
        )
        
        with torch.no_grad():
            output = self._model(**inputs)
        
        # Use CLS token embedding (first token)
        embedding = output.last_hidden_state[:, 0, :].squeeze().numpy()
        return embedding.tolist()
    
    def calculate_similarity(
        self,
        embedding1: list[float],
        embedding2: list[float]
    ) -> float:
        """Calculate cosine similarity between two embeddings.
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Cosine similarity score between 0 and 1
        """
        if not embedding1 or not embedding2:
            return 0.0
        
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        # Cosine similarity
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
        """Find embeddings similar to a target embedding.
        
        Args:
            target_embedding: The embedding to compare against
            candidate_embeddings: List of (article_id, embedding) tuples
            min_similarity: Minimum similarity threshold
            
        Returns:
            List of (article_id, similarity_score) tuples above threshold
        """
        similar = []
        
        for article_id, embedding in candidate_embeddings:
            if not embedding:
                continue
            
            similarity = self.calculate_similarity(target_embedding, embedding)
            if similarity >= min_similarity:
                similar.append((article_id, similarity))
        
        # Sort by similarity descending
        similar.sort(key=lambda x: x[1], reverse=True)
        return similar


# Singleton instance
_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    """Get or create embedding service instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
