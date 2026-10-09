from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("projectId", "userId", name="uq_project_members_project_user"),
        CheckConstraint("role IN ('coordinator', 'reviewer')", name="ck_project_members_role"),
        CheckConstraint("status IN ('active', 'inactive')", name="ck_project_members_status"),
        CheckConstraint("role <> 'reviewer' OR \"participatesInReview\"", name="ck_project_members_reviewer_participates"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    projectId: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    userId: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="active")
    participatesInReview: Mapped[bool] = mapped_column(Boolean, default=True)
    invitedByUserId: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    joinedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    deactivatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ProjectInvitation(Base):
    __tablename__ = "project_invitations"
    __table_args__ = (
        CheckConstraint("role IN ('coordinator', 'reviewer')", name="ck_project_invitations_role"),
        CheckConstraint("status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')", name="ck_project_invitations_status"),
        Index(
            "uq_project_invitations_pending",
            "projectId",
            "emailNormalized",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    projectId: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    emailNormalized: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(20))
    participatesInReview: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    invitedByUserId: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    expiresAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    acceptedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    declinedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ReviewAssignment(Base):
    __tablename__ = "review_assignments"
    __table_args__ = (
        UniqueConstraint("articleId", "phase", "reviewerUserId", name="uq_review_assignments_article_phase_reviewer"),
        CheckConstraint("phase IN ('screening', 'eligibility')", name="ck_review_assignments_phase"),
        CheckConstraint("slot IN (1, 2)", name="ck_review_assignments_slot"),
        CheckConstraint("status IN ('pending', 'submitted', 'cancelled', 'needs_reassignment')", name="ck_review_assignments_status"),
        Index(
            "uq_review_assignments_active_slot",
            "articleId",
            "phase",
            "slot",
            unique=True,
            postgresql_where=text("status <> 'cancelled'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    projectId: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    articleId: Mapped[int] = mapped_column(ForeignKey("articles.id", ondelete="CASCADE"), index=True)
    phase: Mapped[str] = mapped_column(String(20))
    reviewerUserId: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    slot: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    assignedByUserId: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    inheritedFromAssignmentId: Mapped[int | None] = mapped_column(ForeignKey("review_assignments.id", ondelete="SET NULL"))
    assignedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    submittedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelledAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ReviewDecision(Base):
    __tablename__ = "review_decisions"
    __table_args__ = (
        CheckConstraint("phase IN ('screening', 'eligibility')", name="ck_review_decisions_phase"),
        CheckConstraint("status IN ('draft', 'submitted', 'superseded')", name="ck_review_decisions_status"),
        Index(
            "uq_review_decisions_current",
            "assignmentId",
            unique=True,
            postgresql_where=text("status IN ('draft', 'submitted')"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    assignmentId: Mapped[int] = mapped_column(ForeignKey("review_assignments.id", ondelete="CASCADE"), index=True)
    projectId: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    articleId: Mapped[int] = mapped_column(ForeignKey("articles.id", ondelete="CASCADE"), index=True)
    phase: Mapped[str] = mapped_column(String(20))
    reviewerUserId: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    decision: Mapped[str] = mapped_column(String(50))
    reasonText: Mapped[str | None] = mapped_column(Text)
    checklistAnswers: Mapped[dict | list | None] = mapped_column(JSON)
    answeringRQs: Mapped[list | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    submittedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ReviewConflict(Base):
    __tablename__ = "review_conflicts"
    __table_args__ = (
        CheckConstraint("phase IN ('screening', 'eligibility')", name="ck_review_conflicts_phase"),
        CheckConstraint("status IN ('open', 'resolved')", name="ck_review_conflicts_status"),
        Index(
            "uq_review_conflicts_open",
            "articleId",
            "phase",
            unique=True,
            postgresql_where=text("status = 'open'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    projectId: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    articleId: Mapped[int] = mapped_column(ForeignKey("articles.id", ondelete="CASCADE"), index=True)
    phase: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="open")
    decisionIds: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list)
    resolvedDecision: Mapped[str | None] = mapped_column(String(50))
    resolutionReason: Mapped[str | None] = mapped_column(Text)
    resolvedByUserId: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    resolvedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ProjectNotification(Base):
    __tablename__ = "project_notifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    projectId: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    recipientUserId: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    entityType: Mapped[str | None] = mapped_column(String(50))
    entityId: Mapped[int | None] = mapped_column(Integer)
    payload: Mapped[dict | None] = mapped_column(JSON)
    readAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ProjectAuditEvent(Base):
    __tablename__ = "project_audit_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    projectId: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    actorUserId: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(80))
    entityType: Mapped[str] = mapped_column(String(50))
    entityId: Mapped[int | None] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict | None] = mapped_column(JSON)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
