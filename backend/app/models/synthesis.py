from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RQSynthesis(Base):
    """Shared, versioned synthesis content for one active project research question."""

    __tablename__ = "rq_syntheses"
    __table_args__ = (
        CheckConstraint('"rqNumber" IS NULL OR "rqNumber" > 0', name="ck_rq_syntheses_positive_rq"),
        CheckConstraint('"version" > 0', name="ck_rq_syntheses_positive_version"),
        Index(
            "uq_synthesis_project_rq_active",
            "projectId",
            "rqNumber",
            unique=True,
            postgresql_where=text('"rqNumber" IS NOT NULL'),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    projectId: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    rqNumber: Mapped[int | None] = mapped_column(Integer, nullable=True)
    questionSnapshot: Mapped[str] = mapped_column(Text, nullable=False)
    questionFingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    evidenceFingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    content: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    sourceArticleIds: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    modelName: Mapped[str | None] = mapped_column(String(120), nullable=True)
    generatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    createdByUserId: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updatedByUserId: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)


class SynthesisGenerationJob(Base):
    """Durable generation request; intentionally stores no provider credential."""

    __tablename__ = "synthesis_generation_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'conflict')",
            name="ck_synthesis_generation_jobs_status",
        ),
        CheckConstraint('"attempts" >= 0', name="ck_synthesis_generation_jobs_attempts"),
        Index(
            "uq_synthesis_generation_idempotency",
            "projectId",
            "requesterUserId",
            "idempotencyKey",
            unique=True,
        ),
        Index(
            "uq_synthesis_generation_active_rq",
            "projectId",
            "rqNumber",
            unique=True,
            postgresql_where=text("status IN ('queued', 'running')"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    projectId: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    rqNumber: Mapped[int] = mapped_column(Integer, nullable=False)
    requesterUserId: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    idempotencyKey: Mapped[str] = mapped_column(String(36), nullable=False)
    questionFingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    evidenceFingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    expectedVersion: Mapped[int] = mapped_column(Integer, nullable=False)
    requestSnapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    completedBatches: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    totalBatches: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    workerId: Mapped[str | None] = mapped_column(String(120), nullable=True)
    leaseToken: Mapped[str | None] = mapped_column(String(36), nullable=True)
    leaseExpiresAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelRequestedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resultContent: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    errorCode: Mapped[str | None] = mapped_column(String(80), nullable=True)
    startedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)
