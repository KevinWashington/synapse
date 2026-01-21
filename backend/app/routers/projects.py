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
        .where(Project.owner_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    
    # Get article count for each project
    projects_with_count = []
    for project in projects:
        count_result = await db.execute(
            select(func.count(Article.id)).where(Article.project_id == project.id)
        )
        article_count = count_result.scalar()
        project_dict = ProjectResponse.model_validate(project).model_dump()
        project_dict["article_count"] = article_count
        projects_with_count.append(ProjectResponse(**project_dict))
    
    return ProjectListResponse(projects=projects_with_count, total=len(projects_with_count))


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
        research_questions=data.research_questions or [],
        keywords=data.keywords or [],
        search_strings=data.search_strings or [],
        criterios_inclusao=data.criterios_inclusao or [],
        criterios_exclusao=data.criterios_exclusao or [],
        owner_id=current_user.id
    )
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project_by_id(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Buscar projeto específico."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id
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
    count_result = await db.execute(
        select(func.count(Article.id)).where(Article.project_id == project.id)
    )
    article_count = count_result.scalar()
    
    response = ProjectResponse.model_validate(project)
    response.article_count = article_count
    
    return response


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Atualizar projeto."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id
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
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "picoc" and value:
            setattr(project, field, value.model_dump() if hasattr(value, 'model_dump') else value)
        else:
            setattr(project, field, value)
    
    await db.commit()
    await db.refresh(project)
    
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletar projeto."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id
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
