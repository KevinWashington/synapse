from sqlalchemy import case, cast, func, literal, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.project import Project
from app.models.synthesis import RQSynthesis
from app.services.evidence_service import QUALITY_RATING_ORDER, calculate_quality_metrics
from app.services.synthesis_identity_service import question_fingerprint


DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
QUALITY_ORDER = {rating: index for index, rating in enumerate(QUALITY_RATING_ORDER)}


def _included_clause():
    legacy = or_(Article.reviewOutcome.is_(None), Article.reviewOutcome == "")
    return or_(
        Article.reviewOutcome == "included",
        (legacy & (Article.manualDecision == "incluido")),
        (
            legacy
            & Article.manualDecision.not_in(("incluido", "excluido"))
            & (Article.status == "analisado")
        ),
    )


def _page_values(page: int, page_size: int) -> tuple[int, int]:
    safe_page = max(1, page)
    safe_page_size = min(MAX_PAGE_SIZE, max(1, page_size or DEFAULT_PAGE_SIZE))
    return safe_page, safe_page_size


def _page(items: list[dict], *, page: int, page_size: int, total: int) -> dict:
    return {"items": items, "page": page, "pageSize": page_size, "total": total}


def _excerpt(row) -> tuple[str | None, str]:
    for field, kind in (
        ("eligibilityReasonText", "selection_reason"),
        ("screeningReasonText", "selection_reason"),
        ("manualDecisionReason", "selection_reason"),
        ("aiEvaluation", "ai_evaluation"),
        ("notas", "reviewer_note"),
    ):
        value = (getattr(row, field, None) or "").strip()
        if value:
            return (value if len(value) <= 280 else value[:277] + "...", kind)
    return None, "none"


def _common_article_columns():
    # Keep this projection explicit: Article includes binary pdfData.
    return (
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
        Article.status,
        Article.answeringRQs,
        Article.eligibilityReasonText,
        Article.screeningReasonText,
        Article.manualDecisionReason,
        Article.aiEvaluation,
        Article.notas,
        Article.extractionData,
        Article.extractionCompletedAt,
        Article.qualityAssessmentAnswers,
        Article.qualityScore,
        Article.qualityRating,
    )


def _row_to_article(row):
    return row._mapping if hasattr(row, "_mapping") else row


def _article_payload(row, project: Project, *, include_all_values: bool = True) -> dict:
    data = dict(_row_to_article(row))
    excerpt, excerpt_kind = _excerpt(row)
    rq_count = len(project.researchQuestions or [])
    score, rating = calculate_quality_metrics(
        data.get("qualityAssessmentAnswers") or {}, project.qualityAssessmentSchema or []
    )
    return {
        "articleId": data["id"],
        "paperId": data.get("paperId"),
        "title": data.get("title"),
        "authors": data.get("authors"),
        "year": data.get("year"),
        "journal": data.get("journal"),
        "sourceName": data.get("sourceName"),
        "sourceCategory": data.get("sourceCategory"),
        "decision": data.get("reviewOutcome") or data.get("manualDecision") or data.get("status") or "-",
        "rqNumbers": sorted({number for number in (data.get("answeringRQs") or []) if 1 <= number <= rq_count}),
        "evidenceExcerpt": excerpt,
        "excerptKind": excerpt_kind,
        "extractionValues": data.get("extractionData") or {} if include_all_values else {},
        "extractionCompleted": data.get("extractionCompletedAt") is not None,
        "qualityScore": score,
        "qualityRating": rating,
        "qualityAnswers": data.get("qualityAssessmentAnswers") or {},
    }


def _filters_clause(project: Project, filters: dict | None, *, rq_number: int | None = None):
    filters = filters or {}
    clauses = [_included_clause(), Article.projectId == project.id]
    if rq_number is not None:
        clauses.append(Article.answeringRQs.any(rq_number))
    elif filters.get("rqNumber"):
        clauses.append(Article.answeringRQs.any(int(filters["rqNumber"])))

    search = (filters.get("search") or "").strip()
    if search:
        pattern = f"%{search}%"
        clauses.append(
            or_(
                Article.title.ilike(pattern),
                Article.authors.ilike(pattern),
                Article.paperId.ilike(pattern),
                cast(Article.extractionData, String).ilike(pattern),
            )
        )
    if filters.get("yearFrom") is not None:
        clauses.append(Article.year >= int(filters["yearFrom"]))
    if filters.get("yearTo") is not None:
        clauses.append(Article.year <= int(filters["yearTo"]))
    if filters.get("source"):
        clauses.append(Article.sourceName == filters["source"])
    if filters.get("completion") == "complete":
        clauses.append(Article.extractionCompletedAt.is_not(None))
    elif filters.get("completion") == "partial":
        clauses.extend(
            [
                Article.extractionCompletedAt.is_(None),
                Article.extractionData.is_not(None),
                cast(Article.extractionData, String) != "{}",
            ]
        )
    elif filters.get("completion") == "empty":
        clauses.append(Article.extractionCompletedAt.is_(None))
        clauses.append(or_(Article.extractionData.is_(None), cast(Article.extractionData, String) == "{}"))
    if filters.get("criterionKey"):
        clauses.append(Article.qualityAssessmentAnswers[filters["criterionKey"]].as_string().is_not(None))
    if filters.get("qualityRating"):
        clauses.append(_quality_rating_expression(project) == filters["qualityRating"])
    return clauses


