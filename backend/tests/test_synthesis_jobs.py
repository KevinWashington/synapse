from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.article import Article
from app.models.project import Project
from app.models.synthesis import RQSynthesis, SynthesisGenerationJob
from app.models.user import User
from app.schemas.synthesis import GenerationRequest, ManualSynthesisUpdate
from app.services.synthesis_generation_service import evidence_fingerprint
from app.services.synthesis_identity_service import question_fingerprint
from app.services.synthesis_jobs_service import (
    SynthesisConflict,
    cancel_generation,
    claim_job,
    enqueue_generation,
    run_claimed_job,
    save_manual_draft,
)
from app.services.synthesis_query_service import list_evidence
from synthesis_test_support import synthesis_database, synthesis_session  # noqa: F401


class FakeAI:
    model_name = "fake"

    async def synthesize_evidence(self, *, question, packets, stage):
        article_ids = [packet["articleId"] for packet in packets if packet.get("articleId")]
        return {
            "narrative": f"Generated for {question}",
            "keyFindings": [{"text": "A supported finding", "articleIds": article_ids[:1]}],
            "divergences": [],
            "limitations": [],
        }


class SessionReuse:
    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, *_):
        return False


def _session_factory(session):
    return lambda: SessionReuse(session)


async def _scene(session):
    user = User(name="Owner", email="jobs@example.com")
    session.add(user)
    await session.flush()
    project = Project(title="Review", objetivo="Objective", ownerId=user.id, researchQuestions=["RQ one"])
    session.add(project)
    await session.flush()
    article = Article(
        projectId=project.id,
        ownerId=user.id,
        title="Included study",
        authors="Author",
        year=2025,
        journal="Journal",
        reviewOutcome="included",
        answeringRQs=[1],
        eligibilityReasonText="The eligibility criteria were met.",
        extractionData={"method": "interview"},
    )
    session.add(article)
    await session.flush()
    return SimpleNamespace(user=user, project=project, article=article)


def _request(question):
    return GenerationRequest(
        expectedVersion=0,
        questionFingerprint=question_fingerprint(question),
        replaceExisting=False,
        idempotencyKey=uuid4(),
    )


async def _enqueue(session, scene, request=None):
    return await enqueue_generation(
        session,
        project=scene.project,
        user=scene.user,
        rq_number=1,
        request=request or _request("RQ one"),
    )


@pytest.mark.asyncio
async def test_first_generation_is_persisted_after_success(synthesis_session):
    scene = await _scene(synthesis_session)
    job = await _enqueue(synthesis_session, scene)
    claimed = await claim_job(synthesis_session, worker_id="test-worker")

    await run_claimed_job(
        job.id,
        lease_token=claimed.leaseToken,
        session_factory=_session_factory(synthesis_session),
        ai_service_factory=lambda user, vault: FakeAI(),
        heartbeat_interval=3600,
    )

    draft = await synthesis_session.scalar(select(RQSynthesis).where(RQSynthesis.projectId == scene.project.id))
    saved_job = await synthesis_session.get(SynthesisGenerationJob, job.id)
    assert saved_job.status == "succeeded", saved_job.errorCode
    assert draft.content["narrative"] == "Generated for RQ one"
    assert draft.sourceArticleIds == [scene.article.id]
    assert draft.version == 1
    assert draft.evidenceFingerprint == job.evidenceFingerprint


