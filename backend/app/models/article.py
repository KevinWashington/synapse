from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, LargeBinary, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# Association table for article relationships (many-to-many self-referential)
article_relationships = Table(
    "article_relationships",
    Base.metadata,
    Column("article_id", Integer, ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True),
    Column("related_article_id", Integer, ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True)
)


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    authors: Mapped[str] = mapped_column(String(300), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    journal: Mapped[str] = mapped_column(String(200), nullable=False)
    
    # Optional fields
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
    pdf_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pdf_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    pdf_content_type: Mapped[str] = mapped_column(String(50), default="application/pdf")
    
    # Foreign keys
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="articles")
    owner: Mapped["User"] = relationship(back_populates="articles")
    
    # Self-referential many-to-many for related articles
    related_articles: Mapped[list["Article"]] = relationship(
        secondary=article_relationships,
        primaryjoin=id == article_relationships.c.article_id,
        secondaryjoin=id == article_relationships.c.related_article_id,
        backref="related_by"
    )

    def __repr__(self):
        return f"<Article {self.title[:50]}>"
