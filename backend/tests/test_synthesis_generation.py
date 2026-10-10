import json
from types import SimpleNamespace

import pytest

from app.services.synthesis_generation_service import (
    build_evidence_packets,
    evidence_fingerprint,
    generate_synthesis,
    validate_content,
)


def test_fingerprint_ignores_unrelated_updated_at_and_tracks_relevant_changes():
    packet = {
        "articleId": 7,
        "title": "Study",
        "year": 2025,
        "excerpt": "Reason",
        "excerptKind": "selection_reason",
        "extractionValues": {"design": "trial"},
        "quality": {"rating": "high"},
        "rqNumbers": [1],
        "articleUpdatedAt": "2026-01-01",
    }
    same_evidence = {**packet, "articleUpdatedAt": "2026-10-10"}

    assert evidence_fingerprint("RQ?", [packet]) == evidence_fingerprint("RQ?", [same_evidence])
    assert evidence_fingerprint("RQ?", [packet]) != evidence_fingerprint(
        "RQ?", [{**packet, "extractionValues": {"design": "cohort"}}]
    )


def test_selection_reason_is_labeled_as_provenance_not_article_quote():
    row = SimpleNamespace(
        articleId=2,
        title="Study",
        year=2024,
        evidenceExcerpt="Included because it addressed the review criteria.",
        excerptKind="selection_reason",
        extractionValues={"method": "interviews"},
        qualityRating="medium",
        rqNumbers=[1],
    )

    packet = build_evidence_packets([row], SimpleNamespace())[0]

    assert packet["excerptKind"] == "selection_reason"
    assert packet["excerpt"] == row.evidenceExcerpt
    assert "quote" not in packet


def test_rejects_unknown_citation_ids():
    with pytest.raises(ValueError, match="unknown article IDs"):
        validate_content(
            {"narrative": "Finding", "keyFindings": [{"text": "Claim", "articleIds": [3, 99]}]},
            allowed_article_ids={3},
        )


class FakeSynthesisAI:
    model_name = "fake-model"

    def __init__(self):
        self.calls = []

    async def synthesize_evidence(self, *, question, packets, stage):
        self.calls.append((question, packets, stage))
        ids = []
        for packet in packets:
            ids.extend(packet.get("sourceArticleIds", []))
            if packet.get("articleId"):
                ids.append(packet["articleId"])
        citations = list(dict.fromkeys(ids))[:10]
        return {
            "narrative": f"{stage} summary",
            "keyFindings": [{"text": "Supported finding", "articleIds": citations}] if citations else [],
            "divergences": [],
            "limitations": [],
        }


@pytest.mark.asyncio
async def test_empty_evidence_never_calls_model():
    ai = FakeSynthesisAI()
    with pytest.raises(ValueError, match="no linked evidence"):
        await generate_synthesis(ai, question="RQ", packets=[], on_progress=None)
    assert ai.calls == []


@pytest.mark.asyncio
async def test_invalid_model_json_does_not_produce_content():
    class InvalidAI(FakeSynthesisAI):
        async def synthesize_evidence(self, *, question, packets, stage):
            return "not-json"

    with pytest.raises(ValueError, match="valid structured content"):
        await generate_synthesis(InvalidAI(), question="RQ", packets=[{"articleId": 1}], on_progress=None)


@pytest.mark.asyncio
async def test_thousand_studies_use_bounded_map_reduce_and_real_sources():
    ai = FakeSynthesisAI()
    packets = [
        {
            "articleId": index,
            "title": f"Study {index}",
            "year": 2025,
            "excerpt": "Curated evidence " * 25,
            "excerptKind": "reviewer_note",
            "extractionValues": {"method": "interview"},
            "quality": {"rating": "high"},
            "rqNumbers": [1],
            "truncated": False,
        }
        for index in range(1, 1001)
    ]

    content = await generate_synthesis(ai, question="How does it work?", packets=packets, on_progress=None)

    assert len(ai.calls) > 2
    assert {stage for _, _, stage in ai.calls} >= {"map", "reduce"}
    assert all(len(json.dumps(call_packets, ensure_ascii=False, separators=(",", ":"))) <= 24_000 for _, call_packets, _ in ai.calls)
    cited_ids = {article_id for finding in content.keyFindings for article_id in finding.articleIds}
    assert cited_ids <= {packet["articleId"] for packet in packets}
