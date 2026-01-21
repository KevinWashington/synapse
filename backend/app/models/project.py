from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    objetivo: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ideia")
    
    # PICOC fields stored as JSON for flexibility
    picoc: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    
    # Arrays stored as PostgreSQL ARRAY type
    research_questions: Mapped[list[str] | None] = mapped_column(ARRAY(Text), default=list)
    keywords: Mapped[list[str] | None] = mapped_column(ARRAY(String(100)), default=list)
    search_strings: Mapped[list[str] | None] = mapped_column(ARRAY(Text), default=list)
    criterios_inclusao: Mapped[list[str] | None] = mapped_column(ARRAY(Text), default=list)
    criterios_exclusao: Mapped[list[str] | None] = mapped_column(ARRAY(Text), default=list)
    
    # Foreign key
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="projects")
    articles: Mapped[list["Article"]] = relationship(back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project {self.title}>"
