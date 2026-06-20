from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, LargeBinary, Table, Column, Index, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY

from app.database import Base


# Association table for article relationships (many-to-many self-referential)
articleRelationships = Table(
    "articleRelationships",
    Base.metadata,
    Column("articleId", Integer, ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True),
    Column("relatedArticleId", Integer, ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True)
)


class Article(Base):
    __tablename__ = "articles"
    __table_args__ = (
        Index("idx_articles_project_paperid", "projectId", "paperId"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    authors: Mapped[str] = mapped_column(String(300), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    journal: Mapped[str] = mapped_column(String(200), nullable=False)
    
    # Optional fields
    paperId: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    doi: Mapped[str | None] = mapped_column(String(100), nullable=True)
    abstract: Mapped[str | None] = mapped_column(Text, nullable=True)
    keywords: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pages: Mapped[str | None] = mapped_column(String(50), nullable=True)
    volume: Mapped[str | None] = mapped_column(String(50), nullable=True)
    number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issn: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Selection workflow
    entryMethod: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    sourceCategory: Mapped[str] = mapped_column(String(30), default="manual_other", nullable=False)
    sourceName: Mapped[str] = mapped_column(String(120), nullable=False, default="Manual")
    importBatchLabel: Mapped[str | None] = mapped_column(String(120), nullable=True)
    studyType: Mapped[str | None] = mapped_column(String(50), nullable=True)

    currentPhase: Mapped[str] = mapped_column(String(30), default="identification", nullable=False)
    reviewOutcome: Mapped[str] = mapped_column(String(40), default="active", nullable=False)

    duplicateGroupKey: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    duplicateOfArticleId: Mapped[int | None] = mapped_column(ForeignKey("articles.id"), nullable=True)
    duplicateReasonCode: Mapped[str | None] = mapped_column(String(40), nullable=True)
    duplicateReasonText: Mapped[str | None] = mapped_column(Text, nullable=True)

    screeningDecision: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    screeningReasonText: Mapped[str | None] = mapped_column(Text, nullable=True)
    screeningReviewedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    fullTextStatus: Mapped[str] = mapped_column(String(30), default="not_requested", nullable=False)
    eligibilityDecision: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    eligibilityReasonText: Mapped[str | None] = mapped_column(Text, nullable=True)
    eligibilityReviewedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    eligibilityChecklistAnswers: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    extractionData: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    extractionCompletedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    qualityAssessmentAnswers: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    qualityScore: Mapped[float | None] = mapped_column(Float, nullable=True)
    qualityRating: Mapped[str | None] = mapped_column(String(20), nullable=True, default="unrated")
    includedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Compatibility status for legacy views/services.
    status: Mapped[str] = mapped_column(String(20), default="pendente")
    
    # PDF storage (binary in DB - can be moved to filesystem later)
    pdfFilename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pdfData: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    pdfContentType: Mapped[str] = mapped_column(String(50), default="application/pdf")

    # AI Evaluation
    aiEvaluation: Mapped[str | None] = mapped_column(Text, nullable=True)
    aiSuggestedStatus: Mapped[str | None] = mapped_column(String(20), nullable=True)
    aiRelevanceScore: Mapped[int | None] = mapped_column(Integer, nullable=True)
    aiSuggestedRQs: Mapped[list[int] | None] = mapped_column(ARRAY(Integer), default=list)

    # Screening decisions and traceability
    manualDecision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    manualDecisionReason: Mapped[str | None] = mapped_column(Text, nullable=True)
    exclusionCriteria: Mapped[list[str] | None] = mapped_column(ARRAY(Text), default=list)
    answeringRQs: Mapped[list[int] | None] = mapped_column(ARRAY(Integer), default=list)
    decisionUpdatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # AI Extracted Metadata (for graph relationships)
    aiMethodology: Mapped[str | None] = mapped_column(String(100), nullable=True)
    aiDatabase: Mapped[str | None] = mapped_column(String(100), nullable=True)
    aiDomain: Mapped[str | None] = mapped_column(String(100), nullable=True)
    aiKeywords: Mapped[list[str] | None] = mapped_column(ARRAY(String(50)), nullable=True)
    
    # Foreign keys
    projectId: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    ownerId: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Timestamps
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="articles")
    owner: Mapped["User"] = relationship(back_populates="articles")
    
    # Self-referential many-to-many for related articles
    relatedArticles: Mapped[list["Article"]] = relationship(
        secondary=articleRelationships,
        primaryjoin=id == articleRelationships.c.articleId,
        secondaryjoin=id == articleRelationships.c.relatedArticleId,
        backref="relatedBy"
    )
    duplicateOf: Mapped["Article"] = relationship(
        remote_side=[id],
        foreign_keys=[duplicateOfArticleId],
        backref="duplicateChildren",
    )

    def __repr__(self):
        return f"<Article {self.title[:50]}>"
