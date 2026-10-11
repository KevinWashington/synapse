from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from app.core.dependencies import (
    get_current_user,
    get_optional_user_ai_service,
    get_user_ai_service,
)
from app.database import get_db
from app.models.article import Article
from app.models.collaboration import ReviewAssignment, ReviewConflict, ReviewDecision
from app.models.project import Project
from app.models.user import User
from app.schemas.article import (
    ArticleCreate,
    ArticleEvidenceUpdate,
    ArticleListResponse,
    ArticleNotesUpdate,
    ArticleResponse,
    ArticleReviewAssignment,
    ArticleUpdate,
    BatchEvaluateRequest,
    BatchEvaluateResponse,
    BatchEvaluateSummary,
    DedupAnalyzeResponse,
    DedupApplyRequest,
    DedupApplyResponse,
    DuplicateCandidate,
    DuplicateCandidateArticle,
    EligibilityDecisionRequest,
    FullTextStatusUpdate,
    ImportBibTeXRequest,
    ImportBibTeXResponse,
    LegacyArticleDecisionUpdate,
    LegacyArticleStatusUpdate,
    PromoteToScreeningRequest,
    PromoteToScreeningResponse,
    PromoteUniqueToScreeningResponse,
    RelationshipCreate,
    ScreeningDecisionRequest,
    SelectionReportResponse,
    SelectionSummaryResponse,
)
from app.services import article_mutation_service
from app.services.ai_service import AIService
from app.services.article_dedup_service import (
    analyze_duplicates as analyze_article_duplicates,
)
from app.services.article_dedup_service import (
    assign_duplicate_markers,
    promote_unique_identification_articles,
)
from app.services.article_file_service import ArticleFileService
from app.services.article_import_service import (
    apply_ai_evaluation,
    build_project_ai_context,
    evaluate_article_if_possible,
    import_bibtex_articles,
)
from app.services.article_index_jobs_service import enqueue_article_index
from app.services.article_report_service import (
    build_report_csv,
    build_selection_report,
    build_synthesis_report,
    is_included_for_synthesis,
    selection_summary_from_articles,
)
from app.services.article_response_service import build_article_response
from app.services.evidence_service import (
    apply_quality_metrics,
    merge_extraction_data,
    merge_quality_assessment_answers,
)
from app.services.project_access_service import (
    CAP_EDIT_PROJECT,
    CAP_REVIEW_ASSIGNED,
    get_project_article,
    require_capability,
    resolve_project_access,
)
from app.services.review_decision_service import (
    has_active_assignments,
    require_assigned_write_if_managed,
    resolution_state,
    submit_review_decision,
    visible_decision_payloads,
)
from app.services.review_workflow_service import (
    ReviewDecisionData,
    apply_legacy_review_state,
    apply_review_decision,
)

router = APIRouter()
logger = logging.getLogger(__name__)

SOURCE_NAME_OPTIONS = [
    "Scopus",
    "Web of Science",
    "IEEE Xplore",
    "ACM Digital Library",
    "PubMed",
    "ScienceDirect",
    "SpringerLink",
    "Google Scholar",
    "BDTD",
    "CAPES",
    "outra",
]

CURRENT_PHASES = ("identification", "screening", "eligibility", "included")
ACTIVE_OUTCOME = "active"
EXCLUDED_OUTCOMES = (
    "duplicate_removed",
    "excluded_screening",
    "full_text_unavailable",
    "excluded_eligibility",
)

_INVALID_ANCHOR_CHARS = re.compile(r"[^a-z0-9]+")


async def get_project_or_404(projectId: int, ownerId: int, db: AsyncSession) -> Project:
    return (await resolve_project_access(db, project_id=projectId, user_id=ownerId)).project


async def get_article_or_404(
    articleId: int, projectId: int, ownerId: int, db: AsyncSession
) -> Article:
    await resolve_project_access(db, project_id=projectId, user_id=ownerId)
    return await get_project_article(db, project_id=projectId, article_id=articleId)


def _review_phase(article: Article) -> str:
    return "screening" if article.currentPhase in {"identification", "screening"} else "eligibility"


async def _require_article_write(db, article, user_id, *, administrative=False):
    access = await resolve_project_access(db, project_id=article.projectId, user_id=user_id)
    if administrative or access.role != "reviewer":
        require_capability(access, CAP_EDIT_PROJECT)
    else:
        await require_assigned_write_if_managed(
            db, article_id=article.id, user_id=user_id, phase=_review_phase(article), access=access
        )
    return access


