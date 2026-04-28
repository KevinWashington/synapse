from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.article import Article
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectOverviewActivity,
    ProjectOverviewEvolutionPoint,
    ProjectOverviewPlanningSummary,
    ProjectOverviewResponse,
    ProjectOverviewReviewerAgreement,
    ProjectOverviewSource,
    ProjectOverviewStudyType,
    ProjectPrismaStats,
)
from app.core.dependencies import get_current_user
from app.frameworks import FRAMEWORK_INFO, FRAMEWORK_COMPONENTS, FrameworkType
from app.services.evidence_service import (
    recalculate_project_article_quality,
    sanitize_data_extraction_schema,
    sanitize_quality_assessment_schema,
)


router = APIRouter()


def _build_prisma_stats(articles: list[Article]) -> ProjectPrismaStats:
    screening_outcomes = {
        "excluded_screening",
        "excluded_eligibility",
        "full_text_unavailable",
        "included",
    }
    eligibility_outcomes = {
        "excluded_eligibility",
        "full_text_unavailable",
        "included",
    }

    return ProjectPrismaStats(
        identified=len(articles),
        screening=sum(
            1
            for article in articles
            if article.currentPhase in {"screening", "eligibility", "included"}
            or article.reviewOutcome in screening_outcomes
        ),
        eligible=sum(
            1
            for article in articles
            if article.currentPhase in {"eligibility", "included"}
            or article.reviewOutcome in eligibility_outcomes
        ),
        included=sum(1 for article in articles if article.reviewOutcome == "included"),
    )


def _build_project_response(project: Project, articles: list[Article] | None = None) -> ProjectResponse:
    project_articles = articles or []
    response_data = ProjectResponse.model_validate(project).model_dump()
    response_data["articleCount"] = len(project_articles)
    response_data["prismaStats"] = _build_prisma_stats(project_articles)
    return ProjectResponse(**response_data)


def _format_source_breakdown(articles: list[Article]) -> list[ProjectOverviewSource]:
    source_map: dict[tuple[str, str], dict] = {}
    for article in articles:
        key = (article.sourceCategory, article.sourceName)
        item = source_map.setdefault(
            key,
            {
                "sourceCategory": article.sourceCategory,
                "sourceName": article.sourceName,
                "total": 0,
                "included": 0,
                "duplicatesRemoved": 0,
                "excluded": 0,
            },
        )
        item["total"] += 1
        if article.reviewOutcome == "included":
            item["included"] += 1
        elif article.reviewOutcome == "duplicate_removed":
            item["duplicatesRemoved"] += 1
        elif article.reviewOutcome in {"excluded_screening", "excluded_eligibility", "full_text_unavailable"}:
            item["excluded"] += 1

    return [
        ProjectOverviewSource(**item)
        for item in sorted(source_map.values(), key=lambda value: (-value["total"], value["sourceName"]))
    ]


def _build_study_type_distribution(articles: list[Article]) -> list[ProjectOverviewStudyType]:
    label_map = {
        "journal_article": "Artigos de periodico",
        "conference_paper": "Conferencias",
        "review": "Revisoes",
        "thesis": "Teses",
        "book_chapter": "Capitulos de livro",
        "other": "Outros",
    }
    typed_articles = [article for article in articles if getattr(article, "studyType", None)]
    total = len(typed_articles)
    if total == 0:
        return []

    count_map: dict[str, int] = {}
    for article in typed_articles:
        label = label_map.get(article.studyType, article.studyType)
        count_map[label] = count_map.get(label, 0) + 1

    return [
        ProjectOverviewStudyType(
            label=label,
            total=count,
            percentage=round((count / total) * 100, 1),
        )
        for label, count in sorted(count_map.items(), key=lambda item: (-item[1], item[0]))
    ]


def _date_key(value) -> str | None:
    return value.date().isoformat() if value else None


def _stage_date_key(article: Article, *timestamps) -> str | None:
    return next(
        (date for date in (_date_key(timestamp) for timestamp in timestamps) if date),
        _date_key(article.createdAt),
    )


