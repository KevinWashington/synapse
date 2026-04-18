from __future__ import annotations

from datetime import datetime
import csv
import hashlib
import logging
from io import BytesIO, StringIO
import re
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.article import Article
from app.models.project import Project
from app.models.user import User
from app.schemas.article import (
    ArticleCreate,
    ArticleListResponse,
    ArticleNotesUpdate,
    ArticleResponse,
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
    RelationshipCreate,
    ScreeningDecisionRequest,
    SelectionReportCounts,
    SelectionReportResponse,
    SelectionSummaryPhaseItem,
    SelectionSummaryResponse,
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
EXCLUDED_OUTCOMES = ("duplicate_removed", "excluded_screening", "full_text_unavailable", "excluded_eligibility")

_INVALID_ANCHOR_CHARS = re.compile(r"[^a-z0-9]+")


def _graph_sync_http_error(message: str = "Falha ao sincronizar corpus incluído") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "error": "Selection index unavailable",
            "message": message,
        },
    )


async def get_project_or_404(projectId: int, ownerId: int, db: AsyncSession) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == projectId, Project.ownerId == ownerId)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Projeto não encontrado", "message": "Projeto inexistente ou sem permissão"},
        )
    return project


async def get_article_or_404(articleId: int, projectId: int, ownerId: int, db: AsyncSession) -> Article:
    result = await db.execute(
        select(Article).where(
            Article.id == articleId,
            Article.projectId == projectId,
            Article.ownerId == ownerId,
        )
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Artigo não encontrado", "message": "Artigo inexistente ou sem permissão"},
        )
    return article


def _normalize_paper_id(paper_id: str | None) -> str | None:
    if not paper_id:
        return None
    normalized = _INVALID_ANCHOR_CHARS.sub("-", paper_id.strip().lower()).strip("-")
    return normalized or None


def _generate_paper_id(doi: str | None, title: str | None, year: int | None) -> str:
    doi_normalized = _normalize_paper_id(doi)
    if doi_normalized:
        return doi_normalized

    title_base = _normalize_paper_id(title or "paper") or "paper"
    year_base = str(year) if year is not None else "unknown"
    digest = hashlib.sha1(f"{title_base}|{year_base}".encode("utf-8")).hexdigest()[:10]
    return f"{title_base}-{year_base}-{digest}"


