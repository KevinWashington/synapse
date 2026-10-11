"""Article query and authorization contracts against a disposable PostgreSQL database."""

import asyncio
from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from app.database import Base
from app.models.article import Article
from app.models.collaboration import (
    ProjectMember,
    ReviewAssignment,
    ReviewConflict,
    ReviewDecision,
)
from app.models.project import Project
from app.models.user import User
from app.routers import articles, projects
from app.schemas.article import (
    ArticleCreate,
    ArticleEvidenceUpdate,
    ArticleNotesUpdate,
    ArticleUpdate,
    BatchEvaluateRequest,
    DedupApplyRequest,
    EligibilityDecisionRequest,
    FullTextStatusUpdate,
    ImportBibTeXRequest,
    LegacyArticleDecisionUpdate,
    LegacyArticleStatusUpdate,
    PromoteToScreeningRequest,
    RelationshipCreate,
    ScreeningDecisionRequest,
)
from app.services.project_access_service import resolve_project_access
from app.services.review_decision_service import reopen_review
from fastapi import HTTPException, UploadFile
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from starlette.datastructures import Headers

from db_test_support import (
    create_test_database,
    database_url_for_test,
    drop_test_database,
    new_test_database,
)

DATABASE = new_test_database("article_collaboration")
URL = database_url_for_test(DATABASE)


@pytest.fixture(scope="module")
def database():
    async def reset(create):
        if create:
            await create_test_database(DATABASE)
            engine = create_async_engine(URL)
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            await engine.dispose()
        else:
            await drop_test_database(DATABASE)

    asyncio.run(reset(True))
    yield
    asyncio.run(reset(False))


@pytest_asyncio.fixture
async def scene(monkeypatch, database):
    engine = create_async_engine(URL)
    async with engine.connect() as connection:
        transaction = await connection.begin()
        async with AsyncSession(
            bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
        ) as db:
            users = [User(name=f"User {i}", email=f"user{i}@example.com") for i in range(4)]
            db.add_all(users)
            await db.flush()
            owner, reviewer, peer, coordinator = users
            project = Project(
                title="Review",
                objetivo="Test",
                ownerId=owner.id,
                dataExtractionSchema=[{"key": "method", "label": "Method", "type": "text"}],
            )
            db.add(project)
            await db.flush()
            for user, role in [
                (reviewer, "reviewer"),
                (peer, "reviewer"),
                (coordinator, "coordinator"),
            ]:
                db.add(
                    ProjectMember(
                        projectId=project.id,
                        userId=user.id,
                        role=role,
                        status="active",
                        participatesInReview=True,
                    )
                )
            article = Article(
                projectId=project.id,
                ownerId=owner.id,
                title="Study",
                authors="Author",
                year=2025,
                journal="Journal",
                currentPhase="screening",
                pdfData=b"%PDF",
                fullTextStatus="uploaded",
            )
            db.add(article)
            await db.flush()
            yield SimpleNamespace(
                db=db,
                engine=engine,
                project=project,
                article=article,
                owner=owner,
                reviewer=reviewer,
                peer=peer,
                coordinator=coordinator,
            )
        await transaction.rollback()
    await engine.dispose()


async def assign(
    scene, user, *, article=None, phase="screening", slot=1, status="pending", value=None
):
    article = article or scene.article
    assignment = ReviewAssignment(
        projectId=scene.project.id,
        articleId=article.id,
        reviewerUserId=user.id,
        assignedByUserId=scene.owner.id,
        phase=phase,
        slot=slot,
        status=status,
    )
    scene.db.add(assignment)
    await scene.db.flush()
    if value:
        scene.db.add(
            ReviewDecision(
                assignmentId=assignment.id,
                projectId=scene.project.id,
                articleId=article.id,
                reviewerUserId=user.id,
                phase=phase,
                status="submitted",
                decision=value,
                reasonText=f"private {user.id}",
                checklistAnswers={"private": True},
                answeringRQs=[1],
            )
        )
        await scene.db.flush()
    return assignment


