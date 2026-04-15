import importlib
import sys

import pytest


def _load_articles_router_module(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")
    sys.modules.pop("app.models.article", None)
    sys.modules.pop("app.routers.articles", None)

    import app.config as config_module

    importlib.reload(config_module)
    importlib.import_module("app.models.article")
    module = importlib.import_module("app.routers.articles")
    return module


class FakeUser:
    id = 1


class FakeProject:
    title = "Projeto RQ"
    researchQuestions = ["RQ1", "RQ2", "RQ3"]


class FakeArticle:
    def __init__(
        self,
        *,
        article_id,
        title,
        status,
        manual_decision=None,
        answering_rqs=None,
        reason=None,
        ai_eval=None,
        year=2024,
    ):
        self.id = article_id
        self.paperId = f"paper-{article_id}"
        self.title = title
        self.authors = "Author"
        self.year = year
        self.status = status
        self.manualDecision = manual_decision
        self.answeringRQs = answering_rqs or []
        self.manualDecisionReason = reason
        self.aiEvaluation = ai_eval
        self.notas = None


class FakeScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return FakeScalarResult(self._rows)


class FakeDB:
    def __init__(self, rows):
        self._rows = rows

    async def execute(self, _query):
        return FakeExecuteResult(self._rows)


@pytest.mark.asyncio
async def test_rq_synthesis_groups_only_included_articles(monkeypatch):
    articles_router = _load_articles_router_module(monkeypatch)

    articles = [
        FakeArticle(
            article_id=1,
            title="Included by manual decision",
            status="pendente",
            manual_decision="incluido",
            answering_rqs=[1, 2],
            reason="Atende criterios",
        ),
        FakeArticle(
            article_id=2,
            title="Included by analyzed status",
            status="analisado",
            manual_decision=None,
            answering_rqs=[2],
            ai_eval="Boa aderencia",
        ),
        FakeArticle(
            article_id=3,
            title="Excluded by manual decision",
            status="analisado",
            manual_decision="excluido",
            answering_rqs=[1, 3],
        ),
        FakeArticle(
            article_id=4,
            title="Included but unlinked",
            status="analisado",
            manual_decision=None,
            answering_rqs=[],
        ),
    ]

    async def fake_get_project_or_404(project_id, owner_id, db):
        assert project_id == 9
        assert owner_id == 1
        return FakeProject()

    monkeypatch.setattr(articles_router, "get_project_or_404", fake_get_project_or_404)

    response = await articles_router.get_project_rq_synthesis(
        projectId=9,
        current_user=FakeUser(),
        db=FakeDB(articles),
    )

    assert response["projectId"] == 9
    assert response["rqCount"] == 3

    rq1 = response["rqSynthesis"][0]
    rq2 = response["rqSynthesis"][1]
    rq3 = response["rqSynthesis"][2]

    assert rq1["evidenceCount"] == 1
    assert rq2["evidenceCount"] == 2
    assert rq3["evidenceCount"] == 0

    assert response["coverage"] == {
        "answeredRQCount": 2,
        "answeredRQPercentage": 66.67,
        "includedArticles": 3,
        "includedWithoutRQLinks": 1,
    }

    assert len(response["unlinkedIncludedArticles"]) == 1
    assert response["unlinkedIncludedArticles"][0]["id"] == 4

    matrix_ids = [row["articleId"] for row in response["matrix"]]
    assert matrix_ids == [1, 2, 4]
