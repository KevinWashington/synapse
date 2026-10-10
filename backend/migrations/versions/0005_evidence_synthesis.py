"""Persist research question syntheses and durable generation jobs.

Revision ID: 0005_evidence_synthesis
Revises: 0004_inbox_invite_consent
Create Date: 2026-10-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_evidence_synthesis"
down_revision: Union[str, None] = "0004_inbox_invite_consent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rq_syntheses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("rqNumber", sa.Integer(), nullable=True),
        sa.Column("questionSnapshot", sa.Text(), nullable=False),
        sa.Column("questionFingerprint", sa.String(length=64), nullable=False),
        sa.Column("evidenceFingerprint", sa.String(length=64), nullable=True),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("sourceArticleIds", sa.JSON(), nullable=False),
        sa.Column("modelName", sa.String(length=120), nullable=True),
        sa.Column("generatedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("createdByUserId", sa.Integer(), nullable=True),
        sa.Column("updatedByUserId", sa.Integer(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('"rqNumber" IS NULL OR "rqNumber" > 0', name="ck_rq_syntheses_positive_rq"),
        sa.CheckConstraint('"version" > 0', name="ck_rq_syntheses_positive_version"),
        sa.ForeignKeyConstraint(["projectId"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["createdByUserId"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updatedByUserId"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_synthesis_project_rq_active",
        "rq_syntheses",
        ["projectId", "rqNumber"],
        unique=True,
        postgresql_where=sa.text('"rqNumber" IS NOT NULL'),
    )

    op.create_table(
        "synthesis_generation_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("rqNumber", sa.Integer(), nullable=False),
        sa.Column("requesterUserId", sa.Integer(), nullable=False),
        sa.Column("idempotencyKey", sa.String(length=36), nullable=False),
        sa.Column("questionFingerprint", sa.String(length=64), nullable=False),
        sa.Column("evidenceFingerprint", sa.String(length=64), nullable=False),
        sa.Column("expectedVersion", sa.Integer(), nullable=False),
        sa.Column("requestSnapshot", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("completedBatches", sa.Integer(), nullable=False),
        sa.Column("totalBatches", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("workerId", sa.String(length=120), nullable=True),
        sa.Column("leaseToken", sa.String(length=36), nullable=True),
        sa.Column("leaseExpiresAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelRequestedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resultContent", sa.JSON(), nullable=True),
        sa.Column("errorCode", sa.String(length=80), nullable=True),
        sa.Column("startedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'conflict')",
            name="ck_synthesis_generation_jobs_status",
        ),
        sa.CheckConstraint('"attempts" >= 0', name="ck_synthesis_generation_jobs_attempts"),
        sa.ForeignKeyConstraint(["projectId"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requesterUserId"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_synthesis_generation_idempotency",
        "synthesis_generation_jobs",
        ["projectId", "requesterUserId", "idempotencyKey"],
        unique=True,
    )
    op.create_index(
        "uq_synthesis_generation_active_rq",
        "synthesis_generation_jobs",
        ["projectId", "rqNumber"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'running')"),
    )


def downgrade() -> None:
    op.drop_table("synthesis_generation_jobs")
    op.drop_table("rq_syntheses")