async def _article_responses(db, rows, *, access, user_id, phase=None):
    responses = [build_article_response(row) for row in rows]
    for response in responses:
        response.canManageArticle = CAP_EDIT_PROJECT in access.capabilities
        response.canWriteReview = response.canManageArticle if access.role != "reviewer" else False
        response.canDecideReview = access.role == "owner"
    if not rows:
        return responses
    ids = [row.id for row in rows]
    assignments = (
        (
            await db.execute(
                select(ReviewAssignment)
                .where(ReviewAssignment.articleId.in_(ids), ReviewAssignment.status != "cancelled")
                .order_by(ReviewAssignment.slot)
            )
        )
        .scalars()
        .all()
    )
    if not assignments:
        return responses
    decisions = (
        (
            await db.execute(
                select(ReviewDecision).where(
                    ReviewDecision.assignmentId.in_([item.id for item in assignments]),
                    ReviewDecision.status == "submitted",
                )
            )
        )
        .scalars()
        .all()
    )
    conflicts = (
        (await db.execute(select(ReviewConflict).where(ReviewConflict.articleId.in_(ids))))
        .scalars()
        .all()
    )
    for row, response in zip(rows, responses):
        relevant_phase = phase if phase in {"screening", "eligibility"} else _review_phase(row)
        active = [
            item
            for item in assignments
            if item.articleId == row.id and item.phase == relevant_phase
        ]
        own = next((item for item in active if item.reviewerUserId == user_id), None)
        response.hasActiveReviewAssignments = bool(active)
        response.myReviewAssignment = ArticleReviewAssignment.model_validate(own) if own else None
        response.reviewAssignments = [
            ArticleReviewAssignment.model_validate(item) for item in active
        ]
        response.canWriteReview = response.canManageArticle or bool(
            own and own.status not in {"needs_reassignment", "cancelled"}
        )
        response.canDecideReview = bool(
            own and own.status == "pending" and CAP_REVIEW_ASSIGNED in access.capabilities
        )
        if not active:
            continue
        active_ids = {item.id for item in active}
        submitted = [item for item in decisions if item.assignmentId in active_ids]
        complete = len(submitted) == len(active) and all(
            item.status == "submitted" for item in active
        )
        phase_conflicts = [
            item for item in conflicts if item.articleId == row.id and item.phase == relevant_phase
        ]
        if not complete:
            response.reviewState = "waiting_for_reviewer"
        elif any(item.status == "open" for item in phase_conflicts):
            response.reviewState = "conflict"
        elif any(item.status == "resolved" for item in phase_conflicts):
            response.reviewState = "consolidated"
        else:
            response.reviewState = resolution_state(submitted, assignment_count=len(active))
        response.reviewDecisions = visible_decision_payloads(
            submitted, current_user_id=user_id, complete=complete
        )
    return responses


async def _caller_article_response(db, article, user_id, *, phase=None):
    access = await resolve_project_access(db, project_id=article.projectId, user_id=user_id)
    return (await _article_responses(db, [article], access=access, user_id=user_id, phase=phase))[0]


def _legacy_status_query_filter(status_value: str | None):
    if status_value == "pendente":
        return Article.reviewOutcome == "active"
    if status_value == "analisado":
        return or_(Article.currentPhase == "eligibility", Article.reviewOutcome == "included")
    if status_value == "excluido":
        return Article.reviewOutcome.in_(EXCLUDED_OUTCOMES)
    return None


@router.get("/source-options")
async def get_source_options():
    return {
        "options": SOURCE_NAME_OPTIONS,
        "categories": [
            {"value": "database", "label": "Base de dados"},
            {"value": "grey_literature", "label": "Literatura cinzenta"},
            {"value": "manual_other", "label": "Origem manual"},
        ],
    }


