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


async def get_project_or_404(projectId: int, ownerId: int, db: AsyncSession) -> Project:
    """Helper to get project or raise 404."""
    result = await db.execute(
        select(Project).where(Project.id == projectId, Project.ownerId == ownerId)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Projeto não encontrado", "message": "Projeto inexistente ou sem permissão"}
        )
    return project


async def get_article_or_404(articleId: int, projectId: int, ownerId: int, db: AsyncSession) -> Article:
    """Helper to get article or raise 404."""
    result = await db.execute(
        select(Article).where(
            Article.id == articleId,
            Article.projectId == projectId,
            Article.ownerId == ownerId
        )
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Artigo não encontrado", "message": "Artigo inexistente ou sem permissão"}
        )
    return article


@router.get("/{projectId}/artigos", response_model=ArticleListResponse)
async def get_articles_by_project(
    projectId: int,
    search: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Listar artigos de um projeto com filtros e paginação."""
    await get_project_or_404(projectId, current_user.id, db)
    
    # Base query
    query = select(Article).where(
        Article.projectId == projectId, 
        Article.ownerId == current_user.id
    )
    
    # Filtro por busca (texto no título ou autores)
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (Article.title.ilike(search_filter)) | 
            (Article.authors.ilike(search_filter))
        )
    
    # Filtro por status
    if status and status != "todos":
        query = query.where(Article.status == status)
    
    # Contagem total antes da paginação
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0
    
    # Ordenação e Paginação
    offset = (page - 1) * limit
    result = await db.execute(
        query.order_by(Article.createdAt.desc())
        .offset(offset)
        .limit(limit)
    )
    articles = result.scalars().all()
    
    articles_response = []
    for article in articles:
        response = ArticleResponse.model_validate(article)
        response.hasPdf = article.pdfData is not None
        articles_response.append(response)
    
    return ArticleListResponse(
        articles=articles_response, 
        total=total,
        page=page,
        limit=limit
    )


@router.post("/{projectId}/artigos", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    projectId: int,
    data: ArticleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Criar novo artigo com avaliação automática da IA."""
    project = await get_project_or_404(projectId, current_user.id, db)
    
    article = Article(
        **data.model_dump(),
        projectId=projectId,
        ownerId=current_user.id
    )
    
    # Avaliação automática por IA se tiver abstract
    if article.abstract:
        try:
            from app.services.ai_service import get_ai_service
            ai_service = get_ai_service()
            
            project_data = {
                "criteriosInclusao": project.criteriosInclusao or [],
                "criteriosExclusao": project.criteriosExclusao or []
            }
            
            eval_result = await ai_service.evaluate_article(
                {"title": article.title, "abstract": article.abstract},
                project_data
            )
            
            article.aiEvaluation = eval_result.get("justification")
            article.aiSuggestedStatus = eval_result.get("suggestedStatus")
            article.aiRelevanceScore = eval_result.get("relevanceScore")
        except Exception as e:
            print(f"Erro ao avaliar artigo com IA: {e}")
    
    db.add(article)
    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.hasPdf = False
    
    # Preencher campos de IA explicitamente se a validação automática não o fizer
    response.aiEvaluation = article.aiEvaluation
    response.aiSuggestedStatus = article.aiSuggestedStatus
    response.aiRelevanceScore = article.aiRelevanceScore
    
    return response


@router.get("/{projectId}/artigos/{articleId}", response_model=ArticleResponse)
async def get_article_by_id(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Buscar artigo específico."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    response = ArticleResponse.model_validate(article)
    response.hasPdf = article.pdfData is not None
    return response


@router.put("/{projectId}/artigos/{articleId}", response_model=ArticleResponse)
async def update_article(
    projectId: int,
    articleId: int,
    data: ArticleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Atualizar artigo."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Se o abstract mudou, ou se não tem avaliação, re-avaliar
    re_evaluate = "abstract" in update_data and update_data["abstract"] != article.abstract
    
    for field, value in update_data.items():
        setattr(article, field, value)
    
    if re_evaluate and article.abstract:
        try:
            from app.services.ai_service import get_ai_service
            ai_service = get_ai_service()
            
            project = await get_project_or_404(projectId, current_user.id, db)
            project_data = {
                "criteriosInclusao": project.criteriosInclusao or [],
                "criteriosExclusao": project.criteriosExclusao or []
            }
            
            eval_result = await ai_service.evaluate_article(
                {"title": article.title, "abstract": article.abstract},
                project_data
            )
            
            article.aiEvaluation = eval_result.get("justification")
            article.aiSuggestedStatus = eval_result.get("suggestedStatus")
            article.aiRelevanceScore = eval_result.get("relevanceScore")
        except Exception as e:
            print(f"Erro ao re-avaliar artigo com IA: {e}")

    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.hasPdf = article.pdfData is not None
    
    # Preencher campos de IA explicitamente
    response.aiEvaluation = article.aiEvaluation
    response.aiSuggestedStatus = article.aiSuggestedStatus
    response.aiRelevanceScore = article.aiRelevanceScore
    
    return response


@router.patch("/{projectId}/artigos/{articleId}/status", response_model=ArticleResponse)
async def update_article_status(
    projectId: int,
    articleId: int,
    data: ArticleStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Atualizar status do artigo."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    article.status = data.status
    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.hasPdf = article.pdfData is not None
    return response


@router.patch("/{projectId}/artigos/{articleId}/notes", response_model=ArticleResponse)
async def update_article_notes(
    projectId: int,
    articleId: int,
    data: ArticleNotesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Atualizar notas do artigo."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    article.notas = data.notas
    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.hasPdf = article.pdfData is not None
    return response


@router.delete("/{projectId}/artigos/{articleId}")
async def delete_article(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletar artigo."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    await db.delete(article)
    await db.commit()
    return {"success": True, "message": "Artigo removido com sucesso"}


@router.post("/{projectId}/artigos/{articleId}/pdf", response_model=ArticleResponse)
async def upload_pdf(
    projectId: int,
    articleId: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload PDF do artigo."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    
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
    
    article.pdfData = content
    article.pdfFilename = file.filename
    article.pdfContentType = file.content_type
    
    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.hasPdf = True
    return response


@router.get("/{projectId}/artigos/{articleId}/pdf")
async def get_pdf(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Baixar PDF do artigo."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    
    if not article.pdfData:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "PDF não encontrado", "message": "Este artigo não possui PDF"}
        )
    
    return StreamingResponse(
        BytesIO(article.pdfData),
        media_type=article.pdfContentType,
        headers={"Content-Disposition": f"inline; filename=\"{article.pdfFilename or 'artigo.pdf'}\""}
    )


@router.post("/{projectId}/artigos/{articleId}/relacionamentos")
async def add_relationship(
    projectId: int,
    articleId: int,
    data: RelationshipCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Adicionar relacionamento entre artigos."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    related = await get_article_or_404(data.relatedArticleId, projectId, current_user.id, db)
    
    if related not in article.relatedArticles:
        article.relatedArticles.append(related)
        await db.commit()
    
    return {"success": True, "message": "Relacionamento adicionado"}


@router.delete("/{projectId}/artigos/{articleId}/relacionamentos/{relatedId}")
async def remove_relationship(
    projectId: int,
    articleId: int,
    relatedId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remover relacionamento entre artigos."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    related = await get_article_or_404(relatedId, projectId, current_user.id, db)
    
    if related in article.relatedArticles:
        article.relatedArticles.remove(related)
        await db.commit()
    
    return {"success": True, "message": "Relacionamento removido"}


@router.get("/{projectId}/artigos/{articleId}/relacionamentos")
async def get_relationships(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Listar relacionamentos do artigo."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)
    
    related_responses = [
        ArticleResponse.model_validate(related) for related in article.relatedArticles
    ]
    
    return {"related_articles": related_responses}


@router.get("/{projectId}/grafo")
async def get_project_graph(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obter grafo de relacionamentos do projeto."""
    await get_project_or_404(projectId, current_user.id, db)
    
    result = await db.execute(
        select(Article).where(Article.projectId == projectId, Article.ownerId == current_user.id)
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
        
        for related in article.relatedArticles:
            links.append({
                "source": str(article.id),
                "target": str(related.id)
            })
    
    return {"nodes": nodes, "links": links}