@pytest.mark.asyncio
async def test_existing_draft_requires_confirmation_and_stays_visible_while_queued(synthesis_session):
    scene = await _scene(synthesis_session)
    draft = RQSynthesis(
        projectId=scene.project.id,
        rqNumber=1,
        questionSnapshot="RQ one",
        questionFingerprint=question_fingerprint("RQ one"),
        evidenceFingerprint="a" * 64,
        content={"narrative": "Human text"},
        sourceArticleIds=[scene.article.id],
    )
    synthesis_session.add(draft)
    await synthesis_session.flush()

    with pytest.raises(SynthesisConflict, match="confirmation"):
        await _enqueue(
            synthesis_session,
            scene,
            GenerationRequest(
                expectedVersion=1,
                questionFingerprint=question_fingerprint("RQ one"),
                replaceExisting=False,
                idempotencyKey=uuid4(),
            ),
        )

    request = GenerationRequest(
        expectedVersion=1,
        questionFingerprint=question_fingerprint("RQ one"),
        replaceExisting=True,
        idempotencyKey=uuid4(),
    )
    await _enqueue(synthesis_session, scene, request)
    await synthesis_session.refresh(draft)
    assert draft.content["narrative"] == "Human text"
    assert draft.version == 1


@pytest.mark.asyncio
async def test_generation_failure_preserves_existing_draft(synthesis_session):
    scene = await _scene(synthesis_session)
    draft = RQSynthesis(
        projectId=scene.project.id,
        rqNumber=1,
        questionSnapshot="RQ one",
        questionFingerprint=question_fingerprint("RQ one"),
        evidenceFingerprint="a" * 64,
        content={"narrative": "Keep this"},
        sourceArticleIds=[scene.article.id],
    )
    synthesis_session.add(draft)
    await synthesis_session.flush()
    request = GenerationRequest(
        expectedVersion=1,
        questionFingerprint=question_fingerprint("RQ one"),
        replaceExisting=True,
        idempotencyKey=uuid4(),
    )
    job = await _enqueue(synthesis_session, scene, request)
    claimed = await claim_job(synthesis_session, worker_id="test-worker")

    class BrokenAI(FakeAI):
        async def synthesize_evidence(self, **kwargs):
            raise RuntimeError("provider unavailable")

    await run_claimed_job(
        job.id,
        lease_token=claimed.leaseToken,
        session_factory=_session_factory(synthesis_session),
        ai_service_factory=lambda user, vault: BrokenAI(),
        heartbeat_interval=3600,
    )

    await synthesis_session.refresh(draft)
    saved_job = await synthesis_session.get(SynthesisGenerationJob, job.id)
    assert draft.content["narrative"] == "Keep this"
    assert draft.version == 1
    assert saved_job.status == "failed"


@pytest.mark.asyncio
async def test_idempotent_enqueue_returns_existing_job(synthesis_session):
    scene = await _scene(synthesis_session)
    request = _request("RQ one")
    first = await _enqueue(synthesis_session, scene, request)
    second = await _enqueue(synthesis_session, scene, request)

    assert first.id == second.id


@pytest.mark.asyncio
async def test_changed_evidence_marks_conflict_and_keeps_old_draft(synthesis_session):
    scene = await _scene(synthesis_session)
    draft = RQSynthesis(
        projectId=scene.project.id,
        rqNumber=1,
        questionSnapshot="RQ one",
        questionFingerprint=question_fingerprint("RQ one"),
        evidenceFingerprint="a" * 64,
        content={"narrative": "Existing"},
        sourceArticleIds=[scene.article.id],
    )
    synthesis_session.add(draft)
    await synthesis_session.flush()
    request = GenerationRequest(
        expectedVersion=1,
        questionFingerprint=question_fingerprint("RQ one"),
        replaceExisting=True,
        idempotencyKey=uuid4(),
    )
    job = await _enqueue(synthesis_session, scene, request)
    claimed = await claim_job(synthesis_session, worker_id="test-worker")
    scene.article.extractionData = {"method": "survey"}
    await synthesis_session.flush()

    await run_claimed_job(
        job.id,
        lease_token=claimed.leaseToken,
        session_factory=_session_factory(synthesis_session),
        ai_service_factory=lambda user, vault: FakeAI(),
        heartbeat_interval=3600,
    )

    await synthesis_session.refresh(draft)
    saved_job = await synthesis_session.get(SynthesisGenerationJob, job.id)
    assert draft.content["narrative"] == "Existing"
    assert saved_job.status == "conflict"
    assert saved_job.errorCode == "EVIDENCE_CHANGED"