@router.get("/{projectId}/artigos", response_model=ArticleListResponse)
async def get_articles_by_project(
    projectId: int,
    search: str | None = None,
    status: str | None = None,
    phase: str | None = None,
    outcome: str | None = None,
    sourceCategory: str | None = None,
    hasPdf: bool | None = None,
    assignedToMe: bool = False,
    page: int = 1,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)

    query = select(Article).where(Article.projectId == projectId)

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                Article.title.ilike(search_filter),
                Article.authors.ilike(search_filter),
                Article.sourceName.ilike(search_filter),
            )
        )

    if phase:
        query = query.where(Article.currentPhase == phase)

    if assignedToMe:
        relevant_phase = (
            phase
            if phase in {"screening", "eligibility"}
            else case(
                (Article.currentPhase.in_(["identification", "screening"]), "screening"),
                else_="eligibility",
            )
        )
        query = query.where(
            select(ReviewAssignment.id)
            .where(
                ReviewAssignment.articleId == Article.id,
                ReviewAssignment.projectId == projectId,
                ReviewAssignment.reviewerUserId == current_user.id,
                ReviewAssignment.phase == relevant_phase,
                ReviewAssignment.status != "cancelled",
            )
            .exists()
        )

    if outcome:
        query = query.where(Article.reviewOutcome == outcome)

    if sourceCategory:
        query = query.where(Article.sourceCategory == sourceCategory)

    if hasPdf is True:
        query = query.where(Article.pdfData.is_not(None))
    elif hasPdf is False:
        query = query.where(Article.pdfData.is_(None))

    legacy_status_filter = _legacy_status_query_filter(status)
    if legacy_status_filter is not None:
        query = query.where(legacy_status_filter)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    offset = (page - 1) * limit
    result = await db.execute(query.order_by(Article.createdAt.desc()).offset(offset).limit(limit))
    articles = result.scalars().all()

    return ArticleListResponse(
        articles=await _article_responses(
            db, articles, access=access, user_id=current_user.id, phase=phase
        ),
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{projectId}/artigos/selection-summary", response_model=SelectionSummaryResponse)
async def get_project_selection_summary(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_project_or_404(projectId, current_user.id, db)
    result = await db.execute(select(Article).where(Article.projectId == projectId))
    articles = result.scalars().all()
    return selection_summary_from_articles(projectId, articles)


@router.get("/{projectId}/artigos/filter-summary")
async def get_project_filter_summary(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    summary = await get_project_selection_summary(
        projectId=projectId, current_user=current_user, db=db
    )
    return summary.model_dump()


@router.get("/{projectId}/selection-report", response_model=SelectionReportResponse)
async def get_project_selection_report(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    result = await db.execute(select(Article).where(Article.projectId == projectId))
    articles = result.scalars().all()
    return build_selection_report(project, articles)


@router.get("/{projectId}/selection-report/export")
async def export_project_selection_report(
    projectId: int,
    format: str = "json",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await get_project_selection_report(
        projectId=projectId, current_user=current_user, db=db
    )
    if format == "csv":
        csv_content = build_report_csv(report)
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="selection-report-{projectId}.csv"'
            },
        )

    return JSONResponse(content=report.model_dump())


@router.post(
    "/{projectId}/artigos", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED
)
async def create_article(
    projectId: int,
    data: ArticleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService | None = Depends(get_optional_user_ai_service),
):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    article = await article_mutation_service.create_article(
        db, access=access, request=data, actor_user_id=current_user.id, ai_service=ai_service
    )
    await db.commit()
    await db.refresh(article)
    return build_article_response(article)


@router.post("/{projectId}/artigos/import-bibtex", response_model=ImportBibTeXResponse)
async def import_bibtex_entries(
    projectId: int,
    data: ImportBibTeXRequest,
    evaluate_ai: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService | None = Depends(get_optional_user_ai_service),
):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    response = await import_bibtex_articles(
        db,
        access=access,
        request=data,
        actor_user_id=current_user.id,
        ai_service=ai_service,
        evaluate_ai=evaluate_ai,
    )
    await db.commit()
    return response


@router.post("/{projectId}/artigos/dedup/analyze", response_model=DedupAnalyzeResponse)
async def analyze_duplicates(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_EDIT_PROJECT)
    result = await db.execute(select(Article).where(Article.projectId == projectId))
    articles = result.scalars().all()
    candidates = analyze_article_duplicates(articles)
    assign_duplicate_markers(articles, candidates)
    await db.commit()

    return DedupAnalyzeResponse(
        projectId=projectId,
        candidateCount=len(candidates),
        candidates=candidates,
    )


@router.get("/{projectId}/artigos/dedup/candidates", response_model=list[DuplicateCandidate])
async def get_duplicate_candidates(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_project_or_404(projectId, current_user.id, db)
    result = await db.execute(
        select(Article).where(
            Article.projectId == projectId,
            Article.reviewOutcome == "active",
            Article.duplicateGroupKey.is_not(None),
        )
    )
    articles = result.scalars().all()
    groups: dict[str, list[Article]] = {}
    for article in articles:
        groups.setdefault(article.duplicateGroupKey or "unknown", []).append(article)

    candidates = []
    for group_key, matches in sorted(groups.items()):
        first = matches[0]
        candidates.append(
            DuplicateCandidate(
                groupKey=group_key,
                reasonCode=first.duplicateReasonCode or "other",
                reasonText=first.duplicateReasonText or "Candidatos à duplicidade.",
                candidateIds=[article.id for article in matches],
                articles=[
                    DuplicateCandidateArticle(
                        id=article.id,
                        title=article.title,
                        authors=article.authors,
                        year=article.year,
                        journal=article.journal,
                        doi=article.doi,
                        sourceName=article.sourceName,
                        sourceCategory=article.sourceCategory,
                        reviewOutcome=article.reviewOutcome,
                    )
                    for article in matches
                ],
            )
        )

    return candidates


@router.post("/{projectId}/artigos/dedup/apply", response_model=DedupApplyResponse)
async def apply_duplicate_decisions(
    projectId: int,
    data: DedupApplyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_EDIT_PROJECT)
    applied_groups = 0
    removed_duplicates = 0

    for decision in data.decisions:
        canonical = await get_article_or_404(
            decision.canonicalArticleId, projectId, current_user.id, db
        )
        if canonical.duplicateGroupKey != decision.groupKey:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "Grupo inválido",
                    "message": "Artigo canônico fora do grupo selecionado.",
                },
            )

        canonical.duplicateGroupKey = None
        canonical.duplicateReasonCode = None
        canonical.duplicateReasonText = None

        for duplicate_id in decision.duplicateArticleIds:
            duplicate = await get_article_or_404(duplicate_id, projectId, current_user.id, db)
            duplicate.reviewOutcome = "duplicate_removed"
            duplicate.currentPhase = "identification"
            duplicate.duplicateOfArticleId = canonical.id
            duplicate.duplicateReasonCode = decision.reasonCode
            duplicate.duplicateReasonText = decision.reasonText or canonical.title
            duplicate.screeningDecision = "pending"
            duplicate.eligibilityDecision = "excluded"
            duplicate.fullTextStatus = "not_requested"
            duplicate.answeringRQs = []
            apply_legacy_review_state(duplicate)
            await enqueue_article_index(db, article_id=duplicate.id, project_id=projectId)
            removed_duplicates += 1

        apply_legacy_review_state(canonical)
        applied_groups += 1

    await db.commit()
    return DedupApplyResponse(
        projectId=projectId,
        appliedGroups=applied_groups,
        removedDuplicates=removed_duplicates,
    )


@router.post("/{projectId}/artigos/promote-to-screening", response_model=PromoteToScreeningResponse)
async def promote_articles_to_screening(
    projectId: int,
    data: PromoteToScreeningRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_EDIT_PROJECT)
    moved_count = 0
    for article_id in data.articleIds:
        article = await get_article_or_404(article_id, projectId, current_user.id, db)
        if article.reviewOutcome != "active" or article.currentPhase != "identification":
            continue
        article.currentPhase = "screening"
        article.screeningDecision = "pending"
        apply_legacy_review_state(article)
        moved_count += 1

    await db.commit()
    return PromoteToScreeningResponse(projectId=projectId, movedCount=moved_count)


@router.post(
    "/{projectId}/artigos/promote-unique-to-screening",
    response_model=PromoteUniqueToScreeningResponse,
)
async def promote_unique_articles_to_screening(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_EDIT_PROJECT)
    result = await db.execute(
        select(Article).where(
            Article.projectId == projectId,
            Article.currentPhase == "identification",
            Article.reviewOutcome == "active",
        )
    )
    counts = promote_unique_identification_articles(list(result.scalars().all()))
    await db.commit()
    return PromoteUniqueToScreeningResponse(projectId=projectId, **counts)


@router.post("/{projectId}/artigos/{articleId}/screening-decision", response_model=ArticleResponse)
async def screening_decision(
    projectId: int,
    articleId: int,
    data: ScreeningDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)

    if await has_active_assignments(db, article_id=articleId, phase="screening"):
        result = await submit_review_decision(
            db,
            access=access,
            article_id=articleId,
            phase="screening",
            payload=data,
            reviewer_user_id=current_user.id,
        )
        if result.state == "consolidated":
            apply_legacy_review_state(result.article)
        if result.state == "consolidated":
            await enqueue_article_index(db, article_id=result.article.id, project_id=projectId)
        await db.commit()
        await db.refresh(result.article)
        return await _caller_article_response(
            db, result.article, current_user.id, phase="screening"
        )

    if access.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "REVIEW_NOT_ASSIGNED",
                "message": "Este artigo não foi atribuído a você.",
            },
        )

    if article.reviewOutcome != "active":
        article.reviewOutcome = "active"

    if article.currentPhase not in {"screening", "identification"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Etapa inválida",
                "message": "O artigo não está disponível para screening.",
            },
        )

    apply_review_decision(
        article,
        phase="screening",
        decision=ReviewDecisionData(decision=data.decision, reason_text=data.reasonText),
        now=datetime.now(timezone.utc),
    )
    await enqueue_article_index(db, article_id=article.id, project_id=projectId)
    await db.commit()
    await db.refresh(article)
    return build_article_response(article)


