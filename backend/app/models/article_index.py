"""Durable index projection work, retained after article/project deletion."""

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ArticleIndexTask(Base):
    __tablename__ = "article_index_tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'succeeded', 'failed')", name="ck_article_index_status"
        ),
        CheckConstraint("attempts >= 0", name="ck_article_index_attempts"),
        Index("ix_article_index_pending", "status", "nextAttemptAt"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    articleId: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    projectId: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    nextAttemptAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    lastError: Mapped[str | None] = mapped_column(String(80))
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    completedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