@pytest.mark.asyncio
async def test_manual_save_uses_optimistic_version(synthesis_session):
    scene = await _scene(synthesis_session)
    update = ManualSynthesisUpdate(
        expectedVersion=1,
        questionFingerprint=question_fingerprint("RQ one"),
        content={"narrative": "Edited by reviewer"},
    )

    with pytest.raises(SynthesisConflict, match="version"):
        await save_manual_draft(
            synthesis_session,
            project=scene.project,
            user=scene.user,
            rq_number=1,
            request=update,
        )


@pytest.mark.asyncio
async def test_queued_job_can_be_cancelled_without_claiming_it(synthesis_session):
    scene = await _scene(synthesis_session)
    job = await _enqueue(synthesis_session, scene)

    cancelled = await cancel_generation(
        synthesis_session,
        project=scene.project,
        user=scene.user,
        job_id=job.id,
    )
    next_job = await claim_job(synthesis_session, worker_id="test-worker")

    assert cancelled.status == "cancelled"
    assert next_job is None


@pytest.mark.asyncio
async def test_expired_lease_is_reclaimed_once_and_old_token_cannot_claim_again(synthesis_session):
    scene = await _scene(synthesis_session)
    job = await _enqueue(synthesis_session, scene)
    first_claim = await claim_job(synthesis_session, worker_id="worker-one")
    first_token = first_claim.leaseToken
    first_claim.leaseExpiresAt = datetime.now(timezone.utc) - timedelta(seconds=1)
    await synthesis_session.flush()

    second_claim = await claim_job(synthesis_session, worker_id="worker-two")
    assert second_claim.id == job.id
    assert second_claim.leaseToken != first_token
    assert second_claim.attempts == 2

    second_claim.leaseExpiresAt = datetime.now(timezone.utc) - timedelta(seconds=1)
    await synthesis_session.flush()
    assert await claim_job(synthesis_session, worker_id="worker-three") is None


@pytest.mark.asyncio
async def test_manual_save_creates_then_increments_version(synthesis_session):
    scene = await _scene(synthesis_session)
    first = await save_manual_draft(
        synthesis_session,
        project=scene.project,
        user=scene.user,
        rq_number=1,
        request=ManualSynthesisUpdate(
            expectedVersion=0,
            questionFingerprint=question_fingerprint("RQ one"),
            content={"narrative": "Drafted by reviewer"},
        ),
    )
    second = await save_manual_draft(
        synthesis_session,
        project=scene.project,
        user=scene.user,
        rq_number=1,
        request=ManualSynthesisUpdate(
            expectedVersion=1,
            questionFingerprint=question_fingerprint("RQ one"),
            content={"narrative": "Updated by reviewer"},
        ),
    )

    assert first["draft"]["version"] == 1
    assert second["draft"]["version"] == 2
    assert second["draft"]["content"]["narrative"] == "Updated by reviewer"


@pytest.mark.asyncio
async def test_missing_user_key_marks_job_failed_without_saving(synthesis_session):
    scene = await _scene(synthesis_session)
    job = await _enqueue(synthesis_session, scene)
    claimed = await claim_job(synthesis_session, worker_id="test-worker")

    await run_claimed_job(
        job.id,
        lease_token=claimed.leaseToken,
        session_factory=_session_factory(synthesis_session),
        credential_vault=object(),
        heartbeat_interval=3600,
    )

    saved_job = await synthesis_session.get(SynthesisGenerationJob, job.id)
    draft = await synthesis_session.scalar(select(RQSynthesis).where(RQSynthesis.projectId == scene.project.id))
    assert saved_job.status == "failed"
    assert saved_job.errorCode == "DEEPSEEK_KEY_REQUIRED"
    assert draft is None
