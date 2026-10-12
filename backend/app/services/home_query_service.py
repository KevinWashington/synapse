"""Bounded home read models; never hydrate article content or PDF columns."""

from sqlalchemy import String, and_, cast, exists, func, literal, or_, select, union_all
from fastapi import HTTPException

from app.models import Article, Project, ProjectMember, ReviewAssignment
from app.services.project_access_service import accessible_project_ids_query


async def get_home_reading(db, *, user_id, project_id, article_id):
    row = (await db.execute(select(
        Article.id, Article.projectId, Article.title, Article.currentPhase,
        Article.reviewOutcome, Project.title.label("projectTitle"),
    ).join(Project, Project.id == Article.projectId).where(
        Article.id == article_id, Article.projectId == project_id,
        Project.id.in_(accessible_project_ids_query(user_id)),
    ))).mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Leitura não encontrada.")
    return {"article": {key: row[key] for key in ("id", "projectId", "title", "currentPhase", "reviewOutcome")}, "project": {"id": project_id, "title": row["projectTitle"]}}


def _personal_tasks(user_id):
    can_review = exists(select(ProjectMember.id).where(
        ProjectMember.projectId == Project.id,
        ProjectMember.userId == user_id,
        ProjectMember.status == "active",
        or_(ProjectMember.role == "reviewer", and_(
            ProjectMember.role == "coordinator", ProjectMember.participatesInReview.is_(True),
        )),
    ))
    return select(
        ReviewAssignment.id.label("assignmentId"), Article.id.label("articleId"),
        Project.id.label("projectId"), Project.title.label("projectTitle"),
        Article.title, Article.year, Article.journal,
        ReviewAssignment.phase, ReviewAssignment.assignedAt,
    ).select_from(ReviewAssignment).join(
        Article, and_(Article.id == ReviewAssignment.articleId, Article.projectId == ReviewAssignment.projectId),
    ).join(Project, Project.id == Article.projectId).where(
        ReviewAssignment.reviewerUserId == user_id,
        ReviewAssignment.status == "pending",
        ReviewAssignment.phase == Article.currentPhase,
        Article.reviewOutcome == "active",
        or_(Project.ownerId == user_id, can_review),
    )


async def get_home_summary(db, *, user_id):
    tasks = _personal_tasks(user_id).subquery()
    rows = (await db.execute(select(tasks.c.phase, func.count()).group_by(tasks.c.phase))).all()
    counts = dict(rows)
    return {"screeningPending": counts.get("screening", 0), "eligibilityPending": counts.get("eligibility", 0)}


async def _page(db, query, *, page, page_size, order):
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(query.order_by(*order).offset((page - 1) * page_size).limit(page_size))
    return {"items": [dict(row) for row in rows.mappings()], "total": total or 0, "page": page, "pageSize": page_size}


async def get_home_tasks(db, *, user_id, phase, page, page_size):
    query = _personal_tasks(user_id).where(ReviewAssignment.phase == phase)
    return await _page(db, query, page=page, page_size=page_size, order=(ReviewAssignment.assignedAt.desc(), ReviewAssignment.id.desc()))


async def get_home_activity(db, *, user_id, page, page_size):
    project_ids = accessible_project_ids_query(user_id)
    branches = []
    for event_type, timestamp in (
        ("created", Article.createdAt), ("screening", Article.screeningReviewedAt),
        ("eligibility", Article.eligibilityReviewedAt), ("included", Article.includedAt),
    ):
        branches.append(select(
            (literal(event_type + ":") + cast(Article.id, String)).label("id"),
            Article.id.label("articleId"), Project.id.label("projectId"),
            Project.title.label("projectTitle"), Article.title,
            Article.currentPhase.label("phase"), literal(event_type).label("type"),
            timestamp.label("timestamp"),
        ).join(Project, Project.id == Article.projectId).where(
            Article.projectId.in_(project_ids), timestamp.is_not(None),
        ))
    events = union_all(*branches).subquery()
    return await _page(db, select(events), page=page, page_size=page_size, order=(events.c.timestamp.desc(), events.c.id.desc()))
