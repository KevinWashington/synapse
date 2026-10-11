"""Article report responsibilities independent of HTTP routing."""

from __future__ import annotations

import csv
from io import StringIO

from app.models.article import Article
from app.models.project import Project
from app.schemas.article import (
    SelectionReportCounts,
    SelectionReportResponse,
    SelectionSummaryPhaseItem,
    SelectionSummaryResponse,
)
from app.services.evidence_service import (
    QUALITY_RATING_ORDER,
    calculate_quality_metrics,
    normalize_quality_response,
)


def is_included_for_synthesis(article: Article) -> bool:
    review_outcome = getattr(article, "reviewOutcome", None)
    if review_outcome:
        return review_outcome == "included"

    if getattr(article, "manualDecision", None) == "incluido":
        return True
    if getattr(article, "manualDecision", None) == "excluido":
        return False
    return getattr(article, "status", None) == "analisado"


def build_evidence_excerpt(article: Article) -> str | None:
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


def linked_rqs_for_article(article: Article, rq_count: int) -> list[int]:
    return sorted(
        {rq for rq in (getattr(article, "answeringRQs", None) or []) if 1 <= rq <= rq_count}
    )


def decision_label_for_article(article: Article) -> str:
    if getattr(article, "reviewOutcome", None):
        return article.reviewOutcome
    return getattr(article, "manualDecision", None) or getattr(article, "status", None) or "-"


def build_rq_synthesis_payload(
    research_questions: list[str], included_articles: list[Article]
) -> dict:
    rq_count = len(research_questions)
    rq_to_articles: dict[int, list[Article]] = {index: [] for index in range(1, rq_count + 1)}
    included_without_rq: list[Article] = []

    for article in included_articles:
        linked_rqs = linked_rqs_for_article(article, rq_count)
        if not linked_rqs:
            included_without_rq.append(article)
            continue
        for rq in linked_rqs:
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
                        "authors": getattr(article, "authors", None),
                        "year": getattr(article, "year", None),
                        "status": getattr(article, "status", None),
                        "manualDecision": getattr(article, "manualDecision", None),
                        "reason": getattr(article, "eligibilityReasonText", None)
                        or getattr(article, "manualDecisionReason", None),
                        "evidenceExcerpt": build_evidence_excerpt(article),
                    }
                    for article in rq_articles
                ],
            }
        )

    matrix = []
    for article in included_articles:
        matrix.append(
            {
                "articleId": article.id,
                "paperId": getattr(article, "paperId", None),
                "title": getattr(article, "title", None),
                "year": getattr(article, "year", None),
                "decision": decision_label_for_article(article),
                "rqs": linked_rqs_for_article(article, rq_count),
            }
        )

    answered_rqs = sum(1 for index in range(1, rq_count + 1) if rq_to_articles.get(index))
    coverage_percentage = round((answered_rqs / rq_count) * 100, 2) if rq_count else 0

    return {
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
                "paperId": getattr(article, "paperId", None),
                "title": getattr(article, "title", None),
                "year": getattr(article, "year", None),
                "status": getattr(article, "status", None),
                "manualDecision": getattr(article, "manualDecision", None),
            }
            for article in included_without_rq
        ],
    }


def build_distribution_rows(
    counts: dict[str, int],
    *,
    denominator: int,
    order: list[str] | tuple[str, ...] | None = None,
) -> list[dict]:
    keys = list(order) if order else sorted(counts.keys())
    rows = []
    for key in keys:
        count = counts.get(key, 0)
        if count == 0 and not order:
            continue
        percentage = round((count / denominator) * 100, 2) if denominator else 0
        rows.append(
            {
                "value": key,
                "count": count,
                "percentage": percentage,
            }
        )
    return rows


