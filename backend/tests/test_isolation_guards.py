import pytest
from fastapi import HTTPException

from app.schemas.ai import ProjectChatRequest
from app.routers import ai as ai_router
from app.services.rag_service import RAGService


class FakeDB:
    def __init__(self, project):
        self._project = project

    async def get(self, model, project_id):
        return self._project


class Project:
    def __init__(self, project_id, owner_id):
        self.id = project_id
        self.ownerId = owner_id
        self.title = "P"
        self.objetivo = "O"
        self.picoc = {}
        self.researchQuestions = []
        self.criteriosInclusao = []
        self.criteriosExclusao = []


@pytest.mark.asyncio
async def test_project_chat_blocks_foreign_project(fake_user):
    req = ProjectChatRequest(messages=[{"role": "user", "content": "q"}], projectId=99)
    db = FakeDB(Project(project_id=99, owner_id=999))

    with pytest.raises(HTTPException) as exc:
        await ai_router.project_chat(data=req, current_user=fake_user, db=db)

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_rag_scope_denied_when_owner_mismatch(monkeypatch):
    rag = RAGService()

    class Embedding:
        def generate_embedding(self, text):
            return []

    rag.embedding = Embedding()

    class DB:
        async def get(self, model, project_id):
            return Project(project_id=project_id, owner_id=2)

    with pytest.raises(PermissionError):
        await rag.retrieve(query="q", project_id=1, db=DB(), owner_id=1)
