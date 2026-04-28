import importlib
import sys
from datetime import datetime

import pytest

from app.schemas.project import ProjectCreate


def _load_projects_router_module(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")

    import app.config as config_module

    importlib.reload(config_module)
    for module_name in ("app.models.user", "app.models.project", "app.models.article"):
        existing = sys.modules.get(module_name)
        if existing is not None and getattr(existing, "__file__", None) is None:
            sys.modules.pop(module_name, None)
        if module_name not in sys.modules:
            importlib.import_module(module_name)
    module = importlib.import_module("app.routers.projects")
    return importlib.reload(module)


class FakeUser:
    id = 1


class FakeDB:
    def __init__(self):
        self.added = None

    def add(self, instance):
        self.added = instance

    async def commit(self):
        return None

    async def refresh(self, instance):
        instance.id = 10
        instance.createdAt = datetime.utcnow()
        instance.updatedAt = datetime.utcnow()


@pytest.mark.asyncio
async def test_create_project_persists_evidence_schema_defaults(monkeypatch):
    projects_router = _load_projects_router_module(monkeypatch)
    db = FakeDB()

    response = await projects_router.create_project(
        data=ProjectCreate(title="Projeto", objetivo="Objetivo"),
        current_user=FakeUser(),
        db=db,
    )

    assert db.added.dataExtractionSchema == []
    assert db.added.qualityAssessmentSchema == []
    assert response.model_dump()["dataExtractionSchema"] == []
    assert response.model_dump()["qualityAssessmentSchema"] == []


@pytest.mark.asyncio
async def test_create_project_sanitizes_evidence_schema(monkeypatch):
    projects_router = _load_projects_router_module(monkeypatch)
    db = FakeDB()

    response = await projects_router.create_project(
        data=ProjectCreate(
            title="Projeto",
            objetivo="Objetivo",
            dataExtractionSchema=[
                {
                    "key": "country",
                    "label": "Country",
                    "type": "single_select",
                    "options": ["BR", "BR", "US"],
                }
            ],
            qualityAssessmentSchema=[
                {
                    "key": "risk_of_bias",
                    "label": "Risk of Bias",
                }
            ],
        ),
        current_user=FakeUser(),
        db=db,
    )

    assert response.model_dump()["dataExtractionSchema"] == [
        {
            "key": "country",
            "label": "Country",
            "type": "single_select",
            "options": ["BR", "US"],
        }
    ]
    assert response.model_dump()["qualityAssessmentSchema"] == [
        {
            "key": "risk_of_bias",
            "label": "Risk of Bias",
        }
    ]