def _build_stage_evolution(articles: list[Article]) -> list[ProjectOverviewEvolutionPoint]:
    event_dates = {
        _date_key(article.createdAt)
        for article in articles
        if article.createdAt
    }
    event_dates.update(
        _date_key(timestamp)
        for article in articles
        for timestamp in (article.screeningReviewedAt, article.eligibilityReviewedAt, article.includedAt)
        if timestamp
    )
    dates = sorted(date for date in event_dates if date)[-10:]

    points = []
    for date in dates:
        points.append(
            ProjectOverviewEvolutionPoint(
                date=date,
                identification=sum(1 for article in articles if _date_key(article.createdAt) and _date_key(article.createdAt) <= date),
                screening=sum(
                    1
                    for article in articles
                    if article.currentPhase in {"screening", "eligibility", "included"}
                    and _stage_date_key(article, article.screeningReviewedAt, article.updatedAt) <= date
                ),
                eligibility=sum(
                    1
                    for article in articles
                    if article.currentPhase in {"eligibility", "included"}
                    and _stage_date_key(article, article.eligibilityReviewedAt, article.updatedAt) <= date
                ),
                included=sum(1 for article in articles if _date_key(article.includedAt) and _date_key(article.includedAt) <= date),
            )
        )

    return points


def _build_reviewer_agreement(articles: list[Article]) -> ProjectOverviewReviewerAgreement:
    reviewed_pairs = [
        article
        for article in articles
        if article.aiSuggestedStatus in {"incluido", "excluido"}
        and article.manualDecision in {"incluido", "excluido"}
    ]
    reviewed = len(reviewed_pairs)
    agreed = sum(1 for article in reviewed_pairs if article.aiSuggestedStatus == article.manualDecision)

    return ProjectOverviewReviewerAgreement(
        reviewed=reviewed,
        agreed=agreed,
        rate=round((agreed / reviewed) * 100, 1) if reviewed else None,
    )


def _build_recent_activities(articles: list[Article]) -> list[ProjectOverviewActivity]:
    activities: list[ProjectOverviewActivity] = []
    for article in articles:
        if article.includedAt:
            activities.append(ProjectOverviewActivity(
                id=f"included-{article.id}",
                type="included",
                label="Artigo incluido",
                description=article.title,
                timestamp=article.includedAt,
                articleId=article.id,
            ))
        if article.eligibilityReviewedAt:
            activities.append(ProjectOverviewActivity(
                id=f"eligibility-{article.id}",
                type="eligibility",
                label="Elegibilidade registrada",
                description=article.title,
                timestamp=article.eligibilityReviewedAt,
                articleId=article.id,
            ))
        if article.screeningReviewedAt:
            activities.append(ProjectOverviewActivity(
                id=f"screening-{article.id}",
                type="screening",
                label="Triagem registrada",
                description=article.title,
                timestamp=article.screeningReviewedAt,
                articleId=article.id,
            ))
        activities.append(ProjectOverviewActivity(
            id=f"created-{article.id}",
            type="created",
            label="Artigo adicionado",
            description=article.title,
            timestamp=article.createdAt,
            articleId=article.id,
        ))

    return sorted(activities, key=lambda activity: activity.timestamp, reverse=True)[:6]


def _build_project_overview(project: Project, articles: list[Article]) -> ProjectOverviewResponse:
    return ProjectOverviewResponse(
        projectId=project.id,
        prismaStats=_build_prisma_stats(articles),
        sources=_format_source_breakdown(articles),
        studyTypes=_build_study_type_distribution(articles),
        evolution=_build_stage_evolution(articles),
        reviewerAgreement=_build_reviewer_agreement(articles),
        recentActivities=_build_recent_activities(articles),
        planningSummary=ProjectOverviewPlanningSummary(
            framework=project.framework,
            researchQuestionCount=len(project.researchQuestions or []),
            searchStringCount=len(project.searchStrings or []),
            inclusionCriteriaCount=len(project.criteriosInclusao or []),
            exclusionCriteriaCount=len(project.criteriosExclusao or []),
            eligibilityChecklistCount=len(project.eligibilityChecklist or []),
            extractionFieldCount=len(project.dataExtractionSchema or []),
            qualityCriteriaCount=len(project.qualityAssessmentSchema or []),
            lastUpdatedAt=project.updatedAt,
        ),
    )


@router.get("/frameworks")
async def get_frameworks():
    """Retorna a lista de frameworks disponíveis com descrições e áreas recomendadas."""
    return {
        "frameworks": [
            {
                **FRAMEWORK_INFO[fw.value],
                "components": FRAMEWORK_COMPONENTS[fw.value],
            }
            for fw in FrameworkType
        ]
    }


