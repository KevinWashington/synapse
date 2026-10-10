import pytest
from sqlalchemy import select
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from app.models.article import Article
from app.models.project import Project
from app.models.synthesis import RQSynthesis
from app.models.user import User
from app.routers import projects
from app.schemas.project import ProjectUpdate
from app.services.synthesis_identity_service import (
    normalize_question,
    question_fingerprint,
    reconcile_research_questions,
)
from synthesis_test_support import synthesis_database, synthesis_session  # noqa: F401


def test_question_fingerprint_normalizes_unicode_case_and_spacing():
    assert normalize_question("  CAFÉ\t ONLINE  ") == normalize_question(" cafe\u0301 online ")
    assert question_fingerprint("CAFÉ ONLINE") == question_fingerprint("cafe\u0301\tonline")


async def _make_project(session, questions):
    owner = User(name="Owner", email="owner@example.com")
    session.add(owner)
    await session.flush()
    project = Project(title="Review", objetivo="Objective", ownerId=owner.id, researchQuestions=questions)
    session.add(project)
    await session.flush()
    return project, owner


async def _add_draft(session, project, number, question, narrative):
    session.add(
        RQSynthesis(
            projectId=project.id,
            rqNumber=number,
            questionSnapshot=question,
            questionFingerprint=question_fingerprint(question),
            content={"narrative": narrative},
            sourceArticleIds=[],
        )
    )
    await session.flush()


@pytest.mark.asyncio
async def test_unique_question_follows_reorder(synthesis_session):
    project, owner = await _make_project(synthesis_session, ["Alpha", "Beta"])
    await _add_draft(synthesis_session, project, 1, "Alpha", "Finding A")
    await _add_draft(synthesis_session, project, 2, "Beta", "Finding B")
    article = Article(
        projectId=project.id,
        ownerId=owner.id,
        title="Study",
        authors="Author",
        year=2025,
        journal="Journal",
        answeringRQs=[1],
        aiSuggestedRQs=[1],
    )
    synthesis_session.add(article)
    await synthesis_session.flush()

    await reconcile_research_questions(
        synthesis_session,
        project=project,
        previous=["Alpha", "Beta"],
        current=["Beta", "Alpha"],
    )

    drafts = (await synthesis_session.execute(select(RQSynthesis).where(RQSynthesis.projectId == project.id))).scalars().all()
    assert {draft.questionSnapshot: draft.rqNumber for draft in drafts} == {"Alpha": 2, "Beta": 1}
    assert article.answeringRQs == [2]
    assert article.aiSuggestedRQs == [1]


@pytest.mark.asyncio
async def test_edited_question_keeps_same_position_as_stale_candidate(synthesis_session):
    project, _ = await _make_project(synthesis_session, ["Original question"])
    await _add_draft(synthesis_session, project, 1, "Original question", "Keep this draft")

    await reconcile_research_questions(
        synthesis_session,
        project=project,
        previous=["Original question"],
        current=["Revised question"],
    )

    draft = await synthesis_session.scalar(select(RQSynthesis).where(RQSynthesis.projectId == project.id))
    assert draft.rqNumber == 1
    assert draft.questionSnapshot == "Original question"
    assert draft.content["narrative"] == "Keep this draft"
    assert question_fingerprint(draft.questionSnapshot) != question_fingerprint("Revised question")


@pytest.mark.asyncio
async def test_duplicate_questions_match_by_occurrence(synthesis_session):
    project, _ = await _make_project(synthesis_session, ["Repeat", "Repeat"])
    await _add_draft(synthesis_session, project, 1, "Repeat", "First occurrence")
    await _add_draft(synthesis_session, project, 2, "Repeat", "Second occurrence")

    await reconcile_research_questions(
        synthesis_session,
        project=project,
        previous=["Repeat", "Repeat"],
        current=["New question", "Repeat", "Repeat"],
    )

    drafts = (await synthesis_session.execute(select(RQSynthesis).where(RQSynthesis.projectId == project.id))).scalars().all()
    assert {(draft.content["narrative"], draft.rqNumber) for draft in drafts} == {
        ("First occurrence", 2),
        ("Second occurrence", 3),
    }


@pytest.mark.asyncio
async def test_removed_question_is_archived_with_content(synthesis_session):
    project, _ = await _make_project(synthesis_session, ["Keep", "Remove"])
    await _add_draft(synthesis_session, project, 1, "Keep", "Current")
    await _add_draft(synthesis_session, project, 2, "Remove", "Archived")

    await reconcile_research_questions(
        synthesis_session,
        project=project,
        previous=["Keep", "Remove"],
        current=["Keep"],
    )

    drafts = (await synthesis_session.execute(select(RQSynthesis).where(RQSynthesis.projectId == project.id))).scalars().all()
    assert {(draft.questionSnapshot, draft.rqNumber, draft.content["narrative"]) for draft in drafts} == {
        ("Keep", 1, "Current"),
        ("Remove", None, "Archived"),
    }


@pytest.mark.asyncio
async def test_reorder_remaps_final_links_without_changing_ai_suggestions(synthesis_session):
    project, owner = await _make_project(synthesis_session, ["Alpha", "Beta"])
    article = Article(
        projectId=project.id,
        ownerId=owner.id,
        title="Study",
        authors="Author",
        year=2025,
        journal="Journal",
        answeringRQs=[1],
        aiSuggestedRQs=[1],
    )
    synthesis_session.add(article)
    await synthesis_session.flush()

    await reconcile_research_questions(
        synthesis_session,
        project=project,
        previous=["Alpha", "Beta"],
        current=["Beta", "Alpha"],
    )

    assert article.answeringRQs == [2]
    assert article.aiSuggestedRQs == [1]


@pytest.mark.asyncio
async def test_project_update_reconciles_before_changing_research_questions(monkeypatch):
    project = SimpleNamespace(id=7, researchQuestions=["Original"])
    access = SimpleNamespace(project=project)
    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db = SimpleNamespace(
        commit=AsyncMock(),
        refresh=AsyncMock(),
        execute=AsyncMock(return_value=result),
    )
    reconcile = AsyncMock()
    monkeypatch.setattr(projects, "resolve_project_access", AsyncMock(return_value=access))
    monkeypatch.setattr(projects, "require_capability", Mock())
    monkeypatch.setattr(projects, "reconcile_research_questions", reconcile, raising=False)
    monkeypatch.setattr(projects, "_build_project_response", Mock(return_value="updated"))

    result = await projects.update_project(
        7,
        ProjectUpdate(researchQuestions=["Revised"]),
        current_user=SimpleNamespace(id=3),
        db=db,
    )

    assert result == "updated"
    reconcile.assert_awaited_once_with(
        db,
        project=project,
        previous=["Original"],
        current=["Revised"],
    )
