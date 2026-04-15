from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.article import Article
from app.core.dependencies import get_current_user, get_mcp_host, get_graph_mcp_service, get_sql_mcp_service
from app.services.mcp_host_service import MCPHostService
from app.services.rag_service import get_rag_service
from app.services.neo4j_service import Neo4jService
from app.services.postgres_mcp_service import PostgresMCPService
from app.services.qdrant_retrieval_service import get_qdrant_retrieval_service


router = APIRouter()


def _build_anchor_joinability(postgres_metrics: dict, vector_metrics: dict) -> dict:
    postgres_ok = bool(postgres_metrics.get("ok"))
    postgres_with_anchor = postgres_metrics.get("with_anchor", 0) if postgres_ok else 0
    postgres_missing = postgres_metrics.get("missing_anchor", 0) if postgres_ok else 0
    vector_with_anchor = vector_metrics.get("vector_anchor_count", 0)
    vector_missing = vector_metrics.get("vector_missing_anchor_count", 0)
    count_mismatch = postgres_with_anchor != vector_with_anchor

    return {
        "joinable": postgres_ok and postgres_missing == 0 and vector_missing == 0 and not count_mismatch,
        "missingAnchorIndicators": {
            "postgres": postgres_missing,
            "vector": vector_missing,
        },
        "countParity": {
            "postgresAnchoredArticles": postgres_with_anchor,
            "vectorAnchoredPoints": vector_with_anchor,
            "countMismatch": count_mismatch,
        },
    }


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


@router.get("/stats/mcp-services")
async def get_mcp_service_stats(
    current_user: User = Depends(get_current_user),
    host: MCPHostService = Depends(get_mcp_host),
    graph: Neo4jService = Depends(get_graph_mcp_service),
    sql: PostgresMCPService = Depends(get_sql_mcp_service),
):
    """Return graph/sql MCP health details along with host diagnostics."""
    graph_health = await graph.mcp_health()
    sql_health = await sql.mcp_health()
    return {
        "viewerUserId": current_user.id,
        "host": host.diagnostics(),
        "graph": graph_health,
        "sql": sql_health,
    }


@router.get("/stats/anchor-consistency")
async def get_anchor_consistency_stats(
    projectId: int,
    current_user: User = Depends(get_current_user),
    sql: PostgresMCPService = Depends(get_sql_mcp_service),
    db: AsyncSession = Depends(get_db),
):
    """Return paper_id consistency metrics across relational and vector boundaries."""
    project_result = await db.execute(
        select(Project).where(Project.id == projectId, Project.ownerId == current_user.id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Projeto não encontrado",
                "message": "Projeto inexistente ou sem permissão",
            },
        )

    postgres_metrics = await sql.paper_id_counts(project_id=projectId)
    qdrant = get_qdrant_retrieval_service()
    vector_metrics = await qdrant.inspect_anchor_consistency(project_id=projectId)

    joinability = _build_anchor_joinability(postgres_metrics, vector_metrics)

    return {
        "viewerUserId": current_user.id,
        "projectId": projectId,
        "postgres": postgres_metrics,
        "vector": vector_metrics,
        **joinability,
    }


@router.get("/stats/provenance-audit")
async def get_provenance_audit_stats(
    current_user: User = Depends(get_current_user),
    host: MCPHostService = Depends(get_mcp_host),
):
    """Return consolidated provenance and isolation audit signals."""
    rag = get_rag_service()
    rag_diagnostics = rag.diagnostics()
    host_diagnostics = host.diagnostics()
    sources_with_provenance = rag_diagnostics.get("sourcesWithProvenance", 0)
    sources_without_provenance = rag_diagnostics.get("sourcesWithoutProvenance", 0)
    provenance_coverage = (
        sources_with_provenance / (sources_with_provenance + sources_without_provenance)
        if (sources_with_provenance + sources_without_provenance) > 0
        else 1.0
    )
    return {
        "viewerUserId": current_user.id,
        "provenance": {
            "coverage": provenance_coverage,
            "sourcesWithProvenance": sources_with_provenance,
            "sourcesWithoutProvenance": sources_without_provenance,
            "backend": rag_diagnostics.get("backend"),
        },
        "isolation": {
            "scopeDenied": rag_diagnostics.get("scopeDenied", 0),
            "projectScopeEnforced": rag_diagnostics.get("projectScopeEnforced", False),
        },
        "hostAudit": host_diagnostics.get("audit", {}),
    }
