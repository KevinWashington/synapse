from __future__ import annotations

import re
from typing import Any


EXTRACTION_FIELD_TYPES = {"text", "number", "single_select", "multi_select", "boolean"}
QUALITY_RESPONSE_VALUES = ("yes", "partial", "no", "na")
QUALITY_RESPONSE_SCORES = {
    "yes": 1.0,
    "partial": 0.5,
    "no": 0.0,
}
QUALITY_RATING_ORDER = ("high", "medium", "low", "unrated")
MAX_SCHEMA_KEY_LENGTH = 80

_INVALID_SCHEMA_KEY = re.compile(r"[^a-z0-9]+")


def _truncate_schema_key(value: str, limit: int = MAX_SCHEMA_KEY_LENGTH) -> str:
    return value[:limit].rstrip("_")


def _normalize_schema_key(value: str | None, *, prefix: str) -> str:
    candidate = _INVALID_SCHEMA_KEY.sub("_", (value or "").strip().lower()).strip("_")
    return _truncate_schema_key(candidate or prefix)


def _ensure_unique_key(base_key: str, seen: set[str]) -> str:
    base_key = _truncate_schema_key(base_key) or "field"
    if base_key not in seen:
        seen.add(base_key)
        return base_key

    suffix = 2
    while True:
        suffix_text = f"_{suffix}"
        candidate_base = _truncate_schema_key(base_key, MAX_SCHEMA_KEY_LENGTH - len(suffix_text))
        unique_key = f"{candidate_base}{suffix_text}"
        if unique_key not in seen:
            break
        suffix += 1

    seen.add(unique_key)
    return unique_key


def _coerce_options(raw_options: Any) -> list[str]:
    if isinstance(raw_options, str):
        raw_items = raw_options.split(",")
    elif isinstance(raw_options, (list, tuple, set)):
        raw_items = list(raw_options)
    else:
        raw_items = []

    seen: set[str] = set()
    options: list[str] = []
    for item in raw_items:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        options.append(value)
    return options


def sanitize_data_extraction_schema(items: Any) -> list[dict[str, Any]]:
    sanitized: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    if not isinstance(items, list):
        return sanitized

    for item in items:
        payload = item.model_dump() if hasattr(item, "model_dump") else item
        if not isinstance(payload, dict):
            continue

        label = str(payload.get("label") or "").strip()
        if not label:
            continue

        field_type = str(payload.get("type") or "text").strip().lower()
        if field_type not in EXTRACTION_FIELD_TYPES:
            field_type = "text"

        key = _ensure_unique_key(
            _normalize_schema_key(str(payload.get("key") or label), prefix="field"),
            seen_keys,
        )
        options = _coerce_options(payload.get("options")) if field_type in {"single_select", "multi_select"} else []

        sanitized.append(
            {
                "key": key,
                "label": label,
                "type": field_type,
                "options": options,
            }
        )

    return sanitized


def sanitize_quality_assessment_schema(items: Any) -> list[dict[str, Any]]:
    sanitized: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    if not isinstance(items, list):
        return sanitized

    for item in items:
        payload = item.model_dump() if hasattr(item, "model_dump") else item
        if not isinstance(payload, dict):
            continue

        label = str(payload.get("label") or "").strip()
        if not label:
            continue

        key = _ensure_unique_key(
            _normalize_schema_key(str(payload.get("key") or label), prefix="criterion"),
            seen_keys,
        )
        sanitized.append(
            {
                "key": key,
                "label": label,
            }
        )

    return sanitized


def normalize_quality_response(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if normalized not in QUALITY_RESPONSE_VALUES:
        return None
    return normalized


def _coerce_boolean_value(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if value == 1:
            return True
        if value == 0:
            return False
        return None
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "sim"}:
            return True
        if normalized in {"false", "0", "no", "nao", "não"}:
            return False
    return None


def _coerce_number_value(value: Any) -> int | float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
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


def _coerce_multi_select_value(value: Any, options: list[str]) -> list[str] | None:
    if value is None:
        return None

    raw_items = list(value) if isinstance(value, (list, tuple, set)) else [value]
    seen: set[str] = set()
    values: list[str] = []
    for item in raw_items:
        normalized = str(item or "").strip()
        if not normalized:
            continue
        if options and normalized not in options:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        values.append(normalized)

    return values or None


def coerce_extraction_value(value: Any, field: dict[str, Any]) -> Any:
    field_type = field.get("type") or "text"
    options = field.get("options") or []

    if field_type == "number":
        return _coerce_number_value(value)

    if field_type == "boolean":
        return _coerce_boolean_value(value)

    if field_type == "single_select":
        normalized = str(value or "").strip()
        if not normalized:
            return None
        if options and normalized not in options:
            return None
        return normalized

    if field_type == "multi_select":
        return _coerce_multi_select_value(value, options)

    normalized = str(value or "").strip()
    return normalized or None


def merge_extraction_data(
    existing_data: dict[str, Any] | None,
    incoming_data: dict[str, Any] | None,
    schema: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    merged = dict(existing_data or {})
    payload = incoming_data or {}
    if not isinstance(payload, dict):
        return merged

    for field in schema or []:
        key = field.get("key")
        if not key or key not in payload:
            continue

        normalized = coerce_extraction_value(payload.get(key), field)
        if normalized is None:
            merged.pop(key, None)
        else:
            merged[key] = normalized

    return merged


def merge_quality_assessment_answers(
    existing_answers: dict[str, Any] | None,
    incoming_answers: dict[str, Any] | None,
    schema: list[dict[str, Any]] | None,
) -> dict[str, str]:
    merged = dict(existing_answers or {})
    payload = incoming_answers or {}
    if not isinstance(payload, dict):
        return {key: value for key, value in merged.items() if normalize_quality_response(value)}

    for criterion in schema or []:
        key = criterion.get("key")
        if not key or key not in payload:
            continue

        normalized = normalize_quality_response(payload.get(key))
        if normalized is None:
            merged.pop(key, None)
        else:
            merged[key] = normalized

    return {key: value for key, value in merged.items() if normalize_quality_response(value)}


def calculate_quality_metrics(
    answers: dict[str, Any] | None,
    schema: list[dict[str, Any]] | None,
) -> tuple[float | None, str]:
    normalized_answers = answers or {}
    score = 0.0
    denominator = 0

    for criterion in schema or []:
        response = normalize_quality_response(normalized_answers.get(criterion.get("key")))
        if response is None or response == "na":
            continue

        denominator += 1
        score += QUALITY_RESPONSE_SCORES.get(response, 0.0)

    if denominator == 0:
        return None, "unrated"

    percentage = round((score / denominator) * 100, 2)
    if percentage >= 75:
        return percentage, "high"
    if percentage >= 50:
        return percentage, "medium"
    return percentage, "low"


def apply_quality_metrics(article: Any, schema: list[dict[str, Any]] | None) -> tuple[float | None, str]:
    quality_score, quality_rating = calculate_quality_metrics(
        getattr(article, "qualityAssessmentAnswers", None) or {},
        schema,
    )
    article.qualityScore = quality_score
    article.qualityRating = quality_rating
    return quality_score, quality_rating


def recalculate_project_article_quality(articles: list[Any], schema: list[dict[str, Any]] | None) -> None:
    for article in articles:
        apply_quality_metrics(article, schema)
