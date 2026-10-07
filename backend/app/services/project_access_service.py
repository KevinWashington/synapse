from dataclasses import dataclass
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.collaboration import ProjectMember
from app.models.project import Project


CAP_READ_PROJECT = "read_project"
CAP_EDIT_PROJECT = "edit_project"
CAP_MANAGE_MEMBERS = "manage_members"
CAP_MANAGE_DISTRIBUTION = "manage_distribution"
CAP_REVIEW_ASSIGNED = "review_assigned"
CAP_RESOLVE_CONFLICTS = "resolve_conflicts"
CAP_REOPEN_REVIEW = "reopen_review"
CAP_DELETE_PROJECT = "delete_project"
CAP_TRANSFER_OWNERSHIP = "transfer_ownership"

Role = Literal["owner", "coordinator", "reviewer"]

READ = frozenset({CAP_READ_PROJECT})
COORDINATE = frozenset(
    {
        CAP_READ_PROJECT,
        CAP_EDIT_PROJECT,
        CAP_MANAGE_MEMBERS,
        CAP_MANAGE_DISTRIBUTION,
        CAP_RESOLVE_CONFLICTS,
        CAP_REOPEN_REVIEW,
    }
)
OWNER = COORDINATE | frozenset({CAP_REVIEW_ASSIGNED, CAP_DELETE_PROJECT, CAP_TRANSFER_OWNERSHIP})


@dataclass(frozen=True)
class ProjectAccess:
    project: Project
    role: Role
    capabilities: frozenset[str]
    participates_in_review: bool


def capabilities_for_role(
    role: Role,
    *,
    participates_in_review: bool,
    active: bool = True,
) -> frozenset[str]:
    if not active:
        return frozenset()
    if role == "owner":
        return OWNER
    if role == "coordinator":
        return COORDINATE | (frozenset({CAP_REVIEW_ASSIGNED}) if participates_in_review else frozenset())
    return READ | frozenset({CAP_REVIEW_ASSIGNED})


def _project_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "PROJECT_NOT_FOUND", "message": "Projeto não encontrado."},
    )


def accessible_project_ids_query(user_id: int):
    return (
        select(Project.id)
        .outerjoin(
            ProjectMember,
            (ProjectMember.projectId == Project.id)
            & (ProjectMember.userId == user_id)
            & (ProjectMember.status == "active"),
        )
        .where(or_(Project.ownerId == user_id, ProjectMember.id.is_not(None)))
        .distinct()
    )


async def resolve_project_access(
    db: AsyncSession,
    *,
    project_id: int,
    user_id: int,
) -> ProjectAccess:
    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if project is None:
        raise _project_not_found()
    if project.ownerId == user_id:
        return ProjectAccess(project, "owner", OWNER, True)

    member_result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.projectId == project_id,
            ProjectMember.userId == user_id,
            ProjectMember.status == "active",
        )
    )
    member = member_result.scalar_one_or_none()
    if member is None or member.status != "active":
        raise _project_not_found()
    capabilities = capabilities_for_role(
        member.role,
        participates_in_review=member.participatesInReview,
    )
    return ProjectAccess(
        project,
        member.role,
        capabilities,
        member.participatesInReview,
    )


def require_capability(access: ProjectAccess, capability: str) -> None:
    if capability not in access.capabilities:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "PROJECT_PERMISSION_DENIED",
                "message": "Você não possui permissão para esta ação.",
            },
        )


async def get_project_article(
    db: AsyncSession,
    *,
    project_id: int,
    article_id: int,
) -> Article:
    result = await db.execute(
        select(Article).where(Article.id == article_id, Article.projectId == project_id)
    )
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ARTICLE_NOT_FOUND", "message": "Artigo não encontrado."},
        )
    return article
