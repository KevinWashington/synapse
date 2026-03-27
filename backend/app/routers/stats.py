from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.article import Article
from app.core.dependencies import get_current_user, get_mcp_host
from app.services.mcp_host_service import MCPHostService
from app.services.rag_service import get_rag_service


router = APIRouter()


@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obter estatísticas do usuário."""
    userId = current_user.id
    
    # Total projects
    totalProjects = await db.scalar(
        select(func.count(Project.id)).where(Project.ownerId == userId)
    )
    
    # Total articles
    totalArticles = await db.scalar(
        select(func.count(Article.id)).where(Article.ownerId == userId)
    )
    
    # Reviewed articles
    totalArticlesReviewed = await db.scalar(
        select(func.count(Article.id)).where(
            Article.ownerId == userId,
            Article.status == "analisado"
        )
    )
    
    # Pending articles
    textsToReview = await db.scalar(
        select(func.count(Article.id)).where(
            Article.ownerId == userId,
            Article.status == "pendente"
        )
    )
    
    # Articles reviewed today
    todayStart = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    textsReviewedToday = await db.scalar(
        select(func.count(Article.id)).where(
            Article.ownerId == userId,
            Article.status == "analisado",
            Article.updatedAt >= todayStart
        )
    )
    
    # Last project
    lastProjectResult = await db.execute(
        select(Project)
        .where(Project.ownerId == userId)
        .order_by(Project.createdAt.desc())
        .limit(1)
    )
    lastProject = lastProjectResult.scalar_one_or_none()
    
    # Pending articles with project info
    pendingArticlesResult = await db.execute(
        select(Article, Project.title.label("project_title"))
        .join(Project, Article.projectId == Project.id)
        .where(Article.ownerId == userId, Article.status == "pendente")
        .order_by(Article.createdAt.desc())
        .limit(10)
    )
    pendingArticles = [
        {
            "id": article.id,
            "title": article.title,
            "authors": article.authors,
            "year": article.year,
            "projectId": article.projectId,
            "projectTitle": projectTitle,
            "createdAt": article.createdAt.isoformat()
        }
        for article, projectTitle in pendingArticlesResult
    ]
    
    # Daily reviews for last 5 days
    dailyReviews = []
    for i in range(4, -1, -1):
        date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        next_date = date + timedelta(days=1)
        
        count = await db.scalar(
            select(func.count(Article.id)).where(
                Article.ownerId == userId,
                Article.status == "analisado",
                Article.updatedAt >= date,
                Article.updatedAt < next_date
            )
        )
        
        dailyReviews.append({
            "date": date.strftime("%Y-%m-%d"),
            "count": count or 0,
            "dayName": date.strftime("%a")
        })
    
    # Progress percentage
    progressPercentage = (
        round((totalArticlesReviewed / totalArticles) * 100)
        if totalArticles > 0 else 0
    )
    
    return {
        "totalProjects": totalProjects or 0,
        "totalArticles": totalArticles or 0,
        "totalArticlesReviewed": totalArticlesReviewed or 0,
        "textsReviewedToday": textsReviewedToday or 0,
        "textsToReview": textsToReview or 0,
        "lastProject": {
            "id": lastProject.id,
            "title": lastProject.title,
            "status": lastProject.status,
            "created_at": lastProject.createdAt.isoformat()
        } if lastProject else None,
        "progressPercentage": progressPercentage,
        "pendingArticles": pendingArticles,
        "dailyReviews": dailyReviews
    }


@router.get("/stats/mcp-host")
async def get_mcp_host_stats(
    current_user: User = Depends(get_current_user),
    host: MCPHostService = Depends(get_mcp_host),
):
    """Return MCP host diagnostics for registered local servers."""
    return {
        "viewerUserId": current_user.id,
        "diagnostics": host.diagnostics(),
    }


@router.get("/stats/retrieval")
async def get_retrieval_stats(
    current_user: User = Depends(get_current_user),
):
    """Return retrieval backend diagnostics and isolation counters."""
    rag = get_rag_service()
    return {
        "viewerUserId": current_user.id,
        "diagnostics": rag.diagnostics(),
    }
