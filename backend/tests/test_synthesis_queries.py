import pytest

from app.models.article import Article
from app.models.project import Project
from app.models.user import User
from app.services.synthesis_query_service import get_overview, get_chart, get_quality_criteria, list_evidence, list_matrix, list_quality_studies
from synthesis_test_support import synthesis_database, synthesis_session  # noqa: F401


async def _project(session):
    owner = User(name="Owner", email="queries@example.com")
    session.add(owner)
    await session.flush()
    project = Project(
        title="Review",
        objetivo="Objective",
        ownerId=owner.id,
        researchQuestions=["RQ one", "RQ two"],
        dataExtractionSchema=[
            {"key": "design", "label": "Design", "type": "text", "options": []},
        ],
        qualityAssessmentSchema=[{"key": "validity", "label": "Validity"}],
    )
    session.add(project)
    await session.flush()
    return project, owner


@pytest.mark.asyncio
async def test_overall_quality_lists_included_studies_and_aggregates_the_filtered_scope(synthesis_session):
    project, owner = await _project(synthesis_session)
    for title, year, answers in [("High", 2025, {"validity": "yes"}), ("Low", 2024, {"validity": "no"}), ("Unrated", 2025, {})]:
        synthesis_session.add(Article(
            projectId=project.id, ownerId=owner.id, title=title, year=year,
            authors="Author", journal="Journal", reviewOutcome="included",
            qualityAssessmentAnswers=answers,
        ))
    await synthesis_session.flush()

    overall = await list_quality_studies(synthesis_session, project, "overall", {}, page=1, page_size=20)
    assert overall["total"] == 3
    assert len(overall["items"]) == 3
    criterion = await list_quality_studies(synthesis_session, project, "validity", {}, page=1, page_size=20)
    assert criterion["total"] == 2

    filtered = await list_quality_studies(synthesis_session, project, "overall", {"yearFrom": 2025}, page=1, page_size=20)
    criteria = await get_quality_criteria(synthesis_session, project, {"yearFrom": 2025})
    assert filtered["total"] == criteria[0]["total"] == 2
    assert criteria[0]["distribution"]["low"] == 0
    assert sum(criteria[0]["distribution"].values()) == 2


@pytest.mark.asyncio
async def test_large_corpus_has_bounded_matrix_pages_without_pdf_data(synthesis_session):
    project, owner = await _project(synthesis_session)
    synthesis_session.add_all(
        [
            Article(
                projectId=project.id,
                ownerId=owner.id,
                title=f"Study {index:04}",
                authors="Author",
                year=2020 + index % 5,
                journal="Journal",
                reviewOutcome="included",
                answeringRQs=[1],
                extractionData={"design": f"method {index % 3}"},
                pdfData=b"large pdf must never be selected",
            )
            for index in range(1003)
        ]
    )
    await synthesis_session.flush()

    page = await list_matrix(
        synthesis_session,
        project,
        {},
        page=3,
        page_size=20,
        columns=["title", "year"],
    )

    assert (page["page"], page["pageSize"], page["total"]) == (3, 20, 1003)
    assert len(page["items"]) == 20
    assert page["items"][0]["title"] == "Study 0040"
    assert "pdfData" not in page["items"][0]


@pytest.mark.asyncio
async def test_evidence_filters_apply_before_pagination_and_scope_to_rq(synthesis_session):
    project, owner = await _project(synthesis_session)
    synthesis_session.add_all(
        [
            Article(
                projectId=project.id,
                ownerId=owner.id,
                title=f"Linked study {index}",
                authors="Author",
                year=2025,
                journal="Journal",
                reviewOutcome="included",
                answeringRQs=[1] if index < 7 else [2],
                eligibilityReasonText="Selection reason, not a verbatim quote",
                extractionData={"design": "qualitative"},
                qualityAssessmentAnswers={"validity": "yes"},
            )
            for index in range(10)
        ]
    )
    await synthesis_session.flush()

    page = await list_evidence(
        synthesis_session,
        project,
        1,
        {"search": "linked", "yearFrom": 2024},
        page=2,
        page_size=3,
        order="quality",
    )

    assert (page["page"], page["pageSize"], page["total"]) == (2, 3, 7)
    assert len(page["items"]) == 3
    assert {item["excerptKind"] for item in page["items"]} == {"selection_reason"}
    assert all(item["rqNumbers"] == [1] for item in page["items"])


@pytest.mark.asyncio
async def test_overview_aggregates_full_included_corpus(synthesis_session):
    project, owner = await _project(synthesis_session)
    synthesis_session.add_all(
        [
            Article(
                projectId=project.id,
                ownerId=owner.id,
                title=f"Study {index}",
                authors="Author",
                year=2025,
                journal="Journal",
                reviewOutcome="included" if index < 8 else "excluded_screening",
                answeringRQs=[1] if index < 5 else [],
                extractionCompletedAt=None if index % 2 else None,
                qualityAssessmentAnswers={"validity": "yes"} if index < 4 else {},
                qualityRating="unrated",
            )
            for index in range(10)
        ]
    )
    await synthesis_session.flush()

    overview = await get_overview(synthesis_session, project)

    assert overview["includedCount"] == 8
    assert overview["extractedCount"] == 0
    assert overview["coveredRQCount"] == 1
    assert overview["qualityAssessedCount"] == 4


@pytest.mark.asyncio
async def test_visualization_limits_categories_after_aggregating_the_full_distribution(synthesis_session):
    project, owner = await _project(synthesis_session)
    project.dataExtractionSchema = [{"key": "category", "label": "Category", "type": "single_select"}]
    synthesis_session.add_all(
        [
            Article(
                projectId=project.id,
                ownerId=owner.id,
                title=f"Study {index:02}",
                authors="Author",
                year=2025,
                journal="Journal",
                reviewOutcome="included",
                extractionData={"category": f"Category {index:02}"},
            )
            for index in range(15)
        ]
    )
    await synthesis_session.flush()

    chart = await get_chart(synthesis_session, project, "category", {}, page=1, page_size=20)

    assert len(chart["rows"]) == 13
    assert chart["rows"][-1] == {"value": "Outros", "count": 3}


@pytest.mark.asyncio
async def test_quality_filters_and_distributions_recalculate_from_answers(synthesis_session):
    project, owner = await _project(synthesis_session)
    stale_high = Article(
        projectId=project.id,
        ownerId=owner.id,
        title="Actually low quality",
        authors="Author",
        year=2025,
        journal="Journal",
        reviewOutcome="included",
        qualityAssessmentAnswers={"validity": "no"},
        qualityRating="high",
        qualityScore=100,
        answeringRQs=[1],
    )
    synthesis_session.add(stale_high)
    await synthesis_session.flush()

    criteria = await get_quality_criteria(synthesis_session, project)
    low_page = await list_evidence(
        synthesis_session,
        project,
        1,
        {"qualityRating": "low"},
        page=1,
        page_size=20,
    )

    assert criteria[0]["distribution"]["low"] == 1
    assert low_page["total"] == 1
