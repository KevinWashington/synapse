from datetime import datetime
from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "uq_users_google_sub_not_null",
            "googleSub",
            unique=True,
            postgresql_where=text('"googleSub" IS NOT NULL'),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    passwordHash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    googleSub: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deepseekKeyCiphertext: Mapped[str | None] = mapped_column(Text, nullable=True)
    deepseekKeyVersion: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deepseekKeyLastFour: Mapped[str | None] = mapped_column(String(4), nullable=True)
    deepseekKeyUpdatedAt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="user")
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    lastLogin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow
    )

    # Relationships
    projects: Mapped[list["Project"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    articles: Mapped[list["Article"]] = relationship(back_populates="owner", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"