@router.post("/{projectId}/artigos/{articleId}/evaluate", response_model=ArticleResponse)
async def evaluate_single_article(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_user_ai_service),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    project = await get_project_or_404(projectId, current_user.id, db)
    await _require_article_write(db, article, current_user.id, administrative=True)
    await evaluate_article_if_possible(article, project, ai_service)
    await enqueue_article_index(db, article_id=article.id, project_id=projectId)
    await db.commit()
    await db.refresh(article)
    return build_article_response(article)


@router.post("/{projectId}/artigos/screening/batch-evaluate", response_model=BatchEvaluateResponse)
@router.post("/{projectId}/artigos/batch-evaluate", response_model=BatchEvaluateResponse)
async def batch_evaluate_screening(
    projectId: int,
    data: BatchEvaluateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_user_ai_service),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_EDIT_PROJECT)
    query = (
        select(Article)
        .where(
            Article.projectId == projectId,
            Article.currentPhase == "screening",
            Article.reviewOutcome == "active",
        )
        .order_by(Article.createdAt.desc())
        .limit(data.limit)
    )

    if data.onlyPending:
        query = query.where(Article.screeningDecision == "pending")

    result = await db.execute(query)
    candidates = result.scalars().all()

    summary = {
        "totalCandidates": len(candidates),
        "evaluated": 0,
        "skippedNoAbstract": 0,
        "skippedAlreadyEvaluated": 0,
        "suggestedIncluded": 0,
        "suggestedExcluded": 0,
    }

    if not candidates:
        return BatchEvaluateResponse(projectId=projectId, summary=BatchEvaluateSummary(**summary))

    project_data = build_project_ai_context(project)

    for article in candidates:
        if not article.abstract:
            summary["skippedNoAbstract"] += 1
            continue

        already_evaluated = bool(article.aiSuggestedStatus and article.aiRelevanceScore is not None)
        if already_evaluated and not data.forceReevaluate:
            summary["skippedAlreadyEvaluated"] += 1
            if article.aiSuggestedStatus == "incluido":
                summary["suggestedIncluded"] += 1
            elif article.aiSuggestedStatus == "excluido":
                summary["suggestedExcluded"] += 1
            continue

        eval_result = await ai_service.evaluate_article(
            {"title": article.title, "abstract": article.abstract},
            project_data,
        )
        apply_ai_evaluation(article, eval_result)
        summary["evaluated"] += 1
        if article.aiSuggestedStatus == "incluido":
            summary["suggestedIncluded"] += 1
        elif article.aiSuggestedStatus == "excluido":
            summary["suggestedExcluded"] += 1

    if not data.dryRun:
        await db.commit()

    return BatchEvaluateResponse(projectId=projectId, summary=BatchEvaluateSummary(**summary))


