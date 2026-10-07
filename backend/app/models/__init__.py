"""SQLAlchemy models exported for metadata discovery."""

from app.models.article import Article
from app.models.collaboration import (
    ProjectAuditEvent,
    ProjectInvitation,
    ProjectMember,
    ProjectNotification,
    ReviewAssignment,
    ReviewConflict,
    ReviewDecision,
)
from app.models.project import Project
from app.models.user import User

__all__ = [
    "Article",
    "Project",
    "ProjectAuditEvent",
    "ProjectInvitation",
    "ProjectMember",
    "ProjectNotification",
    "ReviewAssignment",
    "ReviewConflict",
    "ReviewDecision",
    "User",
]