@pytest.mark.asyncio
async def test_project_listing_supports_json_fields_after_collaboration_join(scene):
    scene.project.picoc = {"population": "Adults"}
    await scene.db.flush()

    response = await projects.get_all_projects(
        current_user=scene.owner,
        db=scene.db,
    )

    assert response.total == 1
    assert [project.id for project in response.projects] == [scene.project.id]


@pytest.mark.asyncio
async def test_assigned_filter_counts_before_pagination_and_scopes_phase(scene):
    for index in range(24):
        article = Article(
            projectId=scene.project.id,
            ownerId=scene.owner.id,
            title=f"Study {index}",
            authors="Author",
            year=2025,
            journal="Journal",
            currentPhase="screening",
        )
        scene.db.add(article)
        await scene.db.flush()
        await assign(scene, scene.reviewer, article=article)
    await assign(scene, scene.reviewer, article=scene.article, status="cancelled")
    await assign(scene, scene.peer, article=scene.article, slot=2)
    response = await articles.get_articles_by_project(
        scene.project.id,
        phase="screening",
        assignedToMe=True,
        page=2,
        limit=20,
        current_user=scene.reviewer,
        db=scene.db,
    )
    assert response.total == 24
    assert len(response.articles) == 4
    assert all(
        row.myReviewAssignment.reviewerUserId == scene.reviewer.id for row in response.articles
    )
    empty = await articles.get_articles_by_project(
        scene.project.id,
        phase="eligibility",
        assignedToMe=True,
        current_user=scene.reviewer,
        db=scene.db,
    )
    assert empty.total == 0


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "own_status,peer_status,values,conflict_status,want",
    [
        ("pending", "pending", (None, None), None, "waiting_for_reviewer"),
        ("pending", "submitted", (None, "excluded"), None, "waiting_for_reviewer"),
        ("submitted", "pending", ("included", None), None, "waiting_for_reviewer"),
        ("needs_reassignment", "pending", (None, None), None, "waiting_for_reviewer"),
        ("submitted", "submitted", ("included", "included"), None, "consolidated"),
        ("submitted", "submitted", ("included", "excluded"), "open", "conflict"),
        ("submitted", "submitted", ("included", "excluded"), "resolved", "consolidated"),
    ],
)
async def test_reload_metadata_and_blind_payloads(
    scene, own_status, peer_status, values, conflict_status, want
):
    await assign(scene, scene.reviewer, status=own_status, value=values[0])
    await assign(scene, scene.peer, slot=2, status=peer_status, value=values[1])
    if conflict_status:
        scene.db.add(
            ReviewConflict(
                projectId=scene.project.id,
                articleId=scene.article.id,
                phase="screening",
                status=conflict_status,
                decisionIds=[],
                resolvedDecision="included" if conflict_status == "resolved" else None,
            )
        )
        await scene.db.flush()
    response = await articles.get_article_by_id(
        scene.project.id, scene.article.id, scene.reviewer, scene.db
    )
    assert response.hasActiveReviewAssignments is True
    assert response.myReviewAssignment.status == own_status
    assert response.reviewState == want
    if peer_status == "submitted":
        peer = next(
            row for row in response.reviewDecisions if row["reviewerUserId"] == scene.peer.id
        )
        if own_status != "submitted":
            assert peer == {"reviewerUserId": scene.peer.id, "status": "submitted"}
        else:
            assert peer["reasonText"] == f"private {scene.peer.id}"
    if values[0]:
        own = next(
            row for row in response.reviewDecisions if row["reviewerUserId"] == scene.reviewer.id
        )
        assert own["decision"] == values[0]
    listing = await articles.get_articles_by_project(
        scene.project.id, current_user=scene.reviewer, db=scene.db
    )
    assert listing.articles[0].model_dump() == response.model_dump()


