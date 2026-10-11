"""Article import responsibilities independent of HTTP routing."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re

from app.models.article import Article
from app.models.project import Project
from app.services.ai_service import AIService
from app.services.review_workflow_service import apply_legacy_review_state

_INVALID_ANCHOR_CHARS = re.compile(r"[^a-z0-9]+")
logger = logging.getLogger(__name__)


def normalize_paper_id(paper_id: str | None) -> str | None:
    if not paper_id:
        return None
    normalized = _INVALID_ANCHOR_CHARS.sub("-", paper_id.strip().lower()).strip("-")
    return normalized or None


def generate_paper_id(doi: str | None, title: str | None, year: int | None) -> str:
    doi_normalized = normalize_paper_id(doi)
    if doi_normalized:
        return doi_normalized[:120]

    title_base = normalize_paper_id(title or "paper") or "paper"
    year_base = str(year) if year is not None else "unknown"
    digest = hashlib.sha1(f"{title_base}|{year_base}".encode("utf-8")).hexdigest()[:10]
    suffix = f"-{year_base}-{digest}"
    return f"{title_base[: 120 - len(suffix)]}{suffix}"


def resolve_paper_id(
    *,
    provided: str | None,
    doi: str | None,
    title: str | None,
    year: int | None,
) -> str:
    normalized = normalize_paper_id(provided)
    if normalized:
        return normalized
    return generate_paper_id(doi=doi, title=title, year=year)


def build_project_ai_context(project: Project) -> dict[str, list[str]]:
    return {
        "criteriosInclusao": project.criteriosInclusao or [],
        "criteriosExclusao": project.criteriosExclusao or [],
        "researchQuestions": project.researchQuestions or [],
    }


def apply_ai_evaluation(article: Article, eval_result: dict) -> None:
    article.aiEvaluation = eval_result.get("justification")
    article.aiSuggestedStatus = eval_result.get("suggestedStatus")
    article.aiRelevanceScore = eval_result.get("relevanceScore")
    article.aiSuggestedRQs = eval_result.get("suggestedRQs", [])
    article.aiMethodology = eval_result.get("methodology")
    article.aiDatabase = eval_result.get("database")
    article.aiDomain = eval_result.get("domain")
    article.aiKeywords = eval_result.get("keywords", [])


def create_article_entity(
    *,
    payload,
    project_id: int,
    owner_id: int,
    entry_method: str,
    source_category: str,
    source_name: str,
    import_batch_label: str | None,
    study_type: str | None = None,
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
        studyType=study_type if study_type is not None else getattr(payload, "studyType", None),
        currentPhase="identification",
        reviewOutcome="active",
        screeningDecision="pending",
        fullTextStatus="not_requested",
        eligibilityDecision="pending",
    )
    article.paperId = resolve_paper_id(
        provided=getattr(payload, "paperId", None),
        doi=article.doi,
        title=article.title,
        year=article.year,
    )
    apply_legacy_review_state(article)
    return article


async def evaluate_article_if_possible(
    article: Article, project: Project, ai_service: AIService | None
) -> None:
    if not article.abstract:
        return

    try:
        if ai_service is not None:
            eval_result = await ai_service.evaluate_article(
                {"title": article.title, "abstract": article.abstract},
                build_project_ai_context(project),
            )
            apply_ai_evaluation(article, eval_result)
    except Exception:  # pragma: no cover - external service
        logger.exception("Erro ao avaliar artigo %s com IA", article.title)

    try:
        from app.services.embedding_service import get_embedding_service

        embedding_service = get_embedding_service()
        embedding = await asyncio.to_thread(embedding_service.generate_embedding, article.abstract)
        if embedding:
            article._embedding_cache = embedding
    except Exception:  # pragma: no cover - external service
        logger.exception("Erro ao gerar embedding do artigo %s", article.title)


async def import_bibtex_articles(
    db, *, access, request, actor_user_id, ai_service=None, evaluate_ai=True
):
    from datetime import datetime, timezone

    from app.schemas.article import ImportBibTeXResponse
    from app.services.project_access_service import CAP_EDIT_PROJECT, require_capability

    require_capability(access, CAP_EDIT_PROJECT)
    batch_label = (
        request.importBatchLabel or f"bibtex-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    )
    article_ids = []
    for entry in request.entries:
        article = create_article_entity(
            payload=entry,
            project_id=access.project.id,
            owner_id=actor_user_id,
            entry_method="bibtex",
            source_category=request.sourceCategory,
            source_name=request.sourceName,
            import_batch_label=batch_label,
            study_type=request.studyType,
        )
        if evaluate_ai:
            await evaluate_article_if_possible(article, access.project, ai_service)
        db.add(article)
        await db.flush()
        article_ids.append(article.id)
    return ImportBibTeXResponse(
        projectId=access.project.id,
        importedCount=len(article_ids),
        batchLabel=batch_label,
        articleIds=article_ids,
    )
