from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.article import Article
from app.schemas.article import (
    ArticleCreate,
    ArticleUpdate,
    ArticleStatusUpdate,
    ArticleNotesUpdate,
    ArticleResponse,
    ArticleListResponse,
    RelationshipCreate,
)
from app.core.dependencies import get_current_user


router = APIRouter()


async def get_project_or_404(project_id: int, user_id: int, db: AsyncSession) -> Project:
    """Helper to get project or raise 404."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == user_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Projeto não encontrado", "message": "Projeto inexistente ou sem permissão"}
        )
    return project


async def get_article_or_404(article_id: int, project_id: int, user_id: int, db: AsyncSession) -> Article:
    """Helper to get article or raise 404."""
    result = await db.execute(
        select(Article).where(
            Article.id == article_id,
            Article.project_id == project_id,
            Article.owner_id == user_id
        )
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Artigo não encontrado", "message": "Artigo inexistente ou sem permissão"}
        )
    return article


@router.get("/{project_id}/artigos", response_model=ArticleListResponse)
async def get_articles_by_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Listar artigos de um projeto."""
    await get_project_or_404(project_id, current_user.id, db)
    
    result = await db.execute(
        select(Article)
        .where(Article.project_id == project_id, Article.owner_id == current_user.id)
        .order_by(Article.created_at.desc())
    )
    articles = result.scalars().all()
    
    articles_response = []
    for article in articles:
        response = ArticleResponse.model_validate(article)
        response.has_pdf = article.pdf_data is not None
        articles_response.append(response)
    
    return ArticleListResponse(articles=articles_response, total=len(articles_response))


@router.post("/{project_id}/artigos", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    project_id: int,
    data: ArticleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Criar novo artigo."""
    await get_project_or_404(project_id, current_user.id, db)
    
    article = Article(
        **data.model_dump(),
        project_id=project_id,
        owner_id=current_user.id
    )
    
    db.add(article)
    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.has_pdf = False
    return response


@router.get("/{project_id}/artigos/{article_id}", response_model=ArticleResponse)
async def get_article_by_id(
    project_id: int,
    article_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Buscar artigo específico."""
    article = await get_article_or_404(article_id, project_id, current_user.id, db)
    response = ArticleResponse.model_validate(article)
    response.has_pdf = article.pdf_data is not None
    return response


@router.put("/{project_id}/artigos/{article_id}", response_model=ArticleResponse)
async def update_article(
    project_id: int,
    article_id: int,
    data: ArticleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Atualizar artigo."""
    article = await get_article_or_404(article_id, project_id, current_user.id, db)
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(article, field, value)
    
    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.has_pdf = article.pdf_data is not None
    return response


@router.patch("/{project_id}/artigos/{article_id}/status", response_model=ArticleResponse)
async def update_article_status(
    project_id: int,
    article_id: int,
    data: ArticleStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Atualizar status do artigo."""
    article = await get_article_or_404(article_id, project_id, current_user.id, db)
    article.status = data.status
    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.has_pdf = article.pdf_data is not None
    return response


@router.patch("/{project_id}/artigos/{article_id}/notes", response_model=ArticleResponse)
async def update_article_notes(
    project_id: int,
    article_id: int,
    data: ArticleNotesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Atualizar notas do artigo."""
    article = await get_article_or_404(article_id, project_id, current_user.id, db)
    article.notas = data.notas
    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.has_pdf = article.pdf_data is not None
    return response


@router.delete("/{project_id}/artigos/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    project_id: int,
    article_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletar artigo."""
    article = await get_article_or_404(article_id, project_id, current_user.id, db)
    await db.delete(article)
    await db.commit()
    return None


@router.post("/{project_id}/artigos/{article_id}/pdf", response_model=ArticleResponse)
async def upload_pdf(
    project_id: int,
    article_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload PDF do artigo."""
    article = await get_article_or_404(article_id, project_id, current_user.id, db)
    
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Tipo inválido", "message": "Apenas arquivos PDF são permitidos"}
        )
    
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Arquivo muito grande", "message": "O tamanho máximo permitido é 10MB"}
        )
    
    article.pdf_data = content
    article.pdf_filename = file.filename
    article.pdf_content_type = file.content_type
    
    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.has_pdf = True
    return response


@router.get("/{project_id}/artigos/{article_id}/pdf")
async def get_pdf(
    project_id: int,
    article_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Baixar PDF do artigo."""
    article = await get_article_or_404(article_id, project_id, current_user.id, db)
    
    if not article.pdf_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "PDF não encontrado", "message": "Este artigo não possui PDF"}
        )
    
    return StreamingResponse(
        BytesIO(article.pdf_data),
        media_type=article.pdf_content_type,
        headers={"Content-Disposition": f"inline; filename=\"{article.pdf_filename or 'artigo.pdf'}\""}
    )


@router.post("/{project_id}/artigos/{article_id}/relacionamentos")
async def add_relationship(
    project_id: int,
    article_id: int,
    data: RelationshipCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Adicionar relacionamento entre artigos."""
    article = await get_article_or_404(article_id, project_id, current_user.id, db)
    related = await get_article_or_404(data.related_article_id, project_id, current_user.id, db)
    
    if related not in article.related_articles:
        article.related_articles.append(related)
        await db.commit()
    
    return {"success": True, "message": "Relacionamento adicionado"}


@router.delete("/{project_id}/artigos/{article_id}/relacionamentos/{related_id}")
async def remove_relationship(
    project_id: int,
    article_id: int,
    related_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remover relacionamento entre artigos."""
    article = await get_article_or_404(article_id, project_id, current_user.id, db)
    related = await get_article_or_404(related_id, project_id, current_user.id, db)
    
    if related in article.related_articles:
        article.related_articles.remove(related)
        await db.commit()
    
    return {"success": True, "message": "Relacionamento removido"}


@router.get("/{project_id}/artigos/{article_id}/relacionamentos")
async def get_relationships(
    project_id: int,
    article_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Listar relacionamentos do artigo."""
    article = await get_article_or_404(article_id, project_id, current_user.id, db)
    
    related_responses = [
        ArticleResponse.model_validate(related) for related in article.related_articles
    ]
    
    return {"related_articles": related_responses}


@router.get("/{project_id}/grafo")
async def get_project_graph(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obter grafo de relacionamentos do projeto."""
    await get_project_or_404(project_id, current_user.id, db)
    
    result = await db.execute(
        select(Article).where(Article.project_id == project_id, Article.owner_id == current_user.id)
    )
    articles = result.scalars().all()
    
    nodes = []
    links = []
    
    for article in articles:
        nodes.append({
            "id": str(article.id),
            "title": article.title,
            "authors": article.authors,
            "year": article.year,
            "status": article.status
        })
        
        for related in article.related_articles:
            links.append({
                "source": str(article.id),
                "target": str(related.id)
            })
    
    return {"nodes": nodes, "links": links}