@pytest.mark.asyncio
async def test_metadata_queries_are_batched_for_a_page(scene):
    await assign(scene, scene.peer)
    for index in range(6):
        article = Article(
            projectId=scene.project.id,
            ownerId=scene.owner.id,
            title=f"Study {index}",
            authors="Author",
            year=2025,
            journal="Journal",
            currentPhase="screening",
        )
        scene.db.add(article)
        await scene.db.flush()
        await assign(scene, scene.peer, article=article)
    statements = []

    def capture(_conn, _cursor, statement, _params, _context, _many):
        statements.append(statement)

    event.listen(scene.engine.sync_engine, "before_cursor_execute", capture)
    try:
        result = await articles.get_articles_by_project(
            scene.project.id, current_user=scene.reviewer, db=scene.db
        )
    finally:
        event.remove(scene.engine.sync_engine, "before_cursor_execute", capture)
    assert len(result.articles) == 7
    assert all(
        row.myReviewAssignment is None and row.hasActiveReviewAssignments for row in result.articles
    )
    assert len(statements) <= 8


@pytest.mark.asyncio
async def test_no_assignment_preserves_solo_flow(scene):
    response = await articles.get_article_by_id(
        scene.project.id, scene.article.id, scene.owner, scene.db
    )
    assert response.hasActiveReviewAssignments is False
    assert response.myReviewAssignment is None
    assert response.reviewState is None
    result = await articles.screening_decision(
        scene.project.id,
        scene.article.id,
        ScreeningDecisionRequest(decision="included"),
        scene.owner,
        scene.db,
    )
    assert result.currentPhase == "eligibility"
    assert result.reviewState is None


@pytest.mark.asyncio
async def test_existing_assignments_remain_authoritative(scene):
    await assign(scene, scene.reviewer)
    await assign(scene, scene.peer, slot=2)
    response = await articles.get_article_by_id(
        scene.project.id, scene.article.id, scene.reviewer, scene.db
    )
    assert response.hasActiveReviewAssignments is True
    assert response.myReviewAssignment.reviewerUserId == scene.reviewer.id

    with pytest.raises(HTTPException) as denied:
        await articles.screening_decision(
            scene.project.id,
            scene.article.id,
            ScreeningDecisionRequest(decision="included"),
            scene.owner,
            scene.db,
        )
    assert denied.value.status_code == 403


