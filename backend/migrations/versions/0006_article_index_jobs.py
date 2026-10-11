"""Durable article index outbox.

Revision ID: 0006_article_index_jobs
Revises: 0005_evidence_synthesis
"""

import sqlalchemy as sa
from alembic import op

revision = "0006_article_index_jobs"
down_revision = "0005_evidence_synthesis"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "article_index_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("articleId", sa.Integer(), nullable=False),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("nextAttemptAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lastError", sa.String(80)),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completedAt", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "status IN ('queued', 'succeeded', 'failed')", name="ck_article_index_status"
        ),
        sa.CheckConstraint("attempts >= 0", name="ck_article_index_attempts"),
    )
    op.create_index("ix_article_index_pending", "article_index_tasks", ["status", "nextAttemptAt"])
    op.create_index("ix_article_index_tasks_articleId", "article_index_tasks", ["articleId"])
    op.create_index("ix_article_index_tasks_projectId", "article_index_tasks", ["projectId"])


def downgrade():
    op.drop_table("article_index_tasks")