@router.patch("/{projectId}/artigos/{articleId}/full-text-status", response_model=ArticleResponse)
async def update_full_text_status(
    projectId: int,
    articleId: int,
    data: FullTextStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    await _require_article_write(db, article, current_user.id)
    # Protect managed outcomes after consolidation while the collaborative rollout is active.
    managed = await db.scalar(
        select(ReviewAssignment.id)
        .where(
            ReviewAssignment.articleId == articleId,
            ReviewAssignment.phase == "eligibility",
            ReviewAssignment.status != "cancelled",
        )
        .limit(1)
    )
    if managed is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "MANAGED_REVIEW",
                "message": "Revisão gerenciada: use eligibility-decision para texto completo indisponível ou o endpoint PDF para enviar o arquivo.",
            },
        )
    if article.currentPhase != "eligibility":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Etapa inválida",
                "message": "O status de texto completo só pode ser alterado na elegibilidade.",
            },
        )

    article.fullTextStatus = data.fullTextStatus
    if data.fullTextStatus == "unavailable":
        if not (data.reasonText or "").strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "Justificativa obrigatória",
                    "message": "Informe o motivo para texto completo indisponível.",
                },
            )
        article.reviewOutcome = "full_text_unavailable"
        article.eligibilityDecision = "excluded"
        article.eligibilityReasonText = data.reasonText.strip()
        article.eligibilityReviewedAt = datetime.utcnow()
        article.answeringRQs = []
    else:
        article.reviewOutcome = "active"
        article.eligibilityDecision = "pending"
        article.eligibilityReasonText = None
        article.eligibilityReviewedAt = None

    apply_legacy_review_state(article)
    await enqueue_article_index(db, article_id=article.id, project_id=projectId)
    await db.commit()
    await db.refresh(article)
    return await _caller_article_response(db, article, current_user.id)