def _quality_rating_expression(project: Project):
    score_sum = literal(0.0)
    denominator = literal(0)
    for criterion in project.qualityAssessmentSchema or []:
        key = criterion.get("key")
        if not key:
            continue
        answer = func.lower(func.trim(Article.qualityAssessmentAnswers[key].as_string()))
        score_sum += case(
            (answer == "yes", 1.0),
            (answer == "partial", 0.5),
            else_=0.0,
        )
        denominator += case((answer.in_(("yes", "partial", "no")), 1), else_=0)
    percentage = 100.0 * score_sum / func.nullif(denominator, 0)
    return case(
        (denominator == 0, "unrated"),
        (percentage >= 75, "high"),
        (percentage >= 50, "medium"),
        else_="low",
    )


async def _count(db: AsyncSession, project: Project, filters: dict | None = None, *, rq_number: int | None = None) -> int:
    return int(
        await db.scalar(
            select(func.count(Article.id)).where(*_filters_clause(project, filters, rq_number=rq_number))
        )
        or 0
    )


async def get_overview(db: AsyncSession, project: Project) -> dict:
    included = _included_clause()
    base = [Article.projectId == project.id, included]
    total = await db.scalar(select(func.count(Article.id)).where(*base)) or 0
    extracted = await db.scalar(
        select(func.count(Article.id)).where(*base, Article.extractionCompletedAt.is_not(None))
    ) or 0
    quality_assessed = await db.scalar(
        select(func.count(Article.id)).where(
            *base,
            Article.qualityAssessmentAnswers.is_not(None),
            cast(Article.qualityAssessmentAnswers, String) != "{}",
        )
    ) or 0
    rq_count = len(project.researchQuestions or [])
    covered = 0
    for rq_number in range(1, rq_count + 1):
        if await _count(db, project, rq_number=rq_number):
            covered += 1
    return {
        "includedCount": int(total),
        "extractedCount": int(extracted),
        "coveredRQCount": covered,
        "qualityAssessedCount": int(quality_assessed),
        "researchQuestionCount": rq_count,
    }


