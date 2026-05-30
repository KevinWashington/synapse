from pathlib import Path
import sys
import types

import pytest
from sqlalchemy.types import UserDefinedType


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _install_optional_ai_stubs() -> None:
    """Provide lightweight stubs for optional AI SDK modules used by ai_service imports."""
    if "langchain_openai" not in sys.modules:
        mod = types.ModuleType("langchain_openai")

        class ChatOpenAI:  # pragma: no cover - import stub only
            def __init__(self, *args, **kwargs):
                pass

        mod.ChatOpenAI = ChatOpenAI
        sys.modules["langchain_openai"] = mod

    if "langchain_core.prompts" not in sys.modules:
        prompts_mod = types.ModuleType("langchain_core.prompts")

        class ChatPromptTemplate:  # pragma: no cover - import stub only
            @classmethod
            def from_messages(cls, *args, **kwargs):
                return cls()

            def __or__(self, other):
                return other

        prompts_mod.ChatPromptTemplate = ChatPromptTemplate
        sys.modules["langchain_core.prompts"] = prompts_mod

    if "langchain_core.output_parsers" not in sys.modules:
        parser_mod = types.ModuleType("langchain_core.output_parsers")

        class StrOutputParser:  # pragma: no cover - import stub only
            def __or__(self, other):
                return other

        parser_mod.StrOutputParser = StrOutputParser
        sys.modules["langchain_core.output_parsers"] = parser_mod

    if "pgvector.sqlalchemy" not in sys.modules:
        pgvector_pkg = sys.modules.get("pgvector", types.ModuleType("pgvector"))
        sqlalchemy_mod = types.ModuleType("pgvector.sqlalchemy")

        class Vector(UserDefinedType):  # pragma: no cover - import stub only
            def __init__(self, *args, **kwargs):
                pass

            def get_col_spec(self, **kw):
                return "VECTOR"

        sqlalchemy_mod.Vector = Vector
        pgvector_pkg.sqlalchemy = sqlalchemy_mod
        sys.modules["pgvector"] = pgvector_pkg
        sys.modules["pgvector.sqlalchemy"] = sqlalchemy_mod

    if "neo4j" not in sys.modules:
        neo4j_mod = types.ModuleType("neo4j")

        class _Driver:  # pragma: no cover - import stub only
            async def close(self):
                return None

            def session(self):
                class _Session:
                    async def __aenter__(self):
                        return self

                    async def __aexit__(self, exc_type, exc, tb):
                        return None

                return _Session()

        class AsyncGraphDatabase:  # pragma: no cover - import stub only
            @staticmethod
            def driver(*args, **kwargs):
                return _Driver()

        neo4j_mod.AsyncGraphDatabase = AsyncGraphDatabase
        sys.modules["neo4j"] = neo4j_mod

    if "app.models.article" not in sys.modules:
        article_mod = types.ModuleType("app.models.article")

        class Article:  # pragma: no cover - import stub only
            projectId = None
            abstract = None

        article_mod.Article = Article
        sys.modules["app.models.article"] = article_mod

    if "app.services.embedding_service" not in sys.modules:
        embedding_mod = types.ModuleType("app.services.embedding_service")

        class _EmbeddingService:  # pragma: no cover - import stub only
            def generate_embedding(self, _text):
                return []

        _embedding = _EmbeddingService()

        def get_embedding_service():
            return _embedding

        embedding_mod.get_embedding_service = get_embedding_service
        sys.modules["app.services.embedding_service"] = embedding_mod

    if "app.services.qdrant_retrieval_service" not in sys.modules:
        qdrant_mod = types.ModuleType("app.services.qdrant_retrieval_service")

        class _QdrantRetrievalService:  # pragma: no cover - import stub only
            async def search(self, *args, **kwargs):
                return []

        _qdrant = _QdrantRetrievalService()

        def get_qdrant_retrieval_service():
            return _qdrant

        qdrant_mod.get_qdrant_retrieval_service = get_qdrant_retrieval_service
        sys.modules["app.services.qdrant_retrieval_service"] = qdrant_mod


_install_optional_ai_stubs()


@pytest.fixture
def fake_user():
    class User:
        id = 1

    return User()


@pytest.fixture
def fake_project():
    class Project:
        id = 1
        ownerId = 1

    return Project()
