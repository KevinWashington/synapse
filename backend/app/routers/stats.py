from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.article import Article
from app.core.dependencies import get_current_user


router = APIRouter()


@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obter estatísticas do usuário."""
    user_id = current_user.id
    
    # Total projects
    total_projects = await db.scalar(
        select(func.count(Project.id)).where(Project.owner_id == user_id)
    )
    
    # Total articles
    total_articles = await db.scalar(
        select(func.count(Article.id)).where(Article.owner_id == user_id)
    )
    
    # Reviewed articles
    total_articles_reviewed = await db.scalar(
        select(func.count(Article.id)).where(
            Article.owner_id == user_id,
            Article.status == "analisado"
        )
    )
    
    # Pending articles
    texts_to_review = await db.scalar(
        select(func.count(Article.id)).where(
            Article.owner_id == user_id,
            Article.status == "pendente"
        )
    )
    
    # Articles reviewed today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    texts_reviewed_today = await db.scalar(
        select(func.count(Article.id)).where(
            Article.owner_id == user_id,
            Article.status == "analisado",
            Article.updated_at >= today_start
        )
    )
    
    # Last project
    last_project_result = await db.execute(
        select(Project)
        .where(Project.owner_id == user_id)
        .order_by(Project.created_at.desc())
        .limit(1)
    )
    last_project = last_project_result.scalar_one_or_none()
    
    # Pending articles with project info
    pending_articles_result = await db.execute(
        select(Article, Project.title.label("project_title"))
        .join(Project, Article.project_id == Project.id)
        .where(Article.owner_id == user_id, Article.status == "pendente")
        .order_by(Article.created_at.desc())
        .limit(10)
    )
    pending_articles = [
        {
            "id": article.id,
            "title": article.title,
            "authors": article.authors,
            "year": article.year,
            "project_id": article.project_id,
            "project_title": project_title,
            "created_at": article.created_at.isoformat()
        }
        for article, project_title in pending_articles_result
    ]
    
    # Daily reviews for last 5 days
    daily_reviews = []
    for i in range(4, -1, -1):
        date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        next_date = date + timedelta(days=1)
        
        count = await db.scalar(
            select(func.count(Article.id)).where(
                Article.owner_id == user_id,
                Article.status == "analisado",
                Article.updated_at >= date,
                Article.updated_at < next_date
            )
        )
        
        daily_reviews.append({
            "date": date.strftime("%Y-%m-%d"),
            "count": count or 0,
            "dayName": date.strftime("%a")
        })
    
    # Progress percentage
    progress_percentage = (
        round((total_articles_reviewed / total_articles) * 100)
        if total_articles > 0 else 0
    )
    
    return {
        "totalProjects": total_projects or 0,
        "totalArticles": total_articles or 0,
        "totalArticlesReviewed": total_articles_reviewed or 0,
        "textsReviewedToday": texts_reviewed_today or 0,
        "textsToReview": texts_to_review or 0,
        "lastProject": {
            "id": last_project.id,
            "title": last_project.title,
            "status": last_project.status,
            "created_at": last_project.created_at.isoformat()
        } if last_project else None,
        "progressPercentage": progress_percentage,
        "pendingArticles": pending_articles,
        "dailyReviews": daily_reviews
    }