def stringify_distribution_value(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def select_visualization_field(extraction_schema: list[dict], rq_number: int) -> dict | None:
    rq_key = f"rq_{rq_number}"
    for field in extraction_schema:
        if field.get("key") == rq_key:
            return field

    fallback_index = rq_number - 1
    if 0 <= fallback_index < len(extraction_schema):
        return extraction_schema[fallback_index]
    return None


def visualization_type_for_field(field_type: str | None) -> str:
    if field_type == "number":
        return "bar_chart"
    if field_type == "boolean":
        return "category_bar_chart"
    if field_type == "single_select":
        return "category_bar_chart"
    if field_type == "multi_select":
        return "multi_category_bar_chart"
    if field_type == "text":
        return "qualitative_table"
    return "not_available"


def visualization_reason_for_field(field_type: str | None) -> str:
    reasons = {
        "number": "Campo numerico permite comparar valores extraidos entre estudos.",
        "boolean": "Campo booleano permite comparar a frequencia de respostas Sim e Nao.",
        "single_select": "Campo categorico permite comparar a frequencia de cada categoria extraida.",
        "multi_select": "Campo de selecao multipla permite contar a recorrencia de cada opcao nos estudos.",
        "text": "Campo textual deve ser apresentado como tabela qualitativa para preservar o contexto da resposta.",
    }
    return reasons.get(
        field_type or "", "Nao ha tipo de campo estruturado para sugerir uma visualizacao."
    )


def coerce_visualization_number(value) -> int | float | None:
    if value is None or value == "" or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        normalized = value.strip().replace(",", ".")
        if not normalized:
            return None
        try:
            number = float(normalized)
        except ValueError:
            return None
        return int(number) if number.is_integer() else number
    return None


def articles_for_visualization_rq(
    included_articles: list[Article],
    rq_number: int,
    rq_count: int,
) -> list[Article]:
    linked_articles = [
        article
        for article in included_articles
        if rq_number in linked_rqs_for_article(article, rq_count)
    ]
    return linked_articles or included_articles


def build_visualization_rows(field: dict, articles: list[Article], denominator: int) -> list[dict]:
    field_key = field.get("key")
    field_type = field.get("type") or "text"

    if not field_key:
        return []

    if field_type == "number":
        rows = []
        for article in articles:
            raw_value = (getattr(article, "extractionData", None) or {}).get(field_key)
            value = coerce_visualization_number(raw_value)
            if value is None:
                continue
            rows.append(
                {
                    "articleId": article.id,
                    "title": getattr(article, "title", None),
                    "year": getattr(article, "year", None),
                    "value": value,
                }
            )
        return rows

    if field_type in {"boolean", "single_select", "multi_select"}:
        counts: dict[str, int] = {}
        counted_values = 0
        for article in articles:
            raw_value = (getattr(article, "extractionData", None) or {}).get(field_key)
            values = (
                raw_value
                if field_type == "multi_select" and isinstance(raw_value, list)
                else [raw_value]
            )
            for item in values:
                normalized = stringify_distribution_value(item)
                if normalized is None or normalized == "":
                    continue
                counts[normalized] = counts.get(normalized, 0) + 1
                counted_values += 1

        return build_distribution_rows(counts, denominator=counted_values or denominator)

    if field_type == "text":
        rows = []
        for article in articles:
            raw_value = (getattr(article, "extractionData", None) or {}).get(field_key)
            value = str(raw_value or "").strip()
            if not value:
                continue
            rows.append(
                {
                    "articleId": article.id,
                    "title": getattr(article, "title", None),
                    "year": getattr(article, "year", None),
                    "value": value,
                }
            )
        return rows

    return []


def build_visualization_suggestions(
    research_questions: list[str],
    extraction_schema: list[dict],
    included_articles: list[Article],
) -> list[dict]:
    rq_count = len(research_questions)
    suggestions = []

    for rq_number, question in enumerate(research_questions, start=1):
        field = select_visualization_field(extraction_schema, rq_number)
        if not field:
            suggestions.append(
                {
                    "rqNumber": rq_number,
                    "question": question,
                    "field": None,
                    "visualizationType": "not_available",
                    "status": "missing_field",
                    "reason": "Nenhum campo de extracao foi configurado para esta pergunta.",
                    "rows": [],
                }
            )
            continue

        field_type = field.get("type") or "text"
        candidate_articles = articles_for_visualization_rq(included_articles, rq_number, rq_count)
        rows = build_visualization_rows(
            field, candidate_articles, denominator=len(candidate_articles)
        )
        suggestions.append(
            {
                "rqNumber": rq_number,
                "question": question,
                "field": {
                    "key": field.get("key"),
                    "label": field.get("label") or field.get("key"),
                    "type": field_type,
                },
                "visualizationType": visualization_type_for_field(field_type),
                "status": "ready" if rows else "needs_data",
                "reason": visualization_reason_for_field(field_type),
                "rows": rows,
            }
        )

    return suggestions


def build_synthesis_report(project: Project, articles: list[Article]) -> dict:
    research_questions = project.researchQuestions or []
    extraction_schema = project.dataExtractionSchema or []
    quality_schema = project.qualityAssessmentSchema or []
    included_articles = [article for article in articles if is_included_for_synthesis(article)]

    rq_payload = build_rq_synthesis_payload(research_questions, included_articles)

    extraction_rows = []
    distribution_charts = []

    year_counts: dict[str, int] = {}
    quality_rating_counts = {rating: 0 for rating in QUALITY_RATING_ORDER}
    quality_summary_articles = []

    for article in included_articles:
        quality_score, quality_rating = calculate_quality_metrics(
            getattr(article, "qualityAssessmentAnswers", None) or {},
            quality_schema,
        )
        quality_summary_articles.append(
            {
                "articleId": article.id,
                "score": quality_score,
                "rating": quality_rating,
                "answers": getattr(article, "qualityAssessmentAnswers", None) or {},
            }
        )
        quality_rating_counts[quality_rating] = quality_rating_counts.get(quality_rating, 0) + 1

        year_value = getattr(article, "year", None)
        if year_value is not None:
            year_key = str(year_value)
            year_counts[year_key] = year_counts.get(year_key, 0) + 1

        extraction_values = {}
        article_extraction_data = getattr(article, "extractionData", None) or {}
        for field in extraction_schema:
            extraction_values[field["key"]] = article_extraction_data.get(field["key"])

        extraction_rows.append(
            {
                "articleId": article.id,
                "paperId": getattr(article, "paperId", None),
                "title": getattr(article, "title", None),
                "year": getattr(article, "year", None),
                "sourceName": getattr(article, "sourceName", None),
                "rqs": linked_rqs_for_article(article, len(research_questions)),
                "qualityScore": quality_score,
                "qualityRating": quality_rating,
                "values": extraction_values,
            }
        )

    if included_articles:
        distribution_charts.append(
            {
                "key": "year",
                "label": "Publication Year",
                "rows": build_distribution_rows(year_counts, denominator=len(included_articles)),
            }
        )
        distribution_charts.append(
            {
                "key": "qualityRating",
                "label": "Quality Rating",
                "rows": build_distribution_rows(
                    quality_rating_counts,
                    denominator=len(included_articles),
                    order=QUALITY_RATING_ORDER,
                ),
            }
        )

    for field in extraction_schema:
        if field.get("type") not in {"single_select", "multi_select", "boolean"}:
            continue

        field_counts: dict[str, int] = {}
        denominator = 0
        field_key = field["key"]

        for article in included_articles:
            raw_value = (getattr(article, "extractionData", None) or {}).get(field_key)
            if field.get("type") == "multi_select":
                values = raw_value if isinstance(raw_value, list) else []
                if not values:
                    continue
                for item in values:
                    normalized = stringify_distribution_value(item)
                    if not normalized:
                        continue
                    field_counts[normalized] = field_counts.get(normalized, 0) + 1
                    denominator += 1
                continue

            normalized = stringify_distribution_value(raw_value)
            if normalized is None or normalized == "":
                continue
            field_counts[normalized] = field_counts.get(normalized, 0) + 1
            denominator += 1

        if not field_counts:
            continue

        distribution_charts.append(
            {
                "key": field_key,
                "label": field.get("label") or field_key,
                "rows": build_distribution_rows(field_counts, denominator=denominator),
            }
        )

    rated_scores = [item["score"] for item in quality_summary_articles if item["score"] is not None]
    by_criterion = []
    for criterion in quality_schema:
        criterion_counts = {value: 0 for value in ("yes", "partial", "no", "na")}
        answered_count = 0
        for article_info in quality_summary_articles:
            response = normalize_quality_response(article_info["answers"].get(criterion["key"]))
            if response is None:
                continue
            criterion_counts[response] += 1
            answered_count += 1

        by_criterion.append(
            {
                "key": criterion["key"],
                "label": criterion["label"],
                "rows": build_distribution_rows(
                    criterion_counts,
                    denominator=answered_count,
                    order=("yes", "partial", "no", "na"),
                ),
            }
        )

    return {
        "projectId": project.id,
        "projectTitle": project.title,
        **rq_payload,
        "extractionColumns": extraction_schema,
        "extractionRows": extraction_rows,
        "distributionCharts": distribution_charts,
        "visualizationSuggestions": build_visualization_suggestions(
            research_questions,
            extraction_schema,
            included_articles,
        ),
        "qualitySummary": {
            "ratedArticles": len(rated_scores),
            "unratedArticles": max(len(included_articles) - len(rated_scores), 0),
            "averageScore": round(sum(rated_scores) / len(rated_scores), 2)
            if rated_scores
            else None,
            "byRating": build_distribution_rows(
                quality_rating_counts,
                denominator=len(included_articles),
                order=QUALITY_RATING_ORDER,
            ),
            "byCriterion": by_criterion,
        },
    }


def format_source_breakdown(rows: list[Article]) -> list[dict]:
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
        elif article.reviewOutcome in {
            "excluded_screening",
            "excluded_eligibility",
            "full_text_unavailable",
        }:
            item["excluded"] += 1
    return sorted(by_source.values(), key=lambda item: (item["sourceCategory"], item["sourceName"]))


def selection_summary_from_articles(
    project_id: int, articles: list[Article]
) -> SelectionSummaryResponse:
    identification_total = len(articles)
    identification_active = sum(
        1
        for article in articles
        if article.currentPhase == "identification" and article.reviewOutcome == "active"
    )
    duplicates_removed = sum(
        1 for article in articles if article.reviewOutcome == "duplicate_removed"
    )

    screening_total = sum(
        1
        for article in articles
        if article.currentPhase in {"screening", "eligibility", "included"}
        or article.reviewOutcome
        in {"excluded_screening", "excluded_eligibility", "full_text_unavailable", "included"}
    )
    screening_active = sum(
        1
        for article in articles
        if article.currentPhase == "screening" and article.reviewOutcome == "active"
    )
    screening_excluded = sum(
        1 for article in articles if article.reviewOutcome == "excluded_screening"
    )

    eligibility_total = sum(
        1
        for article in articles
        if article.currentPhase in {"eligibility", "included"}
        or article.reviewOutcome in {"excluded_eligibility", "full_text_unavailable", "included"}
    )
    eligibility_active = sum(
        1
        for article in articles
        if article.currentPhase == "eligibility" and article.reviewOutcome == "active"
    )
    eligibility_excluded = sum(
        1
        for article in articles
        if article.reviewOutcome in {"excluded_eligibility", "full_text_unavailable"}
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
        pendingExtraction=sum(
            1
            for article in articles
            if article.reviewOutcome == "included"
            and getattr(article, "extractionCompletedAt", None) is None
        ),
        duplicatesRemoved=duplicates_removed,
        greyLiterature=sum(
            1 for article in articles if article.sourceCategory == "grey_literature"
        ),
        fullTextUnavailable=sum(
            1 for article in articles if article.reviewOutcome == "full_text_unavailable"
        ),
        bySource=format_source_breakdown(articles),
    )


def build_selection_report(project: Project, articles: list[Article]) -> SelectionReportResponse:
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
            exclusion_reason_map["eligibility"][reason] = (
                exclusion_reason_map["eligibility"].get(reason, 0) + 1
            )

    exclusion_reasons = {
        key: [
            {"reason": reason, "count": count}
            for reason, count in sorted(values.items(), key=lambda item: (-item[1], item[0]))
        ]
        for key, values in exclusion_reason_map.items()
    }

    screening_pool = sum(
        1
        for article in articles
        if article.currentPhase in {"screening", "eligibility", "included"}
        or article.reviewOutcome == "excluded_screening"
    )
    eligibility_pool = sum(
        1
        for article in articles
        if article.currentPhase in {"eligibility", "included"}
        or article.reviewOutcome in {"excluded_eligibility", "full_text_unavailable"}
    )

    return SelectionReportResponse(
        projectId=project.id,
        projectTitle=project.title,
        counts=SelectionReportCounts(
            identified=len(articles),
            duplicatesRemoved=sum(
                1 for article in articles if article.reviewOutcome == "duplicate_removed"
            ),
            screeningPool=screening_pool,
            excludedScreening=sum(
                1 for article in articles if article.reviewOutcome == "excluded_screening"
            ),
            eligibilityPool=eligibility_pool,
            fullTextUnavailable=sum(
                1 for article in articles if article.reviewOutcome == "full_text_unavailable"
            ),
            excludedEligibility=sum(
                1 for article in articles if article.reviewOutcome == "excluded_eligibility"
            ),
            included=sum(1 for article in articles if article.reviewOutcome == "included"),
        ),
        bySource=format_source_breakdown(articles),
        exclusionReasons=exclusion_reasons,
        greyLiteratureCount=sum(
            1 for article in articles if article.sourceCategory == "grey_literature"
        ),
    )


def build_report_csv(report: SelectionReportResponse) -> str:
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
    writer.writerow(
        ["source_category", "source_name", "total", "included", "duplicates_removed", "excluded"]
    )
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
