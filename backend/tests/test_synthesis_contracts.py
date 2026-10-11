from datetime import datetime, timezone

import pytest


@pytest.mark.parametrize(
    ("schema_name", "payload"),
    [
        (
            "SynthesisOverviewResponse",
            {
                "includedCount": 0,
                "extractedCount": 0,
                "coveredRQCount": 0,
                "qualityAssessedCount": 0,
                "researchQuestionCount": 0,
            },
        ),
        ("RQListResponse", {"items": [], "page": 1, "pageSize": 20, "total": 0}),
        (
            "RQDetailResponse",
            {
                "rqNumber": 1,
                "question": "RQ",
                "questionFingerprint": "a" * 64,
                "draft": None,
                "context": {
                    "evidenceCount": 0,
                    "includedCount": 0,
                    "coverage": 0,
                    "quality": {"counts": {}, "total": 0},
                    "freshness": "current",
                },
                "activeGeneration": {
                    "id": 3,
                    "rqNumber": 1,
                    "status": "cancelled",
                    "completedBatches": 0,
                    "totalBatches": 2,
                    "errorCode": "CANCELLED",
                },
            },
        ),
        ("EvidenceListResponse", {"items": [], "page": 3, "pageSize": 20, "total": 0}),
        (
            "MatrixResponse",
            {
                "items": [
                    {
                        "articleId": 9,
                        "title": "Study",
                        "rqNumbers": [],
                        "extractionValues": {"empty": ""},
                    }
                ],
                "page": 1,
                "pageSize": 20,
                "total": 1,
            },
        ),
        (
            "ChartCatalogResponse",
            {"key": "rq:1", "label": "RQ", "type": "rq", "group": "RQ 1", "rqNumber": 1},
        ),
        (
            "ChartResponse",
            {
                "key": "year",
                "field": {"key": "year", "label": "Year", "type": "number"},
                "sampleSize": 0,
                "missingCount": 0,
                "rows": [],
            },
        ),
        (
            "QualityCriteriaResponse",
            {
                "key": "overall",
                "label": "Overall",
                "kind": "overall",
                "total": 0,
                "distribution": {"high": 0},
            },
        ),
        ("QualityStudyListResponse", {"items": [], "page": 2, "pageSize": 10, "total": 0}),
        (
            "QualityStudyResponse",
            {"articleId": 4, "title": "Study", "extractionValues": {}, "qualityAnswers": {}},
        ),
        (
            "SynthesisDraftResponse",
            {
                "content": {
                    "narrative": "",
                    "keyFindings": [],
                    "divergences": [],
                    "limitations": [],
                },
                "version": 1,
                "questionFingerprint": "a" * 64,
                "evidenceFingerprint": "b" * 64,
                "updatedAt": datetime.now(timezone.utc),
                "updatedByUserId": 7,
            },
        ),
    ],
)
def test_synthesis_response_fixtures_validate(schema_name, payload):
    from app.schemas import synthesis

    response_model = getattr(synthesis, schema_name)
    assert response_model.model_validate(payload)


def test_every_json_synthesis_route_declares_a_concrete_response_model():
    from app.routers.synthesis import router
    from app.schemas.synthesis import (
        ChartCatalogResponse,
        ChartResponse,
        EvidenceListResponse,
        GenerationStatus,
        MatrixResponse,
        QualityCriteriaResponse,
        QualityStudyListResponse,
        QualityStudyResponse,
        RQDetailResponse,
        RQListResponse,
        SynthesisDraftResponse,
        SynthesisOverviewResponse,
    )

    json_routes = [
        route
        for route in router.routes
        if getattr(route, "status_code", None) != 204 and "export" not in route.path
    ]
    assert json_routes
    assert all(route.response_model is not None for route in json_routes)
    expected = {
        "overview": SynthesisOverviewResponse,
        "rqs": RQListResponse,
        "rq_detail": RQDetailResponse,
        "evidence": EvidenceListResponse,
        "matrix": MatrixResponse,
        "matrix_article": QualityStudyResponse,
        "charts": list[ChartCatalogResponse],
        "chart": ChartResponse,
        "quality_criteria": list[QualityCriteriaResponse],
        "quality_studies": QualityStudyListResponse,
        "quality_study": QualityStudyResponse,
        "generate": GenerationStatus,
        "generation": GenerationStatus,
        "cancel": GenerationStatus,
        "save_draft": SynthesisDraftResponse,
    }
    for route in json_routes:
        if route.name in expected:
            assert route.response_model == expected[route.name]


def test_response_models_preserve_dynamic_extraction_columns():
    from app.schemas.synthesis import MatrixResponse

    response = MatrixResponse.model_validate(
        {
            "items": [{"articleId": 1, "extractionValues": {}, "customExtractionField": False}],
            "page": 1,
            "pageSize": 20,
            "total": 1,
        }
    )

    assert response.items[0]["customExtractionField"] is False


def test_generation_status_accepts_failed_and_cancelled_jobs():
    from app.schemas.synthesis import GenerationStatus

    failed = GenerationStatus.model_validate(
        {
            "id": 1,
            "rqNumber": 2,
            "status": "failed",
            "completedBatches": 1,
            "totalBatches": 3,
            "errorCode": "GENERATION_FAILED",
        }
    )
    cancelled = GenerationStatus.model_validate(
        {
            "id": 2,
            "rqNumber": 2,
            "status": "cancelled",
            "completedBatches": 0,
            "totalBatches": 3,
            "errorCode": "CANCELLED",
        }
    )

    assert failed.status == "failed"
    assert cancelled.status == "cancelled"


@pytest.mark.asyncio
async def test_text_chart_response_preserves_actual_paginated_query_result():
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from app.schemas.synthesis import ChartResponse
    from app.services.synthesis_query_service import get_chart

    project = SimpleNamespace(id=7, dataExtractionSchema=[{"key": "result", "type": "text"}])
    db = SimpleNamespace(
        scalar=AsyncMock(side_effect=[2, 1]),
        execute=AsyncMock(
            return_value=[SimpleNamespace(id=8, title="Study", year=2025, value="Observed result")]
        ),
    )
    payload = await get_chart(db, project, "result", {}, page=1, page_size=20)
    response = ChartResponse.model_validate(payload)
    assert response.model_dump()["rows"] == {
        "items": [{"articleId": 8, "title": "Study", "year": 2025, "value": "Observed result"}],
        "page": 1,
        "pageSize": 20,
        "total": 1,
    }


def test_selected_matrix_columns_preserve_dynamic_values_colliding_with_metadata():
    from app.schemas.synthesis import MatrixResponse

    response = MatrixResponse.model_validate(
        {"items": [{"title": False, "year": "unknown"}], "page": 1, "pageSize": 20, "total": 1}
    )
    assert response.model_dump()["items"] == [{"title": False, "year": "unknown"}]