@router.post(
    "/{projectId}/artigos/{articleId}/eligibility-decision", response_model=ArticleResponse
)
async def eligibility_decision(
    projectId: int,
    articleId: int,
    data: EligibilityDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    if await has_active_assignments(db, article_id=articleId, phase="eligibility"):
        result = await submit_review_decision(
            db,
            access=access,
            article_id=articleId,
            phase="eligibility",
            payload=data,
            reviewer_user_id=current_user.id,
        )
        if result.state == "consolidated":
            apply_quality_metrics(result.article, project.qualityAssessmentSchema or [])
            apply_legacy_review_state(result.article)
        if result.state == "consolidated":
            await enqueue_article_index(db, article_id=result.article.id, project_id=projectId)
        await db.commit()
        await db.refresh(result.article)
        return await _caller_article_response(
            db, result.article, current_user.id, phase="eligibility"
        )

    if access.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "REVIEW_NOT_ASSIGNED",
                "message": "Este artigo não foi atribuído a você.",
            },
        )
    if article.currentPhase not in {"eligibility", "included"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Etapa inválida", "message": "O artigo não está em elegibilidade."},
        )

    apply_review_decision(
        article,
        phase="eligibility",
        decision=ReviewDecisionData(
            decision=data.decision,
            reason_text=data.reasonText,
            checklist_answers=data.checklistAnswers,
            answering_rqs=data.answeringRQs,
        ),
        now=datetime.now(timezone.utc),
    )

    apply_quality_metrics(article, project.qualityAssessmentSchema or [])
    apply_legacy_review_state(article)
    await enqueue_article_index(db, article_id=article.id, project_id=projectId)
    await db.commit()
    await db.refresh(article)
    return build_article_response(article)


@router.patch("/{projectId}/artigos/{articleId}/evidence", response_model=ArticleResponse)
async def update_article_evidence(
    projectId: int,
    articleId: int,
    data: ArticleEvidenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    await _require_article_write(db, article, current_user.id)

    if not is_included_for_synthesis(article):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Artigo fora do corpus",
                "message": "A extracao estruturada so pode ser editada para artigos incluidos.",
            },
        )

    extraction_schema = project.dataExtractionSchema or []
    quality_schema = project.qualityAssessmentSchema or []

    article.extractionData = merge_extraction_data(
        getattr(article, "extractionData", None) or {},
        data.extractionData,
        extraction_schema,
    )
    article.qualityAssessmentAnswers = merge_quality_assessment_answers(
        getattr(article, "qualityAssessmentAnswers", None) or {},
        data.qualityAssessmentAnswers,
        quality_schema,
    )
    apply_quality_metrics(article, quality_schema)
    if data.markExtractionComplete:
        article.extractionCompletedAt = datetime.utcnow()

    await enqueue_article_index(db, article_id=article.id, project_id=projectId)
    await db.commit()
    await db.refresh(article)
    return await _caller_article_response(db, article, current_user.id)


