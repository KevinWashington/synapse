"""Isolated E2E harness: real databases, deterministic local embeddings.

Never used by production startup. Sessions must belong to this disposable database.
"""

import asyncio
import hashlib
import os
import sys

from app.config import settings
from app.services.embedding_service import EmbeddingService


def deterministic_embedding(_self, text):
    digest = hashlib.sha256(text.encode()).digest()
    return [(digest[index % len(digest)] + 1) / 256 for index in range(768)]


if __name__ == "__main__":
    if settings.APP_ENV != "test" or "test" not in settings.DATABASE_URL:
        raise RuntimeError("E2E harness requires APP_ENV=test and a dedicated test database")
    settings.ALLOWED_ORIGINS = os.getenv("E2E_FRONTEND_ORIGIN", "http://localhost:3017")
    EmbeddingService.generate_embedding = deterministic_embedding
    if "--worker" in sys.argv:
        from app.index_worker import main
        from argparse import Namespace

        asyncio.run(main(Namespace(reconcile_project=None, apply=False)))
    else:
        import uvicorn

        uvicorn.run("app.main:app", host="0.0.0.0", port=5000)
