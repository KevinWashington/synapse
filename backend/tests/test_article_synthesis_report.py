import importlib
import sys
from types import SimpleNamespace

import pytest


def _load_articles_router_module(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")

    import app.config as config_module

    importlib.reload(config_module)
    for module_name in ("app.models.user", "app.models.project", "app.models.article"):
        existing = sys.modules.get(module_name)
        if existing is not None and getattr(existing, "__file__", None) is None:
            sys.modules.pop(module_name, None)
        if module_name not in sys.modules:
            importlib.import_module(module_name)
    module = importlib.import_module("app.routers.articles")
    return importlib.reload(module)


class FakeUser:
    id = 1


class FakeProject:
    id = 9
    title = "Projeto de Sintese"
    researchQuestions = ["RQ1", "RQ2"]
    dataExtractionSchema = [
        {"key": "country", "label": "Country", "type": "single_select", "options": ["BR", "US"]},
        {"key": "techniques", "label": "Techniques", "type": "multi_select", "options": ["survey", "case study"]},
        {"key": "peer_reviewed", "label": "Peer Reviewed", "type": "boolean", "options": []},
        {"key": "sample_size", "label": "Sample Size", "type": "number", "options": []},
    ]
    qualityAssessmentSchema = [
        {"key": "bias", "label": "Risk of bias"},
        {"key": "analysis", "label": "Analysis quality"},
    ]


class FakeArticle:
    def __init__(
        self,
        *,
        article_id,
        title,
        review_outcome,
        year,
        source_name,
        answering_rqs=None,
        extraction_data=None,
        quality_answers=None,
    ):
        self.id = article_id
        self.paperId = f"paper-{article_id}"
        self.title = title
        self.authors = "Author"
        self.year = year
        self.status = "analisado"
        self.reviewOutcome = review_outcome
        self.manualDecision = "incluido" if review_outcome == "included" else "excluido"
        self.answeringRQs = answering_rqs or []
        self.manualDecisionReason = None
        self.eligibilityReasonText = None
        self.aiEvaluation = None
        self.notas = None
        self.sourceName = source_name
        self.extractionData = extraction_data or {}
        self.qualityAssessmentAnswers = quality_answers or {}
        self.qualityScore = None
        self.qualityRating = None


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


class FakeMutationDB:
    async def commit(self):
        return None

    async def refresh(self, _article):
        return None


@pytest.mark.asyncio
async def test_synthesis_report_groups_only_included_articles(monkeypatch):
    articles_router = _load_articles_router_module(monkeypatch)

    articles = [
        FakeArticle(
            article_id=1,
            title="Included A",
            review_outcome="included",
            year=2023,
            source_name="Scopus",
            answering_rqs=[1],
            extraction_data={
                "country": "BR",
                "techniques": ["survey", "case study"],
                "peer_reviewed": True,
                "sample_size": 20,
            },
            quality_answers={"bias": "yes", "analysis": "partial"},
        ),
        FakeArticle(
            article_id=2,
            title="Included B",
            review_outcome="included",
            year=2024,
            source_name="PubMed",
            answering_rqs=[],
            extraction_data={
                "country": "US",
                "peer_reviewed": False,
                "sample_size": 12,
            },
            quality_answers={},
        ),
        FakeArticle(
            article_id=3,
            title="Excluded C",
            review_outcome="excluded_eligibility",
            year=2024,
            source_name="IEEE Xplore",
            answering_rqs=[2],
            extraction_data={"country": "BR"},
            quality_answers={"bias": "no"},
        ),
    ]

    async def fake_get_project_or_404(project_id, owner_id, db):
        assert project_id == 9
        assert owner_id == 1
        return FakeProject()

    monkeypatch.setattr(articles_router, "get_project_or_404", fake_get_project_or_404)

    response = await articles_router.get_project_synthesis_report(
        projectId=9,
        current_user=FakeUser(),
        db=FakeDB(articles),
    )

    assert [row["articleId"] for row in response["extractionRows"]] == [1, 2]
    assert [column["key"] for column in response["extractionColumns"]] == [
        "country",
        "techniques",
        "peer_reviewed",
        "sample_size",
    ]
    assert response["coverage"] == {
        "answeredRQCount": 1,
        "answeredRQPercentage": 50.0,
        "includedArticles": 2,
        "includedWithoutRQLinks": 1,
    }
    assert response["qualitySummary"]["ratedArticles"] == 1
    assert response["qualitySummary"]["unratedArticles"] == 1
    assert response["qualitySummary"]["averageScore"] == 75.0

    chart_keys = [chart["key"] for chart in response["distributionCharts"]]
    assert chart_keys == ["year", "qualityRating", "country", "techniques", "peer_reviewed"]

    quality_rows = {row["value"]: row["count"] for row in response["qualitySummary"]["byRating"]}
    assert quality_rows["high"] == 1
    assert quality_rows["unrated"] == 1


@pytest.mark.asyncio
async def test_update_article_evidence_preserves_hidden_keys(monkeypatch):
    articles_router = _load_articles_router_module(monkeypatch)
    article = FakeArticle(
        article_id=11,
        title="Included Evidence",
        review_outcome="included",
        year=2024,
        source_name="Scopus",
        extraction_data={"legacy_hidden": "keep", "country": "BR"},
        quality_answers={"legacy_hidden": "yes", "bias": "no"},
    )

    async def fake_get_project_or_404(project_id, owner_id, db):
        return FakeProject()

    async def fake_get_article_or_404(article_id, project_id, owner_id, db):
        assert article_id == 11
        return article

    monkeypatch.setattr(articles_router, "get_project_or_404", fake_get_project_or_404)
    monkeypatch.setattr(articles_router, "get_article_or_404", fake_get_article_or_404)
    monkeypatch.setattr(
        articles_router,
        "_build_article_response",
        lambda current_article: SimpleNamespace(
            extractionData=current_article.extractionData,
            qualityAssessmentAnswers=current_article.qualityAssessmentAnswers,
        ),
    )

    response = await articles_router.update_article_evidence(
        projectId=9,
        articleId=11,
        data=articles_router.ArticleEvidenceUpdate(
            extractionData={"country": "US"},
            qualityAssessmentAnswers={"bias": "partial"},
        ),
        current_user=FakeUser(),
        db=FakeMutationDB(),
    )

    assert article.extractionData == {"legacy_hidden": "keep", "country": "US"}
    assert article.qualityAssessmentAnswers == {"legacy_hidden": "yes", "bias": "partial"}
    assert article.qualityScore == 50.0
    assert article.qualityRating == "medium"
    assert response.extractionData == {"legacy_hidden": "keep", "country": "US"}
    assert response.qualityAssessmentAnswers == {"legacy_hidden": "yes", "bias": "partial"}


def test_visualization_suggestions_build_ready_rows_by_field_type(monkeypatch):
    articles_router = _load_articles_router_module(monkeypatch)
    research_questions = ["RQ number", "RQ boolean", "RQ single", "RQ multi", "RQ text"]
    extraction_schema = [
        {"key": "rq_1", "label": "Metric", "type": "number", "options": []},
        {"key": "rq_2", "label": "Adopted", "type": "boolean", "options": []},
        {"key": "rq_3", "label": "Context", "type": "single_select", "options": ["academic", "clinical"]},
        {"key": "rq_4", "label": "Methods", "type": "multi_select", "options": ["ML", "NLP"]},
        {"key": "rq_5", "label": "Evidence", "type": "text", "options": []},
    ]
    articles = [
        FakeArticle(
            article_id=1,
            title="Included A",
            review_outcome="included",
            year=2023,
            source_name="Scopus",
            answering_rqs=[1, 2, 3, 4, 5],
            extraction_data={
                "rq_1": 10,
                "rq_2": True,
                "rq_3": "academic",
                "rq_4": ["ML", "NLP"],
                "rq_5": "Reduced screening time.",
            },
        ),
        FakeArticle(
            article_id=2,
            title="Included B",
            review_outcome="included",
            year=2024,
            source_name="PubMed",
            answering_rqs=[1, 2, 3, 4, 5],
            extraction_data={
                "rq_1": "7",
                "rq_2": False,
                "rq_3": "clinical",
                "rq_4": ["NLP"],
                "rq_5": "Improved prioritization.",
            },
        ),
    ]

    suggestions = articles_router._build_visualization_suggestions(
        research_questions,
        extraction_schema,
        articles,
    )

    assert [item["visualizationType"] for item in suggestions] == [
        "bar_chart",
        "category_bar_chart",
        "category_bar_chart",
        "multi_category_bar_chart",
        "qualitative_table",
    ]
    assert all(item["status"] == "ready" for item in suggestions)
    assert suggestions[0]["rows"] == [
        {"articleId": 1, "title": "Included A", "year": 2023, "value": 10},
        {"articleId": 2, "title": "Included B", "year": 2024, "value": 7},
    ]
    assert {row["value"]: row["count"] for row in suggestions[1]["rows"]} == {"false": 1, "true": 1}
    assert {row["value"]: row["count"] for row in suggestions[2]["rows"]} == {"academic": 1, "clinical": 1}
    assert {row["value"]: row["count"] for row in suggestions[3]["rows"]} == {"ML": 1, "NLP": 2}
    assert suggestions[4]["rows"][0]["value"] == "Reduced screening time."


def test_visualization_suggestions_report_missing_field_and_needs_data(monkeypatch):
    articles_router = _load_articles_router_module(monkeypatch)
    articles = [
        FakeArticle(
            article_id=1,
            title="Included A",
            review_outcome="included",
            year=2023,
            source_name="Scopus",
            answering_rqs=[1],
            extraction_data={},
        ),
    ]

    suggestions = articles_router._build_visualization_suggestions(
        ["RQ with empty field", "RQ without field"],
        [{"key": "rq_1", "label": "Empty metric", "type": "number", "options": []}],
        articles,
    )

    assert suggestions[0]["status"] == "needs_data"
    assert suggestions[0]["visualizationType"] == "bar_chart"
    assert suggestions[0]["rows"] == []
    assert suggestions[1]["status"] == "missing_field"
    assert suggestions[1]["visualizationType"] == "not_available"
    assert suggestions[1]["field"] is None


def test_visualization_suggestions_fallback_to_schema_order_and_all_articles(monkeypatch):
    articles_router = _load_articles_router_module(monkeypatch)
    articles = [
        FakeArticle(
            article_id=1,
            title="Included A",
            review_outcome="included",
            year=2023,
            source_name="Scopus",
            answering_rqs=[],
            extraction_data={"manual_metric": 5},
        ),
        FakeArticle(
            article_id=2,
            title="Included B",
            review_outcome="included",
            year=2024,
            source_name="Scopus",
            answering_rqs=[],
            extraction_data={"manual_metric": 8},
        ),
    ]

    suggestions = articles_router._build_visualization_suggestions(
        ["RQ without rq_ key"],
        [{"key": "manual_metric", "label": "Manual metric", "type": "number", "options": []}],
        articles,
    )

    assert suggestions[0]["field"]["key"] == "manual_metric"
    assert [row["articleId"] for row in suggestions[0]["rows"]] == [1, 2]