async def list_rqs(
    db: AsyncSession,
    project: Project,
    *,
    search: str | None = None,
    state: str | None = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict:
    page, page_size = _page_values(page, page_size)
    questions = project.researchQuestions or []
    drafts_result = await db.execute(
        select(RQSynthesis).where(RQSynthesis.projectId == project.id, RQSynthesis.rqNumber.is_not(None))
    )
    drafts_by_position = {draft.rqNumber: draft for draft in drafts_result.scalars()}
    candidates = []
    for rq_number, question in enumerate(questions, start=1):
        if search and search.casefold() not in question.casefold():
            continue
        draft = drafts_by_position.get(rq_number)
        stale_candidate = bool(draft and draft.questionFingerprint != question_fingerprint(question))
        draft_state = "not_started" if draft is None else "stale" if stale_candidate else "draft"
        if state and state != "all" and state != draft_state:
            continue
        candidates.append({
            "rqNumber": rq_number,
            "question": question,
            "evidenceCount": await _count(db, project, rq_number=rq_number),
            "draftState": draft_state,
            "duplicateQuestion": sum(
                1 for existing in questions if question_fingerprint(existing) == question_fingerprint(question)
            ) > 1,
        })
    start = (page - 1) * page_size
    return _page(candidates[start : start + page_size], page=page, page_size=page_size, total=len(candidates))


async def get_rq_detail(db: AsyncSession, project: Project, rq_number: int) -> dict | None:
    questions = project.researchQuestions or []
    if rq_number < 1 or rq_number > len(questions):
        return None
    question = questions[rq_number - 1]
    draft = await db.scalar(
        select(RQSynthesis).where(
            RQSynthesis.projectId == project.id,
            RQSynthesis.rqNumber == rq_number,
        )
    )
    evidence_count = await _count(db, project, rq_number=rq_number)
    total_included = await _count(db, project)
    return {
        "rqNumber": rq_number,
        "question": question,
        "questionFingerprint": question_fingerprint(question),
        "draft": None if draft is None else {
            "content": draft.content,
            "version": draft.version,
            "questionSnapshot": draft.questionSnapshot,
            "questionFingerprint": draft.questionFingerprint,
            "evidenceFingerprint": draft.evidenceFingerprint,
            "sourceArticleIds": draft.sourceArticleIds,
            "modelName": draft.modelName,
            "generatedAt": draft.generatedAt,
            "updatedAt": draft.updatedAt,
            "updatedByUserId": draft.updatedByUserId,
            "staleCandidate": draft.questionFingerprint != question_fingerprint(question),
        },
        "context": {
            "evidenceCount": evidence_count,
            "includedCount": total_included,
            "coverage": round(100 * evidence_count / total_included, 2) if total_included else 0,
            "quality": await _quality_summary(db, project, rq_number=rq_number),
            "freshness": "stale" if draft and draft.questionFingerprint != question_fingerprint(question) else "current",
        },
    }


async def _list_article_page(db, project, filters, *, page, page_size, rq_number=None, order="title", columns=None):
    page, page_size = _page_values(page, page_size)
    clauses = _filters_clause(project, filters, rq_number=rq_number)
    total = await db.scalar(select(func.count(Article.id)).where(*clauses)) or 0
    statement = select(*_common_article_columns()).where(*clauses)
    if order == "quality":
        statement = statement.order_by(
            case(
                (_quality_rating_expression(project) == "high", 0),
                (_quality_rating_expression(project) == "medium", 1),
                (_quality_rating_expression(project) == "low", 2),
                else_=3,
            ),
            Article.title,
            Article.id,
        )
    else:
        statement = statement.order_by(Article.title, Article.id)
    rows = (await db.execute(statement.offset((page - 1) * page_size).limit(page_size))).all()
    items = [_article_payload(row, project) for row in rows]
    if columns is not None:
        fields = {field.get("key") for field in (project.dataExtractionSchema or [])}
        allowed = {"articleId", "paperId", "title", "year", "journal", "sourceName", "sourceCategory", "decision", "rqNumbers", "qualityRating", "qualityScore", "extractionCompleted", *fields}
        selected = [column for column in columns if column in allowed]
        items = [
            {
                **{key: value for key, value in item.items() if key in selected},
                **{key: (item["extractionValues"].get(key)) for key in selected if key in fields},
            }
            for item in items
        ]
    return _page(items, page=page, page_size=page_size, total=int(total))


async def list_evidence(db: AsyncSession, project: Project, rq_number: int, filters: dict, *, page: int, page_size: int, order: str = "quality") -> dict:
    if rq_number < 1 or rq_number > len(project.researchQuestions or []):
        return _page([], page=max(1, page), page_size=min(MAX_PAGE_SIZE, max(1, page_size)), total=0)
    return await _list_article_page(
        db, project, filters, rq_number=rq_number, page=page, page_size=page_size, order=order
    )


async def list_matrix(db: AsyncSession, project: Project, filters: dict, *, page: int, page_size: int, columns: list[str] | None = None) -> dict:
    return await _list_article_page(
        db, project, filters, page=page, page_size=page_size, order="title", columns=columns
    )


async def get_matrix_article(db: AsyncSession, project: Project, article_id: int) -> dict | None:
    row = await db.execute(
        select(*_common_article_columns()).where(
            Article.id == article_id,
            Article.projectId == project.id,
            _included_clause(),
        )
    )
    article = row.first()
    return _article_payload(article, project) if article else None


async def get_chart_catalog(db: AsyncSession, project: Project, filters: dict | None = None) -> list[dict]:
    del db, filters
    catalog = [{"key": "year", "label": "Ano de publicação", "type": "number", "group": "general"}]
    catalog.extend(
        {"key": f"rq:{number}", "label": question, "type": "rq", "group": f"RQ {number}", "rqNumber": number}
        for number, question in enumerate(project.researchQuestions or [], start=1)
    )
    catalog.extend(
        {
            "key": field.get("key"),
            "label": field.get("label") or field.get("key"),
            "type": field.get("type") or "text",
            "group": "Campos extraídos",
        }
        for field in project.dataExtractionSchema or []
        if field.get("key")
    )
    return catalog


async def get_chart(db: AsyncSession, project: Project, chart_key: str, filters: dict, *, page: int, page_size: int) -> dict:
    field = next(
        (field for field in (project.dataExtractionSchema or []) if field.get("key") == chart_key),
        None,
    )
    if chart_key.startswith("rq:"):
        rq_number = int(chart_key.split(":", 1)[1])
        question = (project.researchQuestions or [])[rq_number - 1] if 1 <= rq_number <= len(project.researchQuestions or []) else ""
        field = next((item for item in (project.dataExtractionSchema or []) if item.get("key") == f"rq_{rq_number}"), None)
        if not field:
            return {"key": chart_key, "question": question, "field": None, "type": "not_available", "sampleSize": 0, "missingCount": 0, "rows": []}
        filters = {**(filters or {}), "rqNumber": rq_number}
        chart_key = field["key"]
    if chart_key == "year":
        counts = await db.execute(
            select(Article.year, func.count(Article.id))
            .where(*_filters_clause(project, filters))
            .group_by(Article.year)
            .order_by(Article.year)
        )
        rows = [{"value": year, "count": count} for year, count in counts]
        return {"key": chart_key, "field": {"key": "year", "label": "Ano", "type": "number"}, "sampleSize": sum(row["count"] for row in rows), "missingCount": 0, "rows": rows}
    if not field:
        raise ValueError("Unknown synthesis chart field")
    clauses = _filters_clause(project, filters)
    value = Article.extractionData[chart_key].as_string()
    total = await db.scalar(select(func.count(Article.id)).where(*clauses)) or 0
    nonempty = await db.scalar(select(func.count(Article.id)).where(*clauses, value.is_not(None), value != "")) or 0
    if field.get("type") == "text":
        page, page_size = _page_values(page, page_size)
        rows_result = await db.execute(
            select(Article.id, Article.title, Article.year, value.label("value"))
            .where(*clauses, value.is_not(None), value != "")
            .order_by(Article.title, Article.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = [{"articleId": row.id, "title": row.title, "year": row.year, "value": row.value} for row in rows_result]
        return {"key": chart_key, "field": field, "sampleSize": int(total), "missingCount": int(total - nonempty), "rows": _page(rows, page=page, page_size=page_size, total=int(nonempty))}
    grouped_values = (
        select(value.label("value"), func.count(Article.id).label("count"))
        .where(*clauses, value.is_not(None), value != "")
        .group_by(value)
        .subquery()
    )
    top_rows = list(
        await db.execute(
            select(grouped_values.c.value, grouped_values.c.count)
            .order_by(grouped_values.c.count.desc(), grouped_values.c.value)
            .limit(12)
        )
    )
    category_count = int(await db.scalar(select(func.count()).select_from(grouped_values)) or 0)
    rows = [{"value": row.value, "count": row.count} for row in top_rows]
    if category_count > 12:
        total_category_count = int(await db.scalar(select(func.sum(grouped_values.c.count))) or 0)
        shown_count = sum(row.count for row in top_rows)
        rows.append({"value": "Outros", "count": total_category_count - shown_count})
    return {"key": chart_key, "field": field, "sampleSize": int(total), "missingCount": int(total - nonempty), "rows": rows}


async def _quality_summary(db, project: Project, *, rq_number: int | None = None, filters: dict | None = None) -> dict:
    clauses = _filters_clause(project, filters or {}, rq_number=rq_number)
    counts = {rating: 0 for rating in QUALITY_RATING_ORDER}
    rating = _quality_rating_expression(project)
    result = await db.execute(
        select(rating, func.count(Article.id)).where(*clauses).group_by(rating)
    )
    for label, count in result:
        counts[label] = int(count)
    return {"counts": counts, "total": sum(counts.values())}


async def get_quality_criteria(db: AsyncSession, project: Project, filters: dict | None = None) -> list[dict]:
    clauses = _filters_clause(project, filters)
    total = await db.scalar(select(func.count(Article.id)).where(*clauses)) or 0
    criteria = [{"key": "overall", "label": "Avaliação geral", "kind": "overall"}]
    criteria.extend(
        {"key": item.get("key"), "label": item.get("label") or item.get("key"), "kind": "criterion"}
        for item in project.qualityAssessmentSchema or []
        if item.get("key")
    )
    output = []
    for criterion in criteria:
        if criterion["kind"] == "overall":
            distribution = await _quality_summary(db, project, filters=filters)
            output.append({**criterion, "total": int(total), "distribution": distribution["counts"]})
            continue
        value = Article.qualityAssessmentAnswers[criterion["key"]].as_string()
        result = await db.execute(
            select(value, func.count(Article.id))
            .where(*clauses, value.is_not(None))
            .group_by(value)
        )
        output.append({
            **criterion,
            "total": int(total),
            "distribution": {answer: int(count) for answer, count in result},
        })
    return output


async def list_quality_studies(db: AsyncSession, project: Project, criterion_key: str, filters: dict, *, page: int, page_size: int) -> dict:
    scoped_filters = {**(filters or {})}
    if criterion_key != "overall":
        scoped_filters["criterionKey"] = criterion_key
    return await _list_article_page(db, project, scoped_filters, page=page, page_size=page_size, order="quality")


async def get_quality_study(db: AsyncSession, project: Project, article_id: int) -> dict | None:
    return await get_matrix_article(db, project, article_id)
