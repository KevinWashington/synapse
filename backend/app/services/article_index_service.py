"""Maintain reconstructible graph/vector projections independently of HTTP handlers."""

import asyncio
import hashlib
import logging

logger = logging.getLogger(__name__)
EXTERNAL_TIMEOUT = 30


async def _external_call(operation):
    return await asyncio.wait_for(operation, timeout=EXTERNAL_TIMEOUT)


class ArticleIndexService:
    def __init__(self, graph, vector, embedder):
        self.graph = graph
        self.vector = vector
        self.embedder = embedder

    async def sync(self, article, db) -> None:
        if article.reviewOutcome != "included":
            await self.remove(article_id=article.id, project_id=article.projectId)
            return
        failures = []
        embedding = None
        try:
            existing = await _external_call(
                self.vector.get_article_point(article_id=article.id, project_id=article.projectId)
            )
            text = (article.abstract or "").strip()
            fingerprint = hashlib.sha256(text.encode("utf-8")).hexdigest()
            existing_payload = (existing or {}).get("payload") or {}
            if existing and (
                not text or existing_payload.get("embedding_fingerprint") == fingerprint
            ):
                embedding = existing["vector"]
                fingerprint = existing_payload.get("embedding_fingerprint", fingerprint)
            elif text:
                embedding = getattr(article, "_embedding_cache", None)
                if not embedding:
                    embedding = await _external_call(
                        asyncio.to_thread(self.embedder.generate_embedding, text)
                    )
                if not embedding:
                    raise RuntimeError("Embedding generation returned no vector")
            if embedding and article.paperId:
                metadata = {
                    "article_id": article.id,
                    "embedding_fingerprint": fingerprint,
                    "review_outcome": article.reviewOutcome,
                    "phase": article.currentPhase,
                }
                for source, target in (
                    ("title", "title"),
                    ("authors", "authors"),
                    ("year", "year"),
                    ("journal", "journal"),
                    ("abstract", "abstract"),
                    ("aiMethodology", "methodology"),
                    ("aiDomain", "domain"),
                    ("aiKeywords", "keywords"),
                    ("notas", "notas"),
                    ("sourceName", "source_name"),
                ):
                    metadata[target] = getattr(article, source, None)
                payload = self.vector.build_payload(
                    paper_id=article.paperId, project_id=article.projectId, metadata=metadata
                )
                await _external_call(
                    self.vector.upsert_payload(payload=payload, embedding=embedding)
                )
        except Exception as exc:
            failures.append(exc)
        try:
            await self.graph.sync_article_to_graph(article, db, embedding=embedding)
        except Exception as exc:
            failures.append(exc)
        if failures:
            raise RuntimeError("Article index synchronization failed") from failures[0]

    async def remove(self, *, article_id: int, project_id: int) -> None:
        failures = []
        for remove in (self.graph.delete_article_from_graph, self.vector.delete_article):
            try:
                await _external_call(remove(article_id))
            except Exception as exc:
                failures.append(exc)
        if failures:
            raise RuntimeError("Article index removal failed") from failures[0]


def get_article_index_service() -> ArticleIndexService:
    from app.services.embedding_service import get_embedding_service
    from app.services.graph_sync_service import get_graph_sync_service
    from app.services.qdrant_retrieval_service import get_qdrant_retrieval_service

    return ArticleIndexService(
        get_graph_sync_service(), get_qdrant_retrieval_service(), get_embedding_service()
    )


async def sync_article_indexes(article, db) -> None:
    """Transitional best effort entry point; durable delivery replaces it in the jobs layer."""
    try:
        await get_article_index_service().sync(article, db)
    except Exception:
        logger.exception("Article %s index synchronization failed", article.id)