@router.get("/{projectId}/artigos/synthesis-report")
async def get_project_synthesis_report(
    projectId: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    total = (
        await db.scalar(select(func.count(Article.id)).where(Article.projectId == projectId)) or 0
    )
    result = await db.execute(
        select(Article)
        .options(
            load_only(
                Article.id,
                Article.paperId,
                Article.title,
                Article.authors,
                Article.year,
                Article.journal,
                Article.sourceName,
                Article.sourceCategory,
                Article.reviewOutcome,
                Article.manualDecision,
                Article.answeringRQs,
                Article.extractionData,
                Article.extractionCompletedAt,
                Article.qualityAssessmentAnswers,
                Article.qualityScore,
                Article.qualityRating,
                Article.eligibilityReasonText,
                Article.screeningReasonText,
                Article.manualDecisionReason,
                Article.aiEvaluation,
                Article.notas,
                Article.status,
            )
        )
        .where(Article.projectId == projectId)
        .order_by(Article.title, Article.id)
        .offset((page - 1) * pageSize)
        .limit(pageSize)
    )
    articles = result.scalars().all()
    report = build_synthesis_report(project, articles)
    report["pagination"] = {
        "page": page,
        "pageSize": pageSize,
        "total": int(total),
        "isComplete": pageSize >= total and page == 1,
    }
    return report


@router.get("/{projectId}/artigos/rq-synthesis")
async def get_project_rq_synthesis(
    projectId: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await get_project_synthesis_report(
        projectId=projectId, page=page, pageSize=pageSize, current_user=current_user, db=db
    )
    return {
        "projectId": report["projectId"],
        "projectTitle": report["projectTitle"],
        "rqCount": report["rqCount"],
        "rqSynthesis": report["rqSynthesis"],
        "matrix": report["matrix"],
        "coverage": report["coverage"],
        "unlinkedIncludedArticles": report["unlinkedIncludedArticles"],
        "pagination": report["pagination"],
    }


@router.get("/{projectId}/artigos/{articleId}", response_model=ArticleResponse)
async def get_article_by_id(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    return (await _article_responses(db, [article], access=access, user_id=current_user.id))[0]


@router.put("/{projectId}/artigos/{articleId}", response_model=ArticleResponse)
async def update_article(
    projectId: int,
    articleId: int,
    data: ArticleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService | None = Depends(get_optional_user_ai_service),
):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    article = await article_mutation_service.update_article(
        db,
        access=access,
        article_id=articleId,
        request=data,
        actor_user_id=current_user.id,
        ai_service=ai_service,
    )
    await enqueue_article_index(db, article_id=article.id, project_id=projectId)
    await db.commit()
    await db.refresh(article)
    return build_article_response(article)


@router.patch("/{projectId}/artigos/{articleId}/status", response_model=ArticleResponse)
async def update_article_status(
    projectId: int,
    articleId: int,
    data: LegacyArticleStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    await _require_article_write(db, article, current_user.id, administrative=True)
    article.status = data.status
    await db.commit()
    await db.refresh(article)
    return build_article_response(article)


@router.put("/{projectId}/artigos/{articleId}/decision", response_model=ArticleResponse)
async def update_article_decision(
    projectId: int,
    articleId: int,
    data: LegacyArticleDecisionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    await _require_article_write(db, article, current_user.id)
    if data.decision == "pendente" and await has_active_assignments(
        db, article_id=articleId, phase=_review_phase(article)
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "ASSIGNED_REVIEW_ACTIVE",
                "message": "Reabra a revisão pelo fluxo de coordenação.",
            },
        )
    if article.currentPhase in {"identification", "screening"}:
        decision_payload = ScreeningDecisionRequest(
            decision="excluded" if data.decision == "excluido" else "included",
            reasonText=data.reason,
        )
        if data.decision == "pendente":
            article.currentPhase = "screening"
            article.reviewOutcome = "active"
            article.screeningDecision = "pending"
            article.screeningReasonText = None
            apply_legacy_review_state(article)
            await db.commit()
            await db.refresh(article)
            return build_article_response(article)
        return await screening_decision(projectId, articleId, decision_payload, current_user, db)

    if data.decision == "pendente":
        article.currentPhase = "eligibility"
        article.reviewOutcome = "active"
        article.eligibilityDecision = "pending"
        article.eligibilityReasonText = None
        apply_legacy_review_state(article)
        await enqueue_article_index(db, article_id=article.id, project_id=projectId)
        await db.commit()
        await db.refresh(article)
        return build_article_response(article)

    decision_payload = EligibilityDecisionRequest(
        decision="included" if data.decision == "incluido" else "excluded",
        reasonText=data.reason,
        checklistAnswers=article.eligibilityChecklistAnswers or {},
        answeringRQs=data.answeringRQs,
    )
    return await eligibility_decision(projectId, articleId, decision_payload, current_user, db)


@router.patch("/{projectId}/artigos/{articleId}/notes", response_model=ArticleResponse)
async def update_article_notes(
    projectId: int,
    articleId: int,
    data: ArticleNotesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    await _require_article_write(db, article, current_user.id)
    article.notas = data.notas
    await enqueue_article_index(db, article_id=article.id, project_id=projectId)
    await db.commit()
    await db.refresh(article)
    return await _caller_article_response(db, article, current_user.id)


@router.delete("/{projectId}/artigos/{articleId}")
async def delete_article(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    await article_mutation_service.delete_article(
        db, access=access, article_id=articleId, actor_user_id=current_user.id
    )
    await enqueue_article_index(db, article_id=articleId, project_id=projectId)
    await db.commit()
    return {"success": True, "message": "Artigo removido com sucesso"}


@router.post("/{projectId}/artigos/{articleId}/pdf", response_model=ArticleResponse)
async def upload_pdf(
    projectId: int,
    articleId: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    await _require_article_write(db, article, current_user.id)
    ArticleFileService().store_pdf(
        article, content=await file.read(), filename=file.filename, content_type=file.content_type
    )
    await enqueue_article_index(db, article_id=article.id, project_id=projectId)
    await db.commit()
    await db.refresh(article)
    return await _caller_article_response(db, article, current_user.id)


@router.get("/{projectId}/artigos/{articleId}/pdf")
async def get_pdf(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    content, content_type, filename = ArticleFileService().read_pdf(article)
    return StreamingResponse(
        BytesIO(content),
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{projectId}/artigos/{articleId}/download")
async def download_pdf(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    content, content_type, filename = ArticleFileService().read_pdf(article)
    return StreamingResponse(
        BytesIO(content),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{projectId}/artigos/{articleId}/relacionamentos")
async def add_relationship(
    projectId: int,
    articleId: int,
    data: RelationshipCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    await _require_article_write(db, article, current_user.id, administrative=True)
    related = await get_article_or_404(data.relatedArticleId, projectId, current_user.id, db)
    if related not in article.relatedArticles:
        article.relatedArticles.append(related)
        await db.commit()
    return {"success": True, "message": "Relacionamento adicionado"}


@router.delete("/{projectId}/artigos/{articleId}/relacionamentos/{relatedId}")
async def remove_relationship(
    projectId: int,
    articleId: int,
    relatedId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    await _require_article_write(db, article, current_user.id, administrative=True)
    related = await get_article_or_404(relatedId, projectId, current_user.id, db)
    if related in article.relatedArticles:
        article.relatedArticles.remove(related)
        await db.commit()
    return {"success": True, "message": "Relacionamento removido"}


@router.get("/{projectId}/artigos/{articleId}/relacionamentos")
async def get_relationships(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    return {
        "related_articles": [
            build_article_response(related).model_dump() for related in article.relatedArticles
        ]
    }


@router.get("/{projectId}/grafo")
async def get_project_graph(
    projectId: int,
    relationship_type: str = "all",
    min_similarity: float = 0.5,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_project_or_404(projectId, current_user.id, db)
    try:
        from app.services.neo4j_service import get_neo4j_service

        neo4j_service = get_neo4j_service()
        return await neo4j_service.get_project_graph(
            project_id=projectId,
            relationship_type=relationship_type,
            min_similarity=min_similarity,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Graph unavailable",
                "message": "Neo4j indisponível para consulta de grafo",
            },
        ) from exc


@router.post("/{projectId}/reprocessar-grafo")
async def reprocess_project_graph(
    projectId: int,
    only_missing_embeddings: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_user_ai_service),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    access = await resolve_project_access(db, project_id=projectId, user_id=current_user.id)
    require_capability(access, CAP_EDIT_PROJECT)
    result = await db.execute(select(Article).where(Article.projectId == projectId))
    all_articles = result.scalars().all()
    if not all_articles:
        return {"success": True, "message": "Nenhum artigo encontrado", "processed": 0}

    processed = 0
    for article in all_articles:
        if not article.abstract:
            continue
        await evaluate_article_if_possible(article, project, ai_service)
        processed += 1

    for article in sorted(all_articles, key=lambda item: item.id):
        await enqueue_article_index(db, article_id=article.id, project_id=projectId)
    await db.commit()

    return {
        "success": True,
        "message": f"Reprocessamento concluído: {processed} artigos",
        "processed": processed,
        "total": len(all_articles),
        "onlyMissingEmbeddings": only_missing_embeddings,
    }
