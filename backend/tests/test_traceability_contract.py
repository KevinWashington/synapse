import pytest

from app.schemas.ai import ProjectChatRequest
from app.routers import ai as ai_router


class FakeDB:
    def __init__(self, project):
        self._project = project

    async def get(self, model, project_id):
        return self._project


class FakeRAG:
    async def retrieve(self, query, project_id, db, top_k=5, owner_id=None):
        return {
            "project": {"title": "P", "objetivo": "O"},
            "articles": [
                {
                    "id": 10,
                    "title": "A1",
                    "authors": "X",
                    "year": 2024,
                    "paper_id": "paper-a1",
                    "provenance": {
                        "subsystem": "vector",
                        "backend": "pgvector",
                        "projectId": project_id,
                        "paperId": "paper-a1",
                        "distance": 0.12,
                    },
                }
            ],
        }


class FakeAI:
    async def chat_project(self, message, project_context, retrieved_articles):
        return "ok"


@pytest.mark.asyncio
async def test_project_chat_response_includes_provenance(monkeypatch, fake_user, fake_project):
    monkeypatch.setattr(ai_router, "get_rag_service", lambda: FakeRAG())
    monkeypatch.setattr(ai_router, "get_ai_service", lambda: FakeAI())

    req = ProjectChatRequest(messages=[{"role": "user", "content": "q"}], projectId=1)
    res = await ai_router.project_chat(data=req, current_user=fake_user, db=FakeDB(fake_project))

    assert res.provenance is not None
    assert res.provenance.projectId == 1
    assert res.provenance.traceabilityComplete is True
    assert res.sources[0].paperId == "paper-a1"
    assert res.sources[0].provenance["backend"] == "pgvector"
