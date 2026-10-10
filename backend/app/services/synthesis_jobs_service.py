import asyncio
import inspect
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.dependencies import get_user_ai_service
from app.database import async_session_maker
from app.models.project import Project
from app.models.synthesis import RQSynthesis, SynthesisGenerationJob
from app.models.user import User
from app.schemas.synthesis import GenerationRequest, ManualSynthesisUpdate, SynthesisContent
from app.services.credential_vault import CredentialVault, get_credential_vault
from app.services.project_access_service import CAP_EDIT_PROJECT, resolve_project_access
from app.services.synthesis_generation_service import (
    build_evidence_packets,
    evidence_fingerprint,
    generate_synthesis,
    validate_content,
)
from app.services.synthesis_identity_service import question_fingerprint
from app.services.synthesis_query_service import list_evidence


LEASE_SECONDS = 180
MAX_JOB_ATTEMPTS = 2


class SynthesisConflict(Exception):
    """Expected conflict that leaves the currently saved synthesis unchanged."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _has_content(content: dict | None) -> bool:
    content = content or {}
    if (content.get("narrative") or "").strip():
        return True
    return any(
        (item.get("text") or "").strip()
        for key in ("keyFindings", "divergences", "limitations")
        for item in content.get(key, [])
    )


def _citations(content: SynthesisContent) -> list[int]:
    return sorted({
        article_id
        for group in (content.keyFindings, content.divergences, content.limitations)
        for finding in group
        for article_id in finding.articleIds
    })


async def _load_evidence(db, project, rq_number: int) -> list[dict]:
    packets = []
    page = 1
    while True:
        result = await list_evidence(
            db,
            project,
            rq_number,
            {},
            page=page,
            page_size=100,
            order="quality",
        )
        packets.extend(build_evidence_packets(result["items"], project))
        if len(packets) >= result["total"]:
            return packets
        page += 1


async def enqueue_generation(
    db,
    *,
    project: Project,
    user: User,
    rq_number: int,
    request: GenerationRequest,
) -> SynthesisGenerationJob:
    locked_project = await db.scalar(
        select(Project).where(Project.id == project.id).with_for_update().execution_options(populate_existing=True)
    )
    if locked_project is None:
        raise SynthesisConflict("Project no longer exists")
    questions = locked_project.researchQuestions or []
    if rq_number < 1 or rq_number > len(questions):
        raise SynthesisConflict("Research question no longer exists")
    question = questions[rq_number - 1]
    fingerprint = question_fingerprint(question)
    if request.questionFingerprint != fingerprint:
        raise SynthesisConflict("Research question changed; reload before generating")

    existing_job = await db.scalar(
        select(SynthesisGenerationJob).where(
            SynthesisGenerationJob.projectId == project.id,
            SynthesisGenerationJob.requesterUserId == user.id,
            SynthesisGenerationJob.idempotencyKey == str(request.idempotencyKey),
        )
    )
    if existing_job is not None:
        return existing_job

    draft = await db.scalar(
        select(RQSynthesis)
        .where(RQSynthesis.projectId == project.id, RQSynthesis.rqNumber == rq_number)
        .with_for_update()
    )
    actual_version = draft.version if draft is not None else 0
    if actual_version != request.expectedVersion:
        raise SynthesisConflict("Synthesis version conflict")
    if draft is not None and _has_content(draft.content) and not request.replaceExisting:
        raise SynthesisConflict("Explicit confirmation is required to replace existing synthesis content")
    if draft is None and request.replaceExisting:
        raise SynthesisConflict("There is no existing synthesis content to replace")

    packets = await _load_evidence(db, locked_project, rq_number)
    if not packets:
        raise SynthesisConflict("RQ has no linked evidence")
    evidence_hash = evidence_fingerprint(question, packets)
    job = SynthesisGenerationJob(
        projectId=project.id,
        rqNumber=rq_number,
        requesterUserId=user.id,
        idempotencyKey=str(request.idempotencyKey),
        questionFingerprint=fingerprint,
        evidenceFingerprint=evidence_hash,
        expectedVersion=actual_version,
        requestSnapshot={"question": question, "packets": packets},
        status="queued",
        completedBatches=0,
        totalBatches=0,
        attempts=0,
    )
    db.add(job)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        existing_job = await db.scalar(
            select(SynthesisGenerationJob).where(
                SynthesisGenerationJob.projectId == project.id,
                SynthesisGenerationJob.requesterUserId == user.id,
                SynthesisGenerationJob.idempotencyKey == str(request.idempotencyKey),
            )
        )
        if existing_job is not None:
            return existing_job
        raise SynthesisConflict("A generation is already active for this research question") from exc
    return job


async def claim_job(db, *, worker_id: str) -> SynthesisGenerationJob | None:
    now = _now()
    result = await db.execute(
        select(SynthesisGenerationJob)
        .where(
            or_(
                SynthesisGenerationJob.status == "queued",
                (SynthesisGenerationJob.status == "running")
                & (SynthesisGenerationJob.leaseExpiresAt < now)
                & (SynthesisGenerationJob.attempts < MAX_JOB_ATTEMPTS),
            )
        )
        .order_by(SynthesisGenerationJob.createdAt, SynthesisGenerationJob.id)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if job is None:
        return None
    job.status = "running"
    job.workerId = worker_id
    job.leaseToken = str(uuid4())
    job.leaseExpiresAt = now + timedelta(seconds=LEASE_SECONDS)
    job.attempts += 1
    job.startedAt = job.startedAt or now
    job.updatedAt = now
    await db.flush()
    return job


@asynccontextmanager
async def _session_scope(session_factory):
    async with session_factory() as session:
        yield session


async def _heartbeat(job_id: int, lease_token: str, session_factory, interval: float, lost_lease: asyncio.Event):
    while True:
        await asyncio.sleep(interval)
        async with _session_scope(session_factory) as db:
            result = await db.execute(
                update(SynthesisGenerationJob)
                .where(
                    SynthesisGenerationJob.id == job_id,
                    SynthesisGenerationJob.status == "running",
                    SynthesisGenerationJob.leaseToken == lease_token,
                    SynthesisGenerationJob.cancelRequestedAt.is_(None),
                )
                .values(leaseExpiresAt=_now() + timedelta(seconds=LEASE_SECONDS), updatedAt=_now())
            )
            await db.commit()
            if result.rowcount != 1:
                cancelled = await db.scalar(
                    select(SynthesisGenerationJob)
                    .where(
                        SynthesisGenerationJob.id == job_id,
                        SynthesisGenerationJob.status == "running",
                        SynthesisGenerationJob.leaseToken == lease_token,
                        SynthesisGenerationJob.cancelRequestedAt.is_not(None),
                    )
                    .with_for_update()
                )
                if cancelled is not None:
                    cancelled.status = "cancelled"
                    cancelled.completedAt = _now()
                    cancelled.leaseExpiresAt = None
                    await db.commit()
                lost_lease.set()
                return


async def _record_progress(job_id: int, lease_token: str, session_factory, completed: int, total: int):
    async with _session_scope(session_factory) as db:
        job = await db.scalar(
            select(SynthesisGenerationJob).where(
                SynthesisGenerationJob.id == job_id,
                SynthesisGenerationJob.leaseToken == lease_token,
                SynthesisGenerationJob.status == "running",
            )
        )
        if job is None or job.cancelRequestedAt is not None:
            raise SynthesisConflict("Generation was cancelled or its lease was lost")
        job.completedBatches = completed
        job.totalBatches = total
        job.leaseExpiresAt = _now() + timedelta(seconds=LEASE_SECONDS)
        await db.commit()


async def _finish_job(job_id: int, lease_token: str, session_factory, *, status: str, error_code: str | None = None):
    async with _session_scope(session_factory) as db:
        job = await db.scalar(
            select(SynthesisGenerationJob)
            .where(SynthesisGenerationJob.id == job_id)
            .with_for_update()
        )
        if job is None or job.leaseToken != lease_token or job.status != "running":
            return False
        job.status = status
        job.errorCode = error_code
        job.completedAt = _now()
        job.leaseExpiresAt = None
        job.updatedAt = _now()
        await db.commit()
        return True


async def _apply_result(job_id: int, lease_token: str, session_factory, content: SynthesisContent, model_name: str | None) -> None:
    async with _session_scope(session_factory) as db:
        job = await db.scalar(
            select(SynthesisGenerationJob)
            .where(SynthesisGenerationJob.id == job_id)
            .with_for_update()
        )
        if job is None or job.status != "running" or job.leaseToken != lease_token:
            return
        if job.cancelRequestedAt is not None:
            job.status = "cancelled"
            job.completedAt = _now()
            job.leaseExpiresAt = None
            await db.commit()
            return

        project = await db.scalar(
            select(Project).where(Project.id == job.projectId).with_for_update()
        )
        requester = await db.get(User, job.requesterUserId)
        if project is None or requester is None or not requester.isActive:
            job.status = "failed"
            job.errorCode = "REQUESTER_UNAVAILABLE"
            job.completedAt = _now()
            job.leaseExpiresAt = None
            await db.commit()
            return
        try:
            access = await resolve_project_access(db, project_id=project.id, user_id=requester.id)
            if CAP_EDIT_PROJECT not in access.capabilities:
                job.status = "failed"
                job.errorCode = "PERMISSION_REVOKED"
                job.completedAt = _now()
                job.leaseExpiresAt = None
                await db.commit()
                return
        except Exception:
            job.status = "failed"
            job.errorCode = "PERMISSION_REVOKED"
            job.completedAt = _now()
            job.leaseExpiresAt = None
            await db.commit()
            return

        questions = project.researchQuestions or []
        if job.rqNumber > len(questions):
            job.status = "conflict"
            job.errorCode = "QUESTION_CHANGED"
            job.completedAt = _now()
            job.leaseExpiresAt = None
            await db.commit()
            return
        question = questions[job.rqNumber - 1]
        if question_fingerprint(question) != job.questionFingerprint:
            job.status = "conflict"
            job.errorCode = "QUESTION_CHANGED"
            job.completedAt = _now()
            job.leaseExpiresAt = None
            await db.commit()
            return

        current_packets = await _load_evidence(db, project, job.rqNumber)
        current_fingerprint = evidence_fingerprint(question, current_packets)
        if current_fingerprint != job.evidenceFingerprint:
            job.status = "conflict"
            job.errorCode = "EVIDENCE_CHANGED"
            job.completedAt = _now()
            job.leaseExpiresAt = None
            await db.commit()
            return
        allowed = {packet["articleId"] for packet in current_packets}
        validated = validate_content(content, allowed_article_ids=allowed)
        draft = await db.scalar(
            select(RQSynthesis)
            .where(RQSynthesis.projectId == project.id, RQSynthesis.rqNumber == job.rqNumber)
            .with_for_update()
        )
        current_version = draft.version if draft is not None else 0
        if current_version != job.expectedVersion:
            job.status = "conflict"
            job.errorCode = "SYNTHESIS_VERSION_CONFLICT"
            job.completedAt = _now()
            job.leaseExpiresAt = None
            await db.commit()
            return

        if draft is None:
            draft = RQSynthesis(
                projectId=project.id,
                rqNumber=job.rqNumber,
                questionSnapshot=question,
                questionFingerprint=job.questionFingerprint,
                evidenceFingerprint=current_fingerprint,
                content=validated.model_dump(mode="json"),
                sourceArticleIds=sorted(allowed),
                modelName=model_name,
                generatedAt=_now(),
                createdByUserId=requester.id,
                updatedByUserId=requester.id,
                version=1,
            )
            db.add(draft)
        else:
            draft.questionSnapshot = question
            draft.questionFingerprint = job.questionFingerprint
            draft.evidenceFingerprint = current_fingerprint
            draft.content = validated.model_dump(mode="json")
            draft.sourceArticleIds = sorted(allowed)
            draft.modelName = model_name
            draft.generatedAt = _now()
            draft.updatedByUserId = requester.id
            draft.version += 1
        job.resultContent = validated.model_dump(mode="json")
        job.status = "succeeded"
        job.completedBatches = job.totalBatches or job.completedBatches
        job.completedAt = _now()
        job.leaseExpiresAt = None
        await db.commit()


async def run_claimed_job(
    job_id: int,
    *,
    lease_token: str,
    session_factory: async_sessionmaker = async_session_maker,
    credential_vault: CredentialVault | None = None,
    ai_service_factory=get_user_ai_service,
    heartbeat_interval: float = 30,
) -> None:
    permission_error = False
    async with _session_scope(session_factory) as db:
        job = await db.scalar(
            select(SynthesisGenerationJob).where(
                SynthesisGenerationJob.id == job_id,
                SynthesisGenerationJob.status == "running",
                SynthesisGenerationJob.leaseToken == lease_token,
            )
        )
        if job is None:
            return
        snapshot = job.requestSnapshot
        requester = await db.get(User, job.requesterUserId)
        project = await db.get(Project, job.projectId)
        if requester is not None and requester.isActive and project is not None:
            try:
                access = await resolve_project_access(db, project_id=project.id, user_id=requester.id)
                permission_error = CAP_EDIT_PROJECT not in access.capabilities
            except Exception:
                permission_error = True
        else:
            permission_error = True
    if requester is None or not requester.isActive:
        await _finish_job(job_id, lease_token, session_factory, status="failed", error_code="REQUESTER_UNAVAILABLE")
        return
    if permission_error:
        await _finish_job(job_id, lease_token, session_factory, status="failed", error_code="PERMISSION_REVOKED")
        return

    lost_lease = asyncio.Event()
    heartbeat = asyncio.create_task(_heartbeat(job_id, lease_token, session_factory, heartbeat_interval, lost_lease))
    try:
        vault = credential_vault or get_credential_vault()
        service = ai_service_factory(requester, vault)
        if inspect.isawaitable(service):
            service = await service

        async def progress(completed, total):
            await _record_progress(job_id, lease_token, session_factory, completed, total)

        content = await generate_synthesis(
            service,
            question=snapshot["question"],
            packets=snapshot["packets"],
            on_progress=progress,
        )
        if lost_lease.is_set():
            return
        await _apply_result(job_id, lease_token, session_factory, content, getattr(service, "model_name", None))
    except SynthesisConflict as exc:
        code = "CANCELLED" if "cancelled" in str(exc).lower() else "LEASE_LOST"
        await _finish_job(
            job_id,
            lease_token,
            session_factory,
            status="cancelled" if code == "CANCELLED" else "conflict",
            error_code=code,
        )
    except Exception as exc:
        code = "DEEPSEEK_KEY_REQUIRED" if exc.__class__.__name__ == "DeepSeekKeyRequiredError" else "GENERATION_FAILED"
        await _finish_job(job_id, lease_token, session_factory, status="failed", error_code=code)
    finally:
        heartbeat.cancel()
        try:
            await heartbeat
        except asyncio.CancelledError:
            pass


async def cancel_generation(db, *, project: Project, user: User, job_id: int) -> SynthesisGenerationJob:
    job = await db.scalar(
        select(SynthesisGenerationJob)
        .where(SynthesisGenerationJob.id == job_id, SynthesisGenerationJob.projectId == project.id)
        .with_for_update()
    )
    if job is None:
        raise SynthesisConflict("Generation job not found")
    if job.status in {"succeeded", "failed", "cancelled", "conflict"}:
        return job
    if job.status == "queued":
        job.status = "cancelled"
        job.completedAt = _now()
        job.leaseExpiresAt = None
    else:
        job.cancelRequestedAt = _now()
    job.updatedAt = _now()
    await db.flush()
    return job


async def save_manual_draft(
    db,
    *,
    project: Project,
    user: User,
    rq_number: int,
    request: ManualSynthesisUpdate,
) -> dict:
    locked_project = await db.scalar(
        select(Project).where(Project.id == project.id).with_for_update().execution_options(populate_existing=True)
    )
    questions = locked_project.researchQuestions or [] if locked_project else []
    if rq_number < 1 or rq_number > len(questions):
        raise SynthesisConflict("Research question no longer exists")
    question = questions[rq_number - 1]
    fingerprint = question_fingerprint(question)
    if fingerprint != request.questionFingerprint:
        raise SynthesisConflict("Research question changed; reload before saving")
    draft = await db.scalar(
        select(RQSynthesis)
        .where(RQSynthesis.projectId == project.id, RQSynthesis.rqNumber == rq_number)
        .with_for_update()
    )
    version = draft.version if draft else 0
    if version != request.expectedVersion:
        raise SynthesisConflict("Synthesis version conflict")
    packets = await _load_evidence(db, locked_project, rq_number)
    allowed = {packet["articleId"] for packet in packets}
    content = validate_content(request.content, allowed_article_ids=allowed)
    if draft is None:
        draft = RQSynthesis(
            projectId=project.id,
            rqNumber=rq_number,
            questionSnapshot=question,
            questionFingerprint=fingerprint,
            evidenceFingerprint=evidence_fingerprint(question, packets),
            content=content.model_dump(mode="json"),
            sourceArticleIds=_citations(content),
            createdByUserId=user.id,
            updatedByUserId=user.id,
            version=1,
        )
        db.add(draft)
    else:
        draft.questionSnapshot = question
        draft.questionFingerprint = fingerprint
        # Retain the old evidence fingerprint so a manual save cannot clear stale state.
        draft.content = content.model_dump(mode="json")
        draft.sourceArticleIds = _citations(content)
        draft.updatedByUserId = user.id
        draft.version += 1
    await db.flush()
    return {
        "rqNumber": rq_number,
        "question": question,
        "questionFingerprint": fingerprint,
        "draft": {
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
            "staleCandidate": False,
        },
    }