@pytest.mark.asyncio
async def test_reviewer_without_assignment_cannot_use_legacy_write_path(scene):
    with pytest.raises(HTTPException) as denied_decision:
        await articles.screening_decision(
            scene.project.id,
            scene.article.id,
            ScreeningDecisionRequest(decision="included"),
            scene.reviewer,
            scene.db,
        )
    assert denied_decision.value.status_code == 403

    with pytest.raises(HTTPException) as denied_notes:
        await articles.update_article_notes(
            scene.project.id,
            scene.article.id,
            ArticleNotesUpdate(notas="forbidden"),
            scene.reviewer,
            scene.db,
        )
    assert denied_notes.value.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "operation",
    [
        "screening",
        "eligibility",
        "notes",
        "evidence",
        "pdf",
        "full_text",
        "edit",
        "delete",
        "status",
        "evaluate",
        "relationship",
        "remove_relationship",
        "legacy_reset",
    ],
)
async def test_unassigned_reviewer_can_read_but_cannot_write(scene, operation):
    phase = "screening" if operation in {"screening", "legacy_reset"} else "eligibility"
    scene.article.currentPhase = phase
    if operation == "evidence":
        scene.article.currentPhase = "included"
        scene.article.reviewOutcome = "included"
    await assign(scene, scene.peer, phase=phase)
    await scene.db.flush()
    readable = await articles.get_article_by_id(
        scene.project.id, scene.article.id, scene.reviewer, scene.db
    )
    assert readable.id == scene.article.id
    assert readable.myReviewAssignment is None
    args = (scene.project.id, scene.article.id)
    kwargs = {"current_user": scene.reviewer, "db": scene.db}
    operations = {
        "screening": lambda: articles.screening_decision(
            *args, ScreeningDecisionRequest(decision="included"), **kwargs
        ),
        "eligibility": lambda: articles.eligibility_decision(
            *args, EligibilityDecisionRequest(decision="included"), **kwargs
        ),
        "notes": lambda: articles.update_article_notes(
            *args, ArticleNotesUpdate(notas="forbidden"), **kwargs
        ),
        "evidence": lambda: articles.update_article_evidence(
            *args, ArticleEvidenceUpdate(extractionData={"method": "forbidden"}), **kwargs
        ),
        "pdf": lambda: articles.upload_pdf(
            *args,
            UploadFile(
                BytesIO(b"%PDF"),
                filename="study.pdf",
                headers=Headers({"content-type": "application/pdf"}),
            ),
            **kwargs,
        ),
        "full_text": lambda: articles.update_full_text_status(
            *args, FullTextStatusUpdate(fullTextStatus="pending_upload"), **kwargs
        ),
        "edit": lambda: articles.update_article(
            *args, ArticleUpdate(title="forbidden"), ai_service=None, **kwargs
        ),
        "delete": lambda: articles.delete_article(*args, **kwargs),
        "status": lambda: articles.update_article_status(
            *args, LegacyArticleStatusUpdate(status="excluido"), **kwargs
        ),
        "evaluate": lambda: articles.evaluate_single_article(
            *args, ai_service=AsyncMock(), **kwargs
        ),
        "relationship": lambda: articles.add_relationship(
            *args, RelationshipCreate(relatedArticleId=scene.article.id), **kwargs
        ),
        "remove_relationship": lambda: articles.remove_relationship(
            *args, scene.article.id, **kwargs
        ),
        "legacy_reset": lambda: articles.update_article_decision(
            *args, LegacyArticleDecisionUpdate(decision="pendente"), **kwargs
        ),
    }
    with pytest.raises(HTTPException) as denied:
        await operations[operation]()
    assert denied.value.status_code == 403
    assert scene.article.notas is None
    assert scene.article.title == "Study"


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["reviewer", "owner", "coordinator"])
async def test_assigned_notes_and_extraction_with_administrative_access(scene, role):
    scene.article.currentPhase = "included"
    scene.article.reviewOutcome = "included"
    await assign(scene, scene.reviewer, phase="eligibility")
    user = getattr(scene, role)
    notes = await articles.update_article_notes(
        scene.project.id, scene.article.id, ArticleNotesUpdate(notas="allowed"), user, scene.db
    )
    assert notes.notas == "allowed"
    assert notes.hasActiveReviewAssignments is True
    assert notes.canWriteReview is True
    assert notes.canManageArticle is (role != "reviewer")
    evidence = await articles.update_article_evidence(
        scene.project.id,
        scene.article.id,
        ArticleEvidenceUpdate(extractionData={"method": "allowed"}),
        user,
        scene.db,
    )
    assert evidence.extractionData == {"method": "allowed"}
    assert evidence.hasActiveReviewAssignments is True


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["owner", "coordinator"])
async def test_administrators_still_need_own_decision_assignment(scene, role):
    await assign(scene, scene.reviewer)
    with pytest.raises(HTTPException) as denied:
        await articles.screening_decision(
            scene.project.id,
            scene.article.id,
            ScreeningDecisionRequest(decision="included"),
            getattr(scene, role),
            scene.db,
        )
    assert denied.value.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "operation",
    [
        "edit",
        "delete",
        "status",
        "evaluate",
        "relationship",
        "remove_relationship",
        "batch_evaluate",
        "reprocess",
    ],
)
async def test_assigned_reviewers_cannot_administer_articles(scene, operation):
    await assign(scene, scene.reviewer)
    args = (scene.project.id, scene.article.id)
    kwargs = {"current_user": scene.reviewer, "db": scene.db}
    operations = {
        "edit": lambda: articles.update_article(
            *args, ArticleUpdate(title="forbidden"), ai_service=None, **kwargs
        ),
        "delete": lambda: articles.delete_article(*args, **kwargs),
        "status": lambda: articles.update_article_status(
            *args, LegacyArticleStatusUpdate(status="excluido"), **kwargs
        ),
        "evaluate": lambda: articles.evaluate_single_article(
            *args, ai_service=AsyncMock(), **kwargs
        ),
        "relationship": lambda: articles.add_relationship(
            *args, RelationshipCreate(relatedArticleId=scene.article.id), **kwargs
        ),
        "remove_relationship": lambda: articles.remove_relationship(
            *args, scene.article.id, **kwargs
        ),
        "batch_evaluate": lambda: articles.batch_evaluate_screening(
            scene.project.id, BatchEvaluateRequest(), ai_service=AsyncMock(), **kwargs
        ),
        "reprocess": lambda: articles.reprocess_project_graph(
            scene.project.id, ai_service=AsyncMock(), **kwargs
        ),
    }
    with pytest.raises(HTTPException) as denied:
        await operations[operation]()
    assert denied.value.status_code == 403