@router.get("", response_model=ProjectListResponse)
async def get_all_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Listar projetos do usuário logado."""
    result = await db.execute(
        select(Project)
        .where(Project.ownerId == current_user.id)
        .order_by(Project.createdAt.desc())
    )
    projects = result.scalars().all()

    if not projects:
        return ProjectListResponse(projects=[], total=0)

    articles_result = await db.execute(
        select(Article).where(Article.projectId.in_([project.id for project in projects]))
    )
    articles_by_project: dict[int, list[Article]] = {project.id: [] for project in projects}
    for article in articles_result.scalars().all():
        articles_by_project.setdefault(article.projectId, []).append(article)
    
    projectsWithCount = [
        _build_project_response(project, articles_by_project.get(project.id, []))
        for project in projects
    ]
    
    return ProjectListResponse(projects=projectsWithCount, total=len(projectsWithCount))


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Criar novo projeto."""
    project = Project(
        title=data.title,
        objetivo=data.objetivo,
        status=data.status,
        framework=data.framework or "PICOC",
        picoc=data.picoc.model_dump() if data.picoc else {},
        researchQuestions=data.researchQuestions or [],
        keywords=data.keywords or [],
        searchStrings=data.searchStrings or [],
        criteriosInclusao=data.criteriosInclusao or [],
        criteriosExclusao=data.criteriosExclusao or [],
        eligibilityChecklist=data.eligibilityChecklist or [],
        dataExtractionSchema=sanitize_data_extraction_schema(data.dataExtractionSchema or []),
        qualityAssessmentSchema=sanitize_quality_assessment_schema(data.qualityAssessmentSchema or []),
        screeningGuidance=data.screeningGuidance,
        selectionReportNotes=data.selectionReportNotes,
        ownerId=current_user.id
    )
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    return ProjectResponse.model_validate(project)


@router.get("/{projectId}", response_model=ProjectResponse)
async def get_project_by_id(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Buscar projeto específico."""
    result = await db.execute(
        select(Project).where(
            Project.id == projectId,
            Project.ownerId == current_user.id
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Projeto não encontrado",
                "message": "Projeto inexistente ou você não tem permissão para acessá-lo"
            }
        )
    
    articles_result = await db.execute(
        select(Article).where(Article.projectId == project.id)
    )
    return _build_project_response(project, articles_result.scalars().all())


@router.get("/{projectId}/overview", response_model=ProjectOverviewResponse)
async def get_project_overview(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resumo operacional da visao geral do projeto."""
    result = await db.execute(
        select(Project).where(
            Project.id == projectId,
            Project.ownerId == current_user.id
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Projeto nao encontrado",
                "message": "Projeto inexistente ou voce nao tem permissao para acessa-lo"
            }
        )

    articles_result = await db.execute(
        select(Article).where(
            Article.projectId == project.id,
            Article.ownerId == current_user.id,
        )
    )
    return _build_project_overview(project, articles_result.scalars().all())


@router.put("/{projectId}", response_model=ProjectResponse)
async def update_project(
    projectId: int,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Atualizar projeto."""
    result = await db.execute(
        select(Project).where(
            Project.id == projectId,
            Project.ownerId == current_user.id
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Projeto não encontrado",
                "message": "Projeto inexistente ou você não tem permissão para acessá-lo"
            }
        )
    
    # Update only provided fields
    updateData = data.model_dump(exclude_unset=True)
    quality_schema_changed = False
    for field, value in updateData.items():
        if field == "picoc" and value:
            setattr(project, field, value.model_dump() if hasattr(value, 'model_dump') else value)
        elif field == "dataExtractionSchema":
            project.dataExtractionSchema = sanitize_data_extraction_schema(value)
        elif field == "qualityAssessmentSchema":
            project.qualityAssessmentSchema = sanitize_quality_assessment_schema(value)
            quality_schema_changed = True
        else:
            setattr(project, field, value)

    if quality_schema_changed:
        articles_result = await db.execute(
            select(Article).where(Article.projectId == projectId, Article.ownerId == current_user.id)
        )
        recalculate_project_article_quality(
            articles_result.scalars().all(),
            project.qualityAssessmentSchema or [],
        )

    await db.commit()
    await db.refresh(project)
    
    articles_result = await db.execute(
        select(Article).where(Article.projectId == project.id)
    )
    return _build_project_response(project, articles_result.scalars().all())


@router.delete("/{projectId}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletar projeto."""
    result = await db.execute(
        select(Project).where(
            Project.id == projectId,
            Project.ownerId == current_user.id
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Projeto não encontrado",
                "message": "Projeto inexistente ou você não tem permissão para acessá-lo"
            }
        )
    
    await db.delete(project)
    await db.commit()
    
    return None