def _resolve_paper_id(
    *,
    provided: str | None,
    doi: str | None,
    title: str | None,
    year: int | None,
) -> str:
    normalized = _normalize_paper_id(provided)
    if normalized:
        return normalized
    return _generate_paper_id(doi=doi, title=title, year=year)


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = re.sub(r"\s+", " ", value).strip().lower()
    normalized = _INVALID_ANCHOR_CHARS.sub(" ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _normalize_doi(value: str | None) -> str | None:
    if not value:
        return None
    normalized = _normalize_text(value).replace(" ", "")
    return normalized or None


def _title_year_key(title: str | None, year: int | None) -> str | None:
    normalized_title = _normalize_text(title)
    if not normalized_title or year is None:
        return None
    return f"{normalized_title}|{year}"


def _shared_author_signature(authors: str | None) -> set[str]:
    normalized = (authors or "").replace(" and ", ";")
    return {part.strip().lower() for part in normalized.split(";") if part.strip()}


def _build_project_ai_context(project: Project) -> dict[str, list[str]]:
    return {
        "criteriosInclusao": project.criteriosInclusao or [],
        "criteriosExclusao": project.criteriosExclusao or [],
        "researchQuestions": project.researchQuestions or [],
    }


def _apply_ai_evaluation(article: Article, eval_result: dict) -> None:
    article.aiEvaluation = eval_result.get("justification")
    article.aiSuggestedStatus = eval_result.get("suggestedStatus")
    article.aiRelevanceScore = eval_result.get("relevanceScore")
    article.aiSuggestedRQs = eval_result.get("suggestedRQs", [])
    article.aiMethodology = eval_result.get("methodology")
    article.aiDatabase = eval_result.get("database")
    article.aiDomain = eval_result.get("domain")
    article.aiKeywords = eval_result.get("keywords", [])


def _should_be_indexed(article: Article) -> bool:
    return article.reviewOutcome == "included"


def _set_legacy_state_from_workflow(article: Article) -> None:
    if article.reviewOutcome == "included":
        article.status = "analisado"
        article.manualDecision = "incluido"
        article.manualDecisionReason = article.eligibilityReasonText
        article.decisionUpdatedAt = article.eligibilityReviewedAt or article.includedAt
        article.exclusionCriteria = []
        return

    if article.reviewOutcome in {"excluded_screening", "excluded_eligibility", "full_text_unavailable", "duplicate_removed"}:
        article.status = "excluido"
        article.manualDecision = "excluido"
        article.manualDecisionReason = article.eligibilityReasonText or article.screeningReasonText or article.duplicateReasonText
        article.decisionUpdatedAt = (
            article.eligibilityReviewedAt
            or article.screeningReviewedAt
            or article.updatedAt
        )
        if article.reviewOutcome == "excluded_screening":
            article.exclusionCriteria = [article.screeningReasonText] if article.screeningReasonText else []
        elif article.reviewOutcome in {"excluded_eligibility", "full_text_unavailable"}:
            article.exclusionCriteria = [article.eligibilityReasonText] if article.eligibilityReasonText else []
        elif article.reviewOutcome == "duplicate_removed":
            article.exclusionCriteria = [article.duplicateReasonText] if article.duplicateReasonText else []
        return

    if article.currentPhase == "eligibility":
        article.status = "analisado"
    else:
        article.status = "pendente"

    if article.screeningDecision == "excluded":
        article.manualDecision = "excluido"
        article.manualDecisionReason = article.screeningReasonText
    elif article.currentPhase == "eligibility" and article.screeningDecision == "included":
        article.manualDecision = "incluido"
        article.manualDecisionReason = article.screeningReasonText
    else:
        article.manualDecision = None
        article.manualDecisionReason = None

    article.decisionUpdatedAt = article.eligibilityReviewedAt or article.screeningReviewedAt
    if article.manualDecision != "excluido":
        article.exclusionCriteria = []


def _build_article_response(article: Article) -> ArticleResponse:
    _set_legacy_state_from_workflow(article)
    response = ArticleResponse.model_validate(article)
    response.hasPdf = article.pdfData is not None
    response.eligibilityChecklistAnswers = article.eligibilityChecklistAnswers or {}
    response.aiSuggestedRQs = article.aiSuggestedRQs or []
    response.aiKeywords = article.aiKeywords or []
    response.exclusionCriteria = article.exclusionCriteria or []
    response.answeringRQs = article.answeringRQs or []
    return response


def _is_included_for_synthesis(article: Article) -> bool:
    review_outcome = getattr(article, "reviewOutcome", None)
    if review_outcome:
        return review_outcome == "included"

    if getattr(article, "manualDecision", None) == "incluido":
        return True
    if getattr(article, "manualDecision", None) == "excluido":
        return False
    return getattr(article, "status", None) == "analisado"


def _build_evidence_excerpt(article: Article) -> str | None:
    candidate = (
        getattr(article, "eligibilityReasonText", None)
        or getattr(article, "screeningReasonText", None)
        or getattr(article, "manualDecisionReason", None)
        or getattr(article, "aiEvaluation", None)
        or getattr(article, "notas", None)
        or ""
    ).strip()
    if not candidate:
        return None
    if len(candidate) <= 280:
        return candidate
    return candidate[:277] + "..."


def _build_vector_payload(article: Article, qdrant) -> dict:
    return qdrant.build_payload(
        paper_id=article.paperId,
        project_id=article.projectId,
        metadata={
            "article_id": article.id,
            "title": article.title,
            "authors": article.authors,
            "year": article.year,
            "journal": article.journal,
            "abstract": article.abstract,
            "methodology": article.aiMethodology,
            "domain": article.aiDomain,
            "keywords": article.aiKeywords,
            "notas": article.notas,
            "review_outcome": article.reviewOutcome,
            "phase": article.currentPhase,
            "source_name": article.sourceName,
        },
    )


async def _sync_article_vector_payload(article: Article) -> None:
    from app.services.qdrant_retrieval_service import get_qdrant_retrieval_service

    qdrant = get_qdrant_retrieval_service()

    if not _should_be_indexed(article) or article.embedding is None or not article.paperId:
        await qdrant.delete_article(article.id)
        return

    payload = _build_vector_payload(article, qdrant)
    await qdrant.upsert_payload(payload=payload, embedding=list(article.embedding))


async def _sync_article_graph_state(article: Article, db: AsyncSession) -> None:
    from app.services.graph_sync_service import get_graph_sync_service

    graph_sync = get_graph_sync_service()
    try:
        if _should_be_indexed(article):
            await graph_sync.sync_article_to_graph(article, db)
        else:
            await graph_sync.delete_article_from_graph(article.id)
    except Exception as exc:
        raise _graph_sync_http_error() from exc


async def _sync_article_indexes(article: Article, db: AsyncSession) -> None:
    await _sync_article_graph_state(article, db)
    try:
        await _sync_article_vector_payload(article)
    except Exception as exc:  # pragma: no cover - best effort log
        logger.warning("Falha ao sincronizar payload vetorial do artigo %s: %s", article.id, exc)


def _legacy_status_query_filter(status_value: str | None):
    if status_value == "pendente":
        return Article.reviewOutcome == "active"
    if status_value == "analisado":
        return or_(Article.currentPhase == "eligibility", Article.reviewOutcome == "included")
    if status_value == "excluido":
        return Article.reviewOutcome.in_(EXCLUDED_OUTCOMES)
    return None


def _format_source_breakdown(rows: list[Article]) -> list[dict]:
    by_source: dict[tuple[str, str], dict] = {}
    for article in rows:
        key = (article.sourceCategory, article.sourceName)
        item = by_source.setdefault(
            key,
            {
                "sourceCategory": article.sourceCategory,
                "sourceName": article.sourceName,
                "total": 0,
                "included": 0,
                "duplicatesRemoved": 0,
                "excluded": 0,
            },
        )
        item["total"] += 1
        if article.reviewOutcome == "included":
            item["included"] += 1
        elif article.reviewOutcome == "duplicate_removed":
            item["duplicatesRemoved"] += 1
        elif article.reviewOutcome in {"excluded_screening", "excluded_eligibility", "full_text_unavailable"}:
            item["excluded"] += 1
    return sorted(by_source.values(), key=lambda item: (item["sourceCategory"], item["sourceName"]))


def _selection_summary_from_articles(project_id: int, articles: list[Article]) -> SelectionSummaryResponse:
    identification_total = len(articles)
    identification_active = sum(
        1 for article in articles if article.currentPhase == "identification" and article.reviewOutcome == "active"
    )
    duplicates_removed = sum(1 for article in articles if article.reviewOutcome == "duplicate_removed")

    screening_total = sum(
        1
        for article in articles
        if article.currentPhase in {"screening", "eligibility", "included"}
        or article.reviewOutcome in {"excluded_screening", "excluded_eligibility", "full_text_unavailable", "included"}
    )
    screening_active = sum(
        1 for article in articles if article.currentPhase == "screening" and article.reviewOutcome == "active"
    )
    screening_excluded = sum(1 for article in articles if article.reviewOutcome == "excluded_screening")

    eligibility_total = sum(
        1
        for article in articles
        if article.currentPhase in {"eligibility", "included"}
        or article.reviewOutcome in {"excluded_eligibility", "full_text_unavailable", "included"}
    )
    eligibility_active = sum(
        1 for article in articles if article.currentPhase == "eligibility" and article.reviewOutcome == "active"
    )
    eligibility_excluded = sum(
        1 for article in articles if article.reviewOutcome in {"excluded_eligibility", "full_text_unavailable"}
    )

    return SelectionSummaryResponse(
        projectId=project_id,
        totalRecords=len(articles),
        identification=SelectionSummaryPhaseItem(
            total=identification_total,
            active=identification_active,
            excluded=duplicates_removed,
        ),
        screening=SelectionSummaryPhaseItem(
            total=screening_total,
            active=screening_active,
            excluded=screening_excluded,
        ),
        eligibility=SelectionSummaryPhaseItem(
            total=eligibility_total,
            active=eligibility_active,
            excluded=eligibility_excluded,
        ),
        included=sum(1 for article in articles if article.reviewOutcome == "included"),
        duplicatesRemoved=duplicates_removed,
        greyLiterature=sum(1 for article in articles if article.sourceCategory == "grey_literature"),
        fullTextUnavailable=sum(1 for article in articles if article.reviewOutcome == "full_text_unavailable"),
        bySource=_format_source_breakdown(articles),
    )


def _selection_report_from_articles(project: Project, articles: list[Article]) -> SelectionReportResponse:
    exclusion_reason_map = {
        "screening": {},
        "eligibility": {},
    }
    for article in articles:
        if article.reviewOutcome == "excluded_screening" and article.screeningReasonText:
            exclusion_reason_map["screening"][article.screeningReasonText] = (
                exclusion_reason_map["screening"].get(article.screeningReasonText, 0) + 1
            )
        if article.reviewOutcome in {"excluded_eligibility", "full_text_unavailable"}:
            reason = article.eligibilityReasonText or "Texto completo indisponível"
            exclusion_reason_map["eligibility"][reason] = exclusion_reason_map["eligibility"].get(reason, 0) + 1

    exclusion_reasons = {
        key: [
            {"reason": reason, "count": count}
            for reason, count in sorted(values.items(), key=lambda item: (-item[1], item[0]))
        ]
        for key, values in exclusion_reason_map.items()
    }

    screening_pool = sum(
        1 for article in articles if article.currentPhase in {"screening", "eligibility", "included"} or article.reviewOutcome == "excluded_screening"
    )
    eligibility_pool = sum(
        1 for article in articles if article.currentPhase in {"eligibility", "included"} or article.reviewOutcome in {"excluded_eligibility", "full_text_unavailable"}
    )

    return SelectionReportResponse(
        projectId=project.id,
        projectTitle=project.title,
        counts=SelectionReportCounts(
            identified=len(articles),
            duplicatesRemoved=sum(1 for article in articles if article.reviewOutcome == "duplicate_removed"),
            screeningPool=screening_pool,
            excludedScreening=sum(1 for article in articles if article.reviewOutcome == "excluded_screening"),
            eligibilityPool=eligibility_pool,
            fullTextUnavailable=sum(1 for article in articles if article.reviewOutcome == "full_text_unavailable"),
            excludedEligibility=sum(1 for article in articles if article.reviewOutcome == "excluded_eligibility"),
            included=sum(1 for article in articles if article.reviewOutcome == "included"),
        ),
        bySource=_format_source_breakdown(articles),
        exclusionReasons=exclusion_reasons,
        greyLiteratureCount=sum(1 for article in articles if article.sourceCategory == "grey_literature"),
    )


def _build_report_csv(report: SelectionReportResponse) -> str:
    output = StringIO()
    writer = csv.writer(output)

    writer.writerow(["metric", "value"])
    writer.writerow(["identified", report.counts.identified])
    writer.writerow(["duplicates_removed", report.counts.duplicatesRemoved])
    writer.writerow(["screening_pool", report.counts.screeningPool])
    writer.writerow(["excluded_screening", report.counts.excludedScreening])
    writer.writerow(["eligibility_pool", report.counts.eligibilityPool])
    writer.writerow(["full_text_unavailable", report.counts.fullTextUnavailable])
    writer.writerow(["excluded_eligibility", report.counts.excludedEligibility])
    writer.writerow(["included", report.counts.included])
    writer.writerow(["grey_literature", report.greyLiteratureCount])
    writer.writerow([])
    writer.writerow(["source_category", "source_name", "total", "included", "duplicates_removed", "excluded"])
    for item in report.bySource:
        writer.writerow(
            [
                item["sourceCategory"],
                item["sourceName"],
                item["total"],
                item["included"],
                item["duplicatesRemoved"],
                item["excluded"],
            ]
        )
    writer.writerow([])
    writer.writerow(["phase", "reason", "count"])
    for phase, reasons in report.exclusionReasons.items():
        for item in reasons:
            writer.writerow([phase, item["reason"], item["count"]])

    return output.getvalue()


def _create_article_entity(
    *,
    payload,
    project_id: int,
    owner_id: int,
    entry_method: str,
    source_category: str,
    source_name: str,
    import_batch_label: str | None,
) -> Article:
    article = Article(
        title=payload.title,
        authors=payload.authors,
        year=payload.year,
        journal=payload.journal,
        doi=payload.doi,
        abstract=payload.abstract,
        keywords=payload.keywords,
        pages=payload.pages,
        volume=payload.volume,
        number=payload.number,
        issn=payload.issn,
        notas=payload.notas,
        projectId=project_id,
        ownerId=owner_id,
        entryMethod=entry_method,
        sourceCategory=source_category,
        sourceName=source_name,
        importBatchLabel=import_batch_label,
        currentPhase="identification",
        reviewOutcome="active",
        screeningDecision="pending",
        fullTextStatus="not_requested",
        eligibilityDecision="pending",
    )
    article.paperId = _resolve_paper_id(
        provided=getattr(payload, "paperId", None),
        doi=article.doi,
        title=article.title,
        year=article.year,
    )
    _set_legacy_state_from_workflow(article)
    return article


async def _evaluate_article_if_possible(article: Article, project: Project) -> None:
    if not article.abstract:
        return

    try:
        from app.services.ai_service import get_ai_service

        ai_service = get_ai_service()
        eval_result = await ai_service.evaluate_article(
            {"title": article.title, "abstract": article.abstract},
            _build_project_ai_context(project),
        )
        _apply_ai_evaluation(article, eval_result)
    except Exception:  # pragma: no cover - external service
        logger.exception("Erro ao avaliar artigo %s com IA", article.title)

    try:
        from app.services.embedding_service import get_embedding_service

        embedding_service = get_embedding_service()
        embedding = embedding_service.generate_embedding(article.abstract)
        if embedding:
            article.embedding = embedding
    except Exception:  # pragma: no cover - external service
        logger.exception("Erro ao gerar embedding do artigo %s", article.title)


def _build_duplicate_candidates_from_articles(articles: list[Article]) -> list[DuplicateCandidate]:
    groups: dict[str, DuplicateCandidate] = {}
    candidate_pool = [article for article in articles if article.reviewOutcome == "active"]

    used_ids: set[int] = set()
    doi_groups: dict[str, list[Article]] = {}
    for article in candidate_pool:
        normalized_doi = _normalize_doi(article.doi)
        if normalized_doi:
            doi_groups.setdefault(normalized_doi, []).append(article)

    for normalized_doi, matches in doi_groups.items():
        if len(matches) < 2:
            continue
        group_key = f"doi:{normalized_doi}"
        groups[group_key] = DuplicateCandidate(
            groupKey=group_key,
            reasonCode="same_doi",
            reasonText="DOI idêntico detectado automaticamente.",
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
        used_ids.update(article.id for article in matches)

    title_year_groups: dict[str, list[Article]] = {}
    for article in candidate_pool:
        if article.id in used_ids:
            continue
        key = _title_year_key(article.title, article.year)
        if key:
            title_year_groups.setdefault(key, []).append(article)

    for title_year_key, matches in title_year_groups.items():
        if len(matches) < 2:
            continue
        group_key = f"title-year:{title_year_key}"
        groups[group_key] = DuplicateCandidate(
            groupKey=group_key,
            reasonCode="same_title_year",
            reasonText="Título normalizado e ano coincidem.",
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
        used_ids.update(article.id for article in matches)

    remaining = [article for article in candidate_pool if article.id not in used_ids]
    strong_group_index = 0
    strong_groups: list[list[Article]] = []
    visited: set[int] = set()
    for article in remaining:
        if article.id in visited:
            continue
        cluster = [article]
        visited.add(article.id)
        article_title = _normalize_text(article.title)
        article_authors = _shared_author_signature(article.authors)
        for other in remaining:
            if other.id in visited or other.id == article.id:
                continue
            if article.year != other.year:
                continue
            other_title = _normalize_text(other.title)
            if not article_title or not other_title:
                continue
            similarity = SequenceMatcher(None, article_title, other_title).ratio()
            other_authors = _shared_author_signature(other.authors)
            if similarity >= 0.96 and (article_authors & other_authors or _normalize_text(article.journal) == _normalize_text(other.journal)):
                cluster.append(other)
                visited.add(other.id)
        if len(cluster) > 1:
            strong_groups.append(cluster)

    for matches in strong_groups:
        strong_group_index += 1
        group_key = f"strong:{strong_group_index}"
        groups[group_key] = DuplicateCandidate(
            groupKey=group_key,
            reasonCode="strong_metadata_match",
            reasonText="Alta similaridade entre título, ano e metadados.",
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

    return sorted(groups.values(), key=lambda item: item.groupKey)


def _assign_duplicate_markers(articles: list[Article], candidates: list[DuplicateCandidate]) -> None:
    for article in articles:
        if article.reviewOutcome == "active":
            article.duplicateGroupKey = None
            article.duplicateReasonCode = None
            article.duplicateReasonText = None

    article_map = {article.id: article for article in articles}
    for candidate in candidates:
        for article_id in candidate.candidateIds:
            article = article_map.get(article_id)
            if article is None or article.reviewOutcome != "active":
                continue
            article.duplicateGroupKey = candidate.groupKey
            article.duplicateReasonCode = candidate.reasonCode
            article.duplicateReasonText = candidate.reasonText


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
    page: int = 1,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_project_or_404(projectId, current_user.id, db)

    query = select(Article).where(Article.projectId == projectId, Article.ownerId == current_user.id)

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
        articles=[_build_article_response(article) for article in articles],
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
    result = await db.execute(
        select(Article).where(Article.projectId == projectId, Article.ownerId == current_user.id)
    )
    articles = result.scalars().all()
    return _selection_summary_from_articles(projectId, articles)


@router.get("/{projectId}/artigos/filter-summary")
async def get_project_filter_summary(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    summary = await get_project_selection_summary(projectId=projectId, current_user=current_user, db=db)
    return summary.model_dump()


@router.get("/{projectId}/selection-report", response_model=SelectionReportResponse)
async def get_project_selection_report(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    result = await db.execute(
        select(Article).where(Article.projectId == projectId, Article.ownerId == current_user.id)
    )
    articles = result.scalars().all()
    return _selection_report_from_articles(project, articles)


@router.get("/{projectId}/selection-report/export")
async def export_project_selection_report(
    projectId: int,
    format: str = "json",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = await get_project_selection_report(projectId=projectId, current_user=current_user, db=db)
    if format == "csv":
        csv_content = _build_report_csv(report)
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="selection-report-{projectId}.csv"'},
        )

    return JSONResponse(content=report.model_dump())


@router.post("/{projectId}/artigos", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    projectId: int,
    data: ArticleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    article = _create_article_entity(
        payload=data,
        project_id=projectId,
        owner_id=current_user.id,
        entry_method=data.entryMethod,
        source_category=data.sourceCategory,
        source_name=data.sourceName,
        import_batch_label=data.importBatchLabel,
    )

    await _evaluate_article_if_possible(article, project)

    db.add(article)
    await db.commit()
    await db.refresh(article)
    return _build_article_response(article)


@router.post("/{projectId}/artigos/import-bibtex", response_model=ImportBibTeXResponse)
async def import_bibtex_entries(
    projectId: int,
    data: ImportBibTeXRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    batch_label = data.importBatchLabel or f"bibtex-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    article_ids: list[int] = []

    for entry in data.entries:
        article = _create_article_entity(
            payload=entry,
            project_id=projectId,
            owner_id=current_user.id,
            entry_method="bibtex",
            source_category=data.sourceCategory,
            source_name=data.sourceName,
            import_batch_label=batch_label,
        )
        await _evaluate_article_if_possible(article, project)
        db.add(article)
        await db.flush()
        article_ids.append(article.id)

    await db.commit()
    return ImportBibTeXResponse(
        projectId=projectId,
        importedCount=len(article_ids),
        batchLabel=batch_label,
        articleIds=article_ids,
    )


@router.post("/{projectId}/artigos/dedup/analyze", response_model=DedupAnalyzeResponse)
async def analyze_duplicates(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_project_or_404(projectId, current_user.id, db)
    result = await db.execute(
        select(Article).where(Article.projectId == projectId, Article.ownerId == current_user.id)
    )
    articles = result.scalars().all()
    candidates = _build_duplicate_candidates_from_articles(articles)
    _assign_duplicate_markers(articles, candidates)
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
            Article.ownerId == current_user.id,
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
    await get_project_or_404(projectId, current_user.id, db)
    applied_groups = 0
    removed_duplicates = 0

    for decision in data.decisions:
        canonical = await get_article_or_404(decision.canonicalArticleId, projectId, current_user.id, db)
        if canonical.duplicateGroupKey != decision.groupKey:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "Grupo inválido", "message": "Artigo canônico fora do grupo selecionado."},
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
            _set_legacy_state_from_workflow(duplicate)
            removed_duplicates += 1

        _set_legacy_state_from_workflow(canonical)
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
    await get_project_or_404(projectId, current_user.id, db)
    moved_count = 0
    for article_id in data.articleIds:
        article = await get_article_or_404(article_id, projectId, current_user.id, db)
        if article.reviewOutcome != "active" or article.currentPhase != "identification":
            continue
        article.currentPhase = "screening"
        article.screeningDecision = "pending"
        _set_legacy_state_from_workflow(article)
        moved_count += 1

    await db.commit()
    return PromoteToScreeningResponse(projectId=projectId, movedCount=moved_count)


@router.post("/{projectId}/artigos/{articleId}/screening-decision", response_model=ArticleResponse)
async def screening_decision(
    projectId: int,
    articleId: int,
    data: ScreeningDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    if article.reviewOutcome != "active" or article.currentPhase not in {"screening", "identification"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Etapa inválida", "message": "O artigo não está disponível para screening."},
        )

    if data.decision == "excluded" and not (data.reasonText or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Justificativa obrigatória", "message": "Informe o motivo da exclusão no screening."},
        )

    article.currentPhase = "screening"
    article.screeningDecision = data.decision
    article.screeningReasonText = (data.reasonText or "").strip() or None
    article.screeningReviewedAt = datetime.utcnow()
    article.duplicateGroupKey = None
    article.duplicateReasonCode = None
    article.duplicateReasonText = None

    if data.decision == "included":
        article.currentPhase = "eligibility"
        article.reviewOutcome = "active"
        article.fullTextStatus = "uploaded" if article.pdfData is not None else "pending_upload"
    else:
        article.reviewOutcome = "excluded_screening"
        article.eligibilityDecision = "excluded"
        article.answeringRQs = []

    _set_legacy_state_from_workflow(article)
    await db.commit()
    await db.refresh(article)
    await _sync_article_indexes(article, db)
    return _build_article_response(article)


@router.post("/{projectId}/artigos/screening/batch-evaluate", response_model=BatchEvaluateResponse)
@router.post("/{projectId}/artigos/batch-evaluate", response_model=BatchEvaluateResponse)
async def batch_evaluate_screening(
    projectId: int,
    data: BatchEvaluateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    query = (
        select(Article)
        .where(
            Article.projectId == projectId,
            Article.ownerId == current_user.id,
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

    from app.services.ai_service import get_ai_service

    ai_service = get_ai_service()
    project_data = _build_project_ai_context(project)

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
        _apply_ai_evaluation(article, eval_result)
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
    if article.currentPhase != "eligibility":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Etapa inválida", "message": "O status de texto completo só pode ser alterado na elegibilidade."},
        )

    article.fullTextStatus = data.fullTextStatus
    if data.fullTextStatus == "unavailable":
        if not (data.reasonText or "").strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "Justificativa obrigatória", "message": "Informe o motivo para texto completo indisponível."},
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

    _set_legacy_state_from_workflow(article)
    await db.commit()
    await db.refresh(article)
    await _sync_article_indexes(article, db)
    return _build_article_response(article)


@router.post("/{projectId}/artigos/{articleId}/eligibility-decision", response_model=ArticleResponse)
async def eligibility_decision(
    projectId: int,
    articleId: int,
    data: EligibilityDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    if article.currentPhase not in {"eligibility", "included"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Etapa inválida", "message": "O artigo não está em elegibilidade."},
        )

    reason_text = (data.reasonText or "").strip() or None
    if data.decision in {"excluded", "full_text_unavailable"} and not reason_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Justificativa obrigatória", "message": "Informe o motivo da decisão final."},
        )

    article.eligibilityReviewedAt = datetime.utcnow()
    article.eligibilityChecklistAnswers = data.checklistAnswers or {}

    if data.decision == "included":
        if article.pdfData is None and article.fullTextStatus != "uploaded":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "PDF obrigatório", "message": "Faça upload do texto completo antes de incluir no corpus final."},
            )
        article.currentPhase = "included"
        article.reviewOutcome = "included"
        article.fullTextStatus = "uploaded"
        article.eligibilityDecision = "included"
        article.eligibilityReasonText = reason_text
        article.includedAt = datetime.utcnow()
        article.answeringRQs = sorted({rq for rq in data.answeringRQs if isinstance(rq, int) and rq > 0})
    elif data.decision == "full_text_unavailable":
        article.currentPhase = "eligibility"
        article.reviewOutcome = "full_text_unavailable"
        article.fullTextStatus = "unavailable"
        article.eligibilityDecision = "excluded"
        article.eligibilityReasonText = reason_text
        article.includedAt = None
        article.answeringRQs = []
    else:
        article.currentPhase = "eligibility"
        article.reviewOutcome = "excluded_eligibility"
        article.eligibilityDecision = "excluded"
        article.eligibilityReasonText = reason_text
        article.includedAt = None
        article.answeringRQs = []

    _set_legacy_state_from_workflow(article)
    await db.commit()
    await db.refresh(article)
    await _sync_article_indexes(article, db)
    return _build_article_response(article)


@router.get("/{projectId}/artigos/rq-synthesis")
async def get_project_rq_synthesis(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(projectId, current_user.id, db)
    result = await db.execute(
        select(Article).where(Article.projectId == projectId, Article.ownerId == current_user.id)
    )
    articles = result.scalars().all()

    research_questions = project.researchQuestions or []
    rq_count = len(research_questions)

    included_articles = [article for article in articles if _is_included_for_synthesis(article)]
    rq_to_articles: dict[int, list[Article]] = {index: [] for index in range(1, rq_count + 1)}
    included_without_rq: list[Article] = []

    for article in included_articles:
        linked_rqs = [rq for rq in (article.answeringRQs or []) if 1 <= rq <= rq_count]
        if not linked_rqs:
            included_without_rq.append(article)
            continue
        for rq in sorted(set(linked_rqs)):
            rq_to_articles[rq].append(article)

    rq_synthesis = []
    for index, question in enumerate(research_questions, start=1):
        rq_articles = rq_to_articles.get(index, [])
        rq_synthesis.append(
            {
                "rqNumber": index,
                "question": question,
                "evidenceCount": len(rq_articles),
                "articles": [
                    {
                        "id": article.id,
                        "paperId": article.paperId,
                        "title": article.title,
                        "authors": article.authors,
                        "year": article.year,
                        "status": article.status,
                        "manualDecision": article.manualDecision,
                            "reason": getattr(article, "eligibilityReasonText", None) or getattr(article, "manualDecisionReason", None),
                        "evidenceExcerpt": _build_evidence_excerpt(article),
                    }
                    for article in rq_articles
                ],
            }
        )

    matrix = []
    for article in included_articles:
        article_links = set(rq for rq in (article.answeringRQs or []) if 1 <= rq <= rq_count)
        matrix.append(
            {
                "articleId": article.id,
                "paperId": article.paperId,
                "title": article.title,
                "year": article.year,
                "decision": article.reviewOutcome if getattr(article, "reviewOutcome", None) else article.manualDecision or article.status,
                "rqs": [index for index in range(1, rq_count + 1) if index in article_links],
            }
        )

    answered_rqs = sum(1 for index in range(1, rq_count + 1) if rq_to_articles.get(index))
    coverage_percentage = round((answered_rqs / rq_count) * 100, 2) if rq_count else 0

    return {
        "projectId": projectId,
        "projectTitle": project.title,
        "rqCount": rq_count,
        "rqSynthesis": rq_synthesis,
        "matrix": matrix,
        "coverage": {
            "answeredRQCount": answered_rqs,
            "answeredRQPercentage": coverage_percentage,
            "includedArticles": len(included_articles),
            "includedWithoutRQLinks": len(included_without_rq),
        },
        "unlinkedIncludedArticles": [
            {
                "id": article.id,
                "paperId": article.paperId,
                "title": article.title,
                "year": article.year,
                "status": article.status,
                "manualDecision": article.manualDecision,
            }
            for article in included_without_rq
        ],
    }


@router.get("/{projectId}/artigos/{articleId}", response_model=ArticleResponse)
async def get_article_by_id(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    return _build_article_response(article)


@router.put("/{projectId}/artigos/{articleId}", response_model=ArticleResponse)
async def update_article(
    projectId: int,
    articleId: int,
    data: ArticleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    project = await get_project_or_404(projectId, current_user.id, db)

    update_data = data.model_dump(exclude_unset=True)
    anchor_fields_changed = any(key in update_data for key in ("paperId", "doi", "title", "year"))
    abstract_changed = "abstract" in update_data

    for field, value in update_data.items():
        setattr(article, field, value)

    if anchor_fields_changed:
        article.paperId = _resolve_paper_id(
            provided=article.paperId,
            doi=article.doi,
            title=article.title,
            year=article.year,
        )

    if abstract_changed or (article.abstract and article.embedding is None):
        await _evaluate_article_if_possible(article, project)

    _set_legacy_state_from_workflow(article)
    await db.commit()
    await db.refresh(article)
    await _sync_article_indexes(article, db)
    return _build_article_response(article)


@router.patch("/{projectId}/artigos/{articleId}/status", response_model=ArticleResponse)
async def update_article_status(
    projectId: int,
    articleId: int,
    data: LegacyArticleStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    article.status = data.status
    await db.commit()
    await db.refresh(article)
    return _build_article_response(article)


@router.put("/{projectId}/artigos/{articleId}/decision", response_model=ArticleResponse)
async def update_article_decision(
    projectId: int,
    articleId: int,
    data: LegacyArticleDecisionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
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
            _set_legacy_state_from_workflow(article)
            await db.commit()
            await db.refresh(article)
            return _build_article_response(article)
        return await screening_decision(projectId, articleId, decision_payload, current_user, db)

    if data.decision == "pendente":
        article.currentPhase = "eligibility"
        article.reviewOutcome = "active"
        article.eligibilityDecision = "pending"
        article.eligibilityReasonText = None
        _set_legacy_state_from_workflow(article)
        await db.commit()
        await db.refresh(article)
        await _sync_article_indexes(article, db)
        return _build_article_response(article)

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
    article.notas = data.notas
    await db.commit()
    await db.refresh(article)
    await _sync_article_indexes(article, db)
    return _build_article_response(article)


@router.delete("/{projectId}/artigos/{articleId}")
async def delete_article(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    try:
        await _sync_article_graph_state(article, db)
    except HTTPException:
        logger.warning("Falha ao limpar grafo do artigo %s antes da remoção", articleId)
    try:
        from app.services.qdrant_retrieval_service import get_qdrant_retrieval_service

        await get_qdrant_retrieval_service().delete_article(articleId)
    except Exception as exc:
        logger.warning("Falha ao limpar vetor do artigo %s: %s", articleId, exc)

    await db.delete(article)
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
    if article.currentPhase != "eligibility":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Etapa inválida", "message": "O upload do PDF só é permitido na elegibilidade."},
        )

    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Tipo inválido", "message": "Apenas arquivos PDF são permitidos"},
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Arquivo muito grande", "message": "O tamanho máximo permitido é 10MB"},
        )

    article.pdfData = content
    article.pdfFilename = file.filename
    article.pdfContentType = file.content_type
    article.fullTextStatus = "uploaded"
    if article.reviewOutcome == "full_text_unavailable":
        article.reviewOutcome = "active"
        article.eligibilityDecision = "pending"
        article.eligibilityReasonText = None
        article.eligibilityReviewedAt = None

    _set_legacy_state_from_workflow(article)
    await db.commit()
    await db.refresh(article)
    return _build_article_response(article)


@router.get("/{projectId}/artigos/{articleId}/pdf")
async def get_pdf(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    if not article.pdfData:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "PDF não encontrado", "message": "Este artigo não possui PDF"},
        )

    return StreamingResponse(
        BytesIO(article.pdfData),
        media_type=article.pdfContentType,
        headers={"Content-Disposition": f'inline; filename="{article.pdfFilename or "artigo.pdf"}"'},
    )


@router.get("/{projectId}/artigos/{articleId}/download")
async def download_pdf(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    if not article.pdfData:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "PDF não encontrado", "message": "Este artigo não possui PDF"},
        )

    return StreamingResponse(
        BytesIO(article.pdfData),
        media_type=article.pdfContentType,
        headers={"Content-Disposition": f'attachment; filename="{article.pdfFilename or "artigo.pdf"}"'},
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
    return {"related_articles": [_build_article_response(related).model_dump() for related in article.relatedArticles]}


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
):
    project = await get_project_or_404(projectId, current_user.id, db)
    result = await db.execute(
        select(Article).where(Article.projectId == projectId, Article.ownerId == current_user.id)
    )
    all_articles = result.scalars().all()
    if not all_articles:
        return {"success": True, "message": "Nenhum artigo encontrado", "processed": 0}

    processed = 0
    for article in all_articles:
        if not article.abstract:
            continue
        if only_missing_embeddings and article.embedding is not None:
            continue
        await _evaluate_article_if_possible(article, project)
        processed += 1

    await db.commit()

    for article in all_articles:
        await _sync_article_indexes(article, db)

    return {
        "success": True,
        "message": f"Reprocessamento concluído: {processed} artigos",
        "processed": processed,
        "total": len(all_articles),
        "onlyMissingEmbeddings": only_missing_embeddings,
    }