@pytest.mark.asyncio
async def test_unassigned_reviewers_remain_read_only_on_solo_article_in_mixed_page(scene):
    await assign(scene, scene.peer)
    solo = Article(
        projectId=scene.project.id,
        ownerId=scene.owner.id,
        title="Solo",
        authors="Author",
        year=2025,
        journal="Journal",
        currentPhase="screening",
    )
    scene.db.add(solo)
    await scene.db.flush()
    result = await articles.get_articles_by_project(
        scene.project.id, current_user=scene.reviewer, db=scene.db
    )
    response = next(row for row in result.articles if row.id == solo.id)
    assert response.hasActiveReviewAssignments is False
    assert response.canWriteReview is False


@pytest.mark.asyncio
async def test_submission_returns_caller_assignment_and_rejects_resubmission(scene):
    await assign(scene, scene.reviewer)
    await assign(scene, scene.peer, slot=2)
    result = await articles.screening_decision(
        scene.project.id,
        scene.article.id,
        ScreeningDecisionRequest(decision="included"),
        scene.reviewer,
        scene.db,
    )
    assert result.hasActiveReviewAssignments is True
    assert result.myReviewAssignment.status == "submitted"
    assert result.reviewState == "waiting_for_reviewer"
    with pytest.raises(HTTPException) as locked:
        await articles.screening_decision(
            scene.project.id,
            scene.article.id,
            ScreeningDecisionRequest(decision="excluded", reasonText="change"),
            scene.reviewer,
            scene.db,
        )
    assert locked.value.status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["reviewer", "owner", "coordinator"])
