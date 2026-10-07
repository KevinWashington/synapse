"""Add project collaboration, assigned reviews, notifications, and audit.

Revision ID: 0003_project_collaboration
Revises: 0002_google_identity_credentials
Create Date: 2026-10-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0003_project_collaboration"
down_revision: Union[str, None] = "0002_google_identity_credentials"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TIMESTAMPS = (
    sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
)


def upgrade() -> None:
    op.create_table(
        "project_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("userId", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("participatesInReview", sa.Boolean(), nullable=False),
        sa.Column("invitedByUserId", sa.Integer(), nullable=True),
        sa.Column("joinedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deactivatedAt", sa.DateTime(timezone=True), nullable=True),
        *TIMESTAMPS,
        sa.CheckConstraint("role IN ('coordinator', 'reviewer')", name="ck_project_members_role"),
        sa.CheckConstraint("status IN ('active', 'inactive')", name="ck_project_members_status"),
        sa.CheckConstraint("role <> 'reviewer' OR \"participatesInReview\"", name="ck_project_members_reviewer_participates"),
        sa.ForeignKeyConstraint(["invitedByUserId"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["projectId"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["userId"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("projectId", "userId", name="uq_project_members_project_user"),
    )
    op.create_index("ix_project_members_projectId", "project_members", ["projectId"])
    op.create_index("ix_project_members_userId", "project_members", ["userId"])

    op.create_table(
        "project_invitations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("emailNormalized", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("participatesInReview", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("invitedByUserId", sa.Integer(), nullable=True),
        sa.Column("expiresAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acceptedAt", sa.DateTime(timezone=True), nullable=True),
        *TIMESTAMPS,
        sa.CheckConstraint("role IN ('coordinator', 'reviewer')", name="ck_project_invitations_role"),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'cancelled', 'expired')", name="ck_project_invitations_status"),
        sa.ForeignKeyConstraint(["invitedByUserId"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["projectId"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_invitations_projectId", "project_invitations", ["projectId"])
    op.create_index("ix_project_invitations_emailNormalized", "project_invitations", ["emailNormalized"])
    op.create_index("uq_project_invitations_pending", "project_invitations", ["projectId", "emailNormalized"], unique=True, postgresql_where=sa.text("status = 'pending'"))

    op.create_table(
        "review_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("articleId", sa.Integer(), nullable=False),
        sa.Column("phase", sa.String(length=20), nullable=False),
        sa.Column("reviewerUserId", sa.Integer(), nullable=False),
        sa.Column("slot", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("assignedByUserId", sa.Integer(), nullable=True),
        sa.Column("inheritedFromAssignmentId", sa.Integer(), nullable=True),
        sa.Column("assignedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submittedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelledAt", sa.DateTime(timezone=True), nullable=True),
        *TIMESTAMPS,
        sa.CheckConstraint("phase IN ('screening', 'eligibility')", name="ck_review_assignments_phase"),
        sa.CheckConstraint("slot IN (1, 2)", name="ck_review_assignments_slot"),
        sa.CheckConstraint("status IN ('pending', 'submitted', 'cancelled', 'needs_reassignment')", name="ck_review_assignments_status"),
        sa.ForeignKeyConstraint(["articleId"], ["articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assignedByUserId"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["inheritedFromAssignmentId"], ["review_assignments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["projectId"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewerUserId"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("articleId", "phase", "reviewerUserId", name="uq_review_assignments_article_phase_reviewer"),
    )
    op.create_index("ix_review_assignments_projectId", "review_assignments", ["projectId"])
    op.create_index("ix_review_assignments_articleId", "review_assignments", ["articleId"])
    op.create_index("ix_review_assignments_reviewerUserId", "review_assignments", ["reviewerUserId"])
    op.create_index("uq_review_assignments_active_slot", "review_assignments", ["articleId", "phase", "slot"], unique=True, postgresql_where=sa.text("status <> 'cancelled'"))

    op.create_table(
        "review_decisions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("assignmentId", sa.Integer(), nullable=False),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("articleId", sa.Integer(), nullable=False),
        sa.Column("phase", sa.String(length=20), nullable=False),
        sa.Column("reviewerUserId", sa.Integer(), nullable=False),
        sa.Column("decision", sa.String(length=50), nullable=False),
        sa.Column("reasonText", sa.Text(), nullable=True),
        sa.Column("checklistAnswers", sa.JSON(), nullable=True),
        sa.Column("answeringRQs", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("submittedAt", sa.DateTime(timezone=True), nullable=True),
        *TIMESTAMPS,
        sa.CheckConstraint("phase IN ('screening', 'eligibility')", name="ck_review_decisions_phase"),
        sa.CheckConstraint("status IN ('draft', 'submitted', 'superseded')", name="ck_review_decisions_status"),
        sa.ForeignKeyConstraint(["articleId"], ["articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assignmentId"], ["review_assignments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["projectId"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewerUserId"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("assignmentId", "projectId", "articleId", "reviewerUserId"):
        op.create_index(f"ix_review_decisions_{column}", "review_decisions", [column])
    op.create_index("uq_review_decisions_current", "review_decisions", ["assignmentId"], unique=True, postgresql_where=sa.text("status IN ('draft', 'submitted')"))

    op.create_table(
        "review_conflicts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("articleId", sa.Integer(), nullable=False),
        sa.Column("phase", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("decisionIds", postgresql.ARRAY(sa.Integer()), nullable=False),
        sa.Column("resolvedDecision", sa.String(length=50), nullable=True),
        sa.Column("resolutionReason", sa.Text(), nullable=True),
        sa.Column("resolvedByUserId", sa.Integer(), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolvedAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updatedAt", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("phase IN ('screening', 'eligibility')", name="ck_review_conflicts_phase"),
        sa.CheckConstraint("status IN ('open', 'resolved')", name="ck_review_conflicts_status"),
        sa.ForeignKeyConstraint(["articleId"], ["articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["projectId"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolvedByUserId"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_review_conflicts_projectId", "review_conflicts", ["projectId"])
    op.create_index("ix_review_conflicts_articleId", "review_conflicts", ["articleId"])
    op.create_index("uq_review_conflicts_open", "review_conflicts", ["articleId", "phase"], unique=True, postgresql_where=sa.text("status = 'open'"))

    op.create_table(
        "project_notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("recipientUserId", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("entityType", sa.String(length=50), nullable=True),
        sa.Column("entityId", sa.Integer(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("readAt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["projectId"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipientUserId"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("projectId", "recipientUserId", "readAt"):
        op.create_index(f"ix_project_notifications_{column}", "project_notifications", [column])

    op.create_table(
        "project_audit_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("projectId", sa.Integer(), nullable=False),
        sa.Column("actorUserId", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("entityType", sa.String(length=50), nullable=False),
        sa.Column("entityId", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actorUserId"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["projectId"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_audit_events_projectId", "project_audit_events", ["projectId"])
    op.create_index("ix_project_audit_events_actorUserId", "project_audit_events", ["actorUserId"])


def downgrade() -> None:
    for table in (
        "project_audit_events",
        "project_notifications",
        "review_conflicts",
        "review_decisions",
        "review_assignments",
        "project_invitations",
        "project_members",
    ):
        op.drop_table(table)
