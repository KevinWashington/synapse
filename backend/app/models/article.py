from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, LargeBinary, Table, Column, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY
from pgvector.sqlalchemy import Vector

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
    
    # Status
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
    
    # Semantic Embedding (768 dimensions for SPECTER2)
    embedding = mapped_column(Vector(768), nullable=True)
    
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

    def __repr__(self):
        return f"<Article {self.title[:50]}>"