async def test_pdf_mutations_retain_caller_permissions(scene, role):
    scene.article.currentPhase = "eligibility"
    await assign(scene, scene.reviewer, phase="eligibility")
    user = getattr(scene, role)
    pdf = UploadFile(
        BytesIO(b"%PDF new"),
        filename="new.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )
    result = await articles.upload_pdf(scene.project.id, scene.article.id, pdf, user, scene.db)
    assert result.hasActiveReviewAssignments is True
    assert result.canWriteReview is True


@pytest.mark.asyncio
@pytest.mark.parametrize("assigned", [False, True])
@pytest.mark.parametrize(
    "operation", ["create", "import", "analyze", "apply", "promote", "promote_unique"]
)
async def test_reviewers_cannot_mutate_the_corpus_even_when_assigned(scene, assigned, operation):
    scene.article.currentPhase = "identification"
    if assigned:
        await assign(scene, scene.reviewer)
    kwargs = {"current_user": scene.reviewer, "db": scene.db}
    operations = {
        "create": lambda: articles.create_article(
            scene.project.id,
            ArticleCreate(
                title="Forbidden",
                authors="A",
                year=2025,
                journal="J",
                sourceCategory="database",
                sourceName="Test",
            ),
            ai_service=None,
            **kwargs,
        ),
        "import": lambda: articles.import_bibtex_entries(
            scene.project.id,
            ImportBibTeXRequest(sourceCategory="database", sourceName="Test"),
            ai_service=None,
            **kwargs,
        ),
        "analyze": lambda: articles.analyze_duplicates(scene.project.id, **kwargs),
        "apply": lambda: articles.apply_duplicate_decisions(
            scene.project.id, DedupApplyRequest(), **kwargs
        ),
        "promote": lambda: articles.promote_articles_to_screening(
            scene.project.id, PromoteToScreeningRequest(articleIds=[scene.article.id]), **kwargs
        ),
        "promote_unique": lambda: articles.promote_unique_articles_to_screening(
            scene.project.id, **kwargs
        ),
    }
    with pytest.raises(HTTPException) as denied:
        await operations[operation]()
    assert denied.value.status_code == 403
    assert scene.article.currentPhase == "identification"


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["owner", "coordinator"])
@pytest.mark.parametrize("bulk", [False, True])
async def test_corpus_administrators_can_promote(scene, role, bulk):
    scene.article.currentPhase = "identification"
    if bulk:
        result = await articles.promote_unique_articles_to_screening(
            scene.project.id, getattr(scene, role), scene.db
        )
    else:
        result = await articles.promote_articles_to_screening(
            scene.project.id,
            PromoteToScreeningRequest(articleIds=[scene.article.id]),
            getattr(scene, role),
            scene.db,
        )
    assert result.movedCount == 1
    assert scene.article.currentPhase == "screening"


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["reviewer", "owner", "coordinator"])
@pytest.mark.parametrize("state", ["pending", "submitted", "consolidated"])
@pytest.mark.parametrize("requested", ["uploaded", "pending_upload", "unavailable"])
async def test_managed_full_text_status_cannot_change_or_reset_canonical_decisions(
    scene, role, state, requested
):
    scene.article.currentPhase = "eligibility"
    if state == "consolidated":
        scene.article.reviewOutcome = "included"
        scene.article.eligibilityDecision = "included"
        scene.article.currentPhase = "included"
    await assign(
        scene,
        scene.reviewer,
        phase="eligibility",
        status="pending" if state == "pending" else "submitted",
        value=None if state == "pending" else "included",
    )
    await assign(
        scene,
        scene.peer,
        phase="eligibility",
        slot=2,
        status="submitted" if state == "consolidated" else "pending",
        value="included" if state == "consolidated" else None,
    )
    before = (
        scene.article.fullTextStatus,
        scene.article.reviewOutcome,
        scene.article.eligibilityDecision,
        scene.article.currentPhase,
    )
    with pytest.raises(HTTPException) as denied:
        await articles.update_full_text_status(
            scene.project.id,
            scene.article.id,
            FullTextStatusUpdate(fullTextStatus=requested, reasonText="Unavailable"),
            getattr(scene, role),
            scene.db,
        )
    assert denied.value.status_code == 409
    assert denied.value.detail["code"] == "MANAGED_REVIEW"
    assert "eligibility-decision" in denied.value.detail["message"]
    assert (
        scene.article.fullTextStatus,
        scene.article.reviewOutcome,
        scene.article.eligibilityDecision,
        scene.article.currentPhase,
    ) == before


@pytest.mark.asyncio
async def test_solo_full_text_status_is_blocked_with_existing_assignments(scene):
    scene.article.currentPhase = "eligibility"
    await assign(scene, scene.peer, phase="eligibility")
    with pytest.raises(HTTPException) as denied:
        await articles.update_full_text_status(
            scene.project.id,
            scene.article.id,
            FullTextStatusUpdate(fullTextStatus="pending_upload"),
            scene.owner,
            scene.db,
        )

    assert denied.value.status_code == 409
    assert denied.value.detail["code"] == "MANAGED_REVIEW"


@pytest.mark.asyncio
async def test_previous_phase_assignment_does_not_grant_eligibility_writes_or_queue_membership(
    scene,
):
    scene.article.currentPhase = "eligibility"
    await assign(scene, scene.reviewer, phase="screening", status="submitted", value="included")
    await assign(scene, scene.peer, phase="eligibility")
    result = await articles.get_articles_by_project(
        scene.project.id, assignedToMe=True, current_user=scene.reviewer, db=scene.db
    )
    assert result.total == 0
    with pytest.raises(HTTPException) as denied:
        await articles.update_article_notes(
            scene.project.id,
            scene.article.id,
            ArticleNotesUpdate(notas="forbidden"),
            scene.reviewer,
            scene.db,
        )
    assert denied.value.status_code == 403


