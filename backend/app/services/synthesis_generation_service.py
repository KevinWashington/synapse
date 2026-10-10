import asyncio
import hashlib
import inspect
import json
from collections.abc import Iterable

from pydantic import ValidationError

from app.config import settings
from app.schemas.synthesis import SynthesisContent
from app.services.evidence_service import calculate_quality_metrics
from app.services.synthesis_identity_service import question_fingerprint


def _value(row, name, fallback=None):
    if isinstance(row, dict):
        return row.get(name, fallback)
    return getattr(row, name, fallback)


def _serialized(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def _text(value, max_chars: int) -> tuple[str, bool]:
    text = str(value or "")
    return (text, False) if len(text) <= max_chars else (text[: max_chars - 3] + "...", True)


def _fit_packet(packet: dict, max_chars: int) -> dict:
    packet = dict(packet)
    if len(_serialized(packet)) <= max_chars:
        return packet
    packet["truncated"] = True
    packet["title"], _ = _text(packet.get("title"), 300)
    packet["excerpt"], _ = _text(packet.get("excerpt"), min(1200, max_chars // 3))
    values = packet.get("extractionValues") or {}
    bounded_values = {}
    for key in sorted(values):
        if len(_serialized({**packet, "extractionValues": bounded_values})) >= max_chars - 100:
            break
        remaining = max_chars - len(_serialized({**packet, "extractionValues": bounded_values})) - len(str(key)) - 32
        if remaining <= 0:
            break
        value = values[key]
        serialized = _serialized(value)
        if len(serialized) > min(600, remaining):
            value = serialized[: min(600, remaining) - 3] + "..."
            packet["truncated"] = True
        bounded_values[key] = value
    if len(bounded_values) != len(values):
        packet["truncated"] = True
    packet["extractionValues"] = bounded_values
    quality = packet.get("quality") or {}
    packet["quality"] = {key: quality.get(key) for key in ("rating", "score") if key in quality}
    while len(_serialized(packet)) > max_chars and packet.get("excerpt"):
        packet["excerpt"] = packet["excerpt"][: max(0, len(packet["excerpt"]) // 2)]
    return packet


def build_evidence_packets(rows: Iterable, project) -> list[dict]:
    packets = []
    schema = getattr(project, "qualityAssessmentSchema", None) or []
    for row in rows:
        article_id = _value(row, "articleId", _value(row, "id"))
        extraction = _value(row, "extractionValues", _value(row, "extractionData")) or {}
        answers = _value(row, "qualityAnswers", _value(row, "qualityAssessmentAnswers")) or {}
        score, rating = calculate_quality_metrics(answers, schema)
        excerpt = _value(row, "evidenceExcerpt")
        excerpt_kind = _value(row, "excerptKind", "none")
        if not excerpt:
            for key, kind in (
                ("eligibilityReasonText", "selection_reason"),
                ("screeningReasonText", "selection_reason"),
                ("manualDecisionReason", "selection_reason"),
                ("aiEvaluation", "ai_evaluation"),
                ("notas", "reviewer_note"),
            ):
                excerpt = _value(row, key)
                if excerpt:
                    excerpt_kind = kind
                    break
        excerpt, excerpt_truncated = _text(excerpt, 1_200)
        packet = {
            "articleId": int(article_id),
            "title": str(_value(row, "title", "") or ""),
            "year": _value(row, "year"),
            "excerpt": excerpt or None,
            "excerptKind": excerpt_kind if excerpt else "none",
            "extractionValues": extraction,
            "quality": {"score": score, "rating": rating, "answers": answers},
            "rqNumbers": _value(row, "rqNumbers", _value(row, "answeringRQs")) or [],
            "truncated": excerpt_truncated,
        }
        packets.append(_fit_packet(packet, settings.SYNTHESIS_MAX_PACKET_CHARS))
    return sorted(packets, key=lambda packet: packet["articleId"])


def evidence_fingerprint(question: str, packets: list[dict]) -> str:
    relevant = []
    for packet in sorted(packets, key=lambda value: value["articleId"]):
        relevant.append(
            {
                "articleId": packet["articleId"],
                "title": packet.get("title"),
                "year": packet.get("year"),
                "excerpt": packet.get("excerpt"),
                "excerptKind": packet.get("excerptKind"),
                "extractionValues": packet.get("extractionValues") or {},
                "quality": packet.get("quality") or {},
                "rqNumbers": packet.get("rqNumbers") or [],
            }
        )
    canonical = _serialized({"questionFingerprint": question_fingerprint(question), "packets": relevant})
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def validate_content(content, *, allowed_article_ids: set[int]) -> SynthesisContent:
    try:
        validated = content if isinstance(content, SynthesisContent) else SynthesisContent.model_validate(content)
    except (ValidationError, TypeError, ValueError) as exc:
        raise ValueError("Synthesis model did not return valid structured content") from exc
    cited_ids = {
        article_id
        for group in (validated.keyFindings, validated.divergences, validated.limitations)
        for item in group
        for article_id in item.articleIds
    }
    unknown = cited_ids - allowed_article_ids
    if unknown:
        raise ValueError(f"Synthesis result contains unknown article IDs: {sorted(unknown)}")
    return validated


def _bound_generated_content(content: SynthesisContent) -> SynthesisContent:
    """Keep map/reduce outputs small enough to be safely reduced again."""
    def bounded(items):
        return [
            {"text": item.text[:300], "articleIds": item.articleIds[:10]}
            for item in items[:5]
        ]

    return SynthesisContent(
        narrative=content.narrative[:1_000],
        keyFindings=bounded(content.keyFindings),
        divergences=bounded(content.divergences),
        limitations=bounded(content.limitations),
    )


def _source_ids(packets: list[dict]) -> set[int]:
    ids = set()
    for packet in packets:
        if packet.get("articleId") is not None:
            ids.add(int(packet["articleId"]))
        ids.update(int(article_id) for article_id in packet.get("sourceArticleIds", []))
        for group in ("keyFindings", "divergences", "limitations"):
            for finding in (packet.get("summary") or {}).get(group, []):
                ids.update(int(article_id) for article_id in finding.get("articleIds", []))
    return ids


def _bounded_batches(question: str, packets: list[dict], max_chars: int) -> list[list[dict]]:
    batches = []
    current = []
    for raw in packets:
        packet = _fit_packet(raw, settings.SYNTHESIS_MAX_PACKET_CHARS)
        candidate = current + [packet]
        if current and len(_serialized({"question": question, "packets": candidate})) > max_chars:
            batches.append(current)
            current = [packet]
        else:
            current = candidate
        if len(_serialized({"question": question, "packets": current})) > max_chars:
            raise ValueError("A single evidence packet exceeds the synthesis input budget")
    if current:
        batches.append(current)
    return batches


async def _invoke(ai_service, *, question: str, packets: list[dict], stage: str, allowed_ids: set[int]) -> SynthesisContent:
    result = await asyncio.wait_for(
        ai_service.synthesize_evidence(question=question, packets=packets, stage=stage),
        timeout=settings.SYNTHESIS_MODEL_TIMEOUT_SECONDS,
    )
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except json.JSONDecodeError as exc:
            raise ValueError("Synthesis model did not return valid structured content") from exc
    return _bound_generated_content(validate_content(result, allowed_article_ids=allowed_ids))


def _summary_packet(content: SynthesisContent, article_ids: set[int], sequence: int) -> dict:
    return {
        "articleId": None,
        "sourceArticleIds": sorted(article_ids),
        "title": f"Evidence batch {sequence}",
        "excerpt": None,
        "excerptKind": "ai_summary",
        "extractionValues": {},
        "quality": {},
        "rqNumbers": [],
        "summary": content.model_dump(mode="json"),
    }


async def generate_synthesis(ai_service, *, question: str, packets: list[dict], on_progress=None) -> SynthesisContent:
    if not packets:
        raise ValueError("RQ has no linked evidence")
    max_chars = settings.SYNTHESIS_MAX_INPUT_CHARS
    bounded_packets = [_fit_packet(packet, settings.SYNTHESIS_MAX_PACKET_CHARS) for packet in packets]
    allowed_ids = _source_ids(bounded_packets)
    if not allowed_ids:
        raise ValueError("RQ has no linked evidence")
    if len(_serialized({"question": question, "packets": bounded_packets})) <= max_chars:
        return await _invoke(ai_service, question=question, packets=bounded_packets, stage="final", allowed_ids=allowed_ids)

    batches = _bounded_batches(question, bounded_packets, max_chars)
    semaphore = asyncio.Semaphore(max(1, settings.SYNTHESIS_MAX_CONCURRENCY))
    completed = 0

    async def map_batch(index: int, batch: list[dict]):
        nonlocal completed
        async with semaphore:
            content = await _invoke(
                ai_service,
                question=question,
                packets=batch,
                stage="map",
                allowed_ids=_source_ids(batch),
            )
        completed += 1
        if on_progress:
            progress_result = on_progress(completed, len(batches))
            if inspect.isawaitable(progress_result):
                await progress_result
        return _summary_packet(content, _source_ids(batch), index)

    mapped = await asyncio.gather(*(map_batch(index, batch) for index, batch in enumerate(batches, start=1)))
    reduced = mapped
    sequence = len(mapped)
    while len(_serialized({"question": question, "packets": reduced})) > max_chars:
        groups = _bounded_batches(question, reduced, max_chars)
        if len(groups) >= len(reduced):
            raise ValueError("Synthesis reduction could not shrink the evidence summaries")
        next_level = []
        for group in groups:
            group_ids = _source_ids(group)
            result = await _invoke(
                ai_service,
                question=question,
                packets=group,
                stage="reduce",
                allowed_ids=group_ids,
            )
            sequence += 1
            next_level.append(_summary_packet(result, group_ids, sequence))
        reduced = next_level
    return await _invoke(
        ai_service,
        question=question,
        packets=reduced,
        stage="reduce",
        allowed_ids=allowed_ids,
    )
