from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.article import Article
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
)
from app.core.dependencies import get_current_user


router = APIRouter()


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
    
    # Get article count for each project
    projectsWithCount = []
    for project in projects:
        count_result = await db.execute(
            select(func.count(Article.id)).where(Article.projectId == project.id)
        )
        articleCount = count_result.scalar()
        projectResponse = ProjectResponse.model_validate(project).model_dump()
        projectResponse["articleCount"] = articleCount
        projectsWithCount.append(ProjectResponse(**projectResponse))
    
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
        picoc=data.picoc.model_dump() if data.picoc else {},
        researchQuestions=data.researchQuestions or [],
        keywords=data.keywords or [],
        searchStrings=data.searchStrings or [],
        criteriosInclusao=data.criteriosInclusao or [],
        criteriosExclusao=data.criteriosExclusao or [],
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
    
    # Get article count
    countResult = await db.execute(
        select(func.count(Article.id)).where(Article.projectId == project.id)
    )
    articleCount = countResult.scalar()
    
    response = ProjectResponse.model_validate(project)
    response.articleCount = articleCount
    
    return response


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
    for field, value in updateData.items():
        if field == "picoc" and value:
            setattr(project, field, value.model_dump() if hasattr(value, 'model_dump') else value)
        else:
            setattr(project, field, value)
    
    await db.commit()
    await db.refresh(project)
    
    return ProjectResponse.model_validate(project)


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