@pytest.mark.asyncio
async def test_submission_requires_current_review_capability(scene):
    assignment = await assign(scene, scene.coordinator)
    member = await scene.db.scalar(
        select(ProjectMember).where(
            ProjectMember.projectId == scene.project.id,
            ProjectMember.userId == scene.coordinator.id,
        )
    )
    member.participatesInReview = False
    await scene.db.flush()

    with pytest.raises(HTTPException) as denied:
        await articles.screening_decision(
            scene.project.id,
            scene.article.id,
            ScreeningDecisionRequest(decision="included"),
            scene.coordinator,
            scene.db,
        )

    assert assignment.status == "pending"
    assert denied.value.status_code == 403
    assert denied.value.detail["code"] == "PROJECT_PERMISSION_DENIED"


@pytest.mark.asyncio
@pytest.mark.parametrize("phase", ["screening", "eligibility"])
async def test_reopen_clears_canonical_and_downstream_article_state(scene, phase):
    scene.article.currentPhase = "included"
    scene.article.reviewOutcome = "included"
    scene.article.screeningDecision = "included"
    scene.article.screeningReasonText = "screening reason"
    scene.article.screeningReviewedAt = datetime.now(timezone.utc)
    scene.article.eligibilityDecision = "included"
    scene.article.eligibilityReasonText = "eligibility reason"
    scene.article.eligibilityReviewedAt = scene.article.screeningReviewedAt
    scene.article.eligibilityChecklistAnswers = {"criterion": True}
    scene.article.answeringRQs = [1]
    scene.article.includedAt = scene.article.screeningReviewedAt
    scene.article.extractionData = {"method": "stale"}
    scene.article.extractionCompletedAt = scene.article.screeningReviewedAt
    scene.article.qualityAssessmentAnswers = {"quality": True}
    scene.article.qualityScore = 1.0
    scene.article.qualityRating = "high"
    scene.article.manualDecision = "incluido"
    scene.article.manualDecisionReason = "stale"
    scene.article.decisionUpdatedAt = scene.article.screeningReviewedAt
    scene.article.exclusionCriteria = ["stale"]
    await assign(scene, scene.reviewer, phase=phase, status="submitted", value="included")
    if phase == "screening":
        await assign(
            scene, scene.reviewer, phase="eligibility", status="submitted", value="included"
        )
    await scene.db.flush()
    access = await resolve_project_access(
        scene.db, project_id=scene.project.id, user_id=scene.owner.id
    )

    await reopen_review(
        scene.db,
        access=access,
        article_id=scene.article.id,
        phase=phase,
        reason="Correção necessária",
        actor_user_id=scene.owner.id,
    )

    assert scene.article.currentPhase == phase
    assert scene.article.reviewOutcome == "active"
    if phase == "screening":
        assert scene.article.screeningDecision == "pending"
        assert scene.article.screeningReasonText is None
        assert scene.article.screeningReviewedAt is None
    else:
        assert scene.article.screeningDecision == "included"
    assert scene.article.eligibilityDecision == "pending"
    assert scene.article.eligibilityReasonText is None
    assert scene.article.eligibilityReviewedAt is None
    assert scene.article.eligibilityChecklistAnswers == {}
    assert scene.article.answeringRQs == []
    assert scene.article.includedAt is None
    assert scene.article.extractionData == {}
    assert scene.article.extractionCompletedAt is None
    assert scene.article.qualityAssessmentAnswers == {}
    assert scene.article.qualityScore is None
    assert scene.article.qualityRating == "unrated"
    if phase == "screening":
        assert scene.article.manualDecision is None
        assert scene.article.manualDecisionReason is None
    else:
        assert scene.article.manualDecision == "incluido"
        assert scene.article.manualDecisionReason == "screening reason"
    assert scene.article.exclusionCriteria == []
