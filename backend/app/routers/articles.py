from datetime import datetime
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.article import Article
from app.schemas.article import (
    ArticleCreate,
    ArticleUpdate,
    ArticleStatusUpdate,
    ArticleDecisionUpdate,
    BatchEvaluateRequest,
    BatchEvaluateResponse,
    BatchEvaluateSummary,
    ArticleNotesUpdate,
    ArticleResponse,
    ArticleListResponse,
    RelationshipCreate,
)
from app.core.dependencies import get_current_user
from app.services.anchor_service import get_anchor_service


router = APIRouter()


def _graph_sync_http_error(message: str = "Falha ao sincronizar grafo no Neo4j") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "error": "Graph sync unavailable",
            "message": message,
        },
    )


async def _sync_article_graph_or_raise(article: Article, db: AsyncSession) -> None:
    from app.services.graph_sync_service import get_graph_sync_service

    graph_sync = get_graph_sync_service()
    try:
        await graph_sync.sync_article_to_graph(article, db)
    except Exception as exc:
        raise _graph_sync_http_error() from exc


async def _delete_article_graph_or_raise(article_id: int) -> None:
    from app.services.graph_sync_service import get_graph_sync_service

    graph_sync = get_graph_sync_service()
    try:
        await graph_sync.delete_article_from_graph(article_id)
    except Exception as exc:
        raise _graph_sync_http_error("Falha ao remover artigo do grafo no Neo4j") from exc


def _build_vector_payload(article: Article, qdrant) -> dict:
    return qdrant.build_payload(
        paper_id=article.paperId,
        project_id=article.projectId,
        metadata={
            "article_id": article.id,
            "title": article.title,
            "authors": article.authors,
            "year": article.year,
            "journal": article.journal,
            "abstract": article.abstract,
            "methodology": article.aiMethodology,
            "domain": article.aiDomain,
            "keywords": article.aiKeywords,
            "notas": article.notas,
        },
    )


async def _sync_article_vector_payload(article: Article) -> None:
    if article.embedding is None or not article.paperId:
        return

    from app.services.qdrant_retrieval_service import get_qdrant_retrieval_service

    qdrant = get_qdrant_retrieval_service()
    payload = _build_vector_payload(article, qdrant)
    await qdrant.upsert_payload(payload=payload, embedding=list(article.embedding))


async def _delete_article_vector_payload(article_id: int) -> None:
    from app.services.qdrant_retrieval_service import get_qdrant_retrieval_service

    qdrant = get_qdrant_retrieval_service()
    await qdrant.delete_article(article_id)


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


def _decision_to_status(decision: str) -> str:
    if decision == "incluido":
        return "analisado"
    if decision == "excluido":
        return "excluido"
    return "pendente"


def _resolve_answering_rqs_for_decision(
    *,
    decision: str,
    explicit_answering_rqs: list[int] | None,
    ai_suggested_rqs: list[int] | None,
    use_suggested_rqs: bool,
) -> list[int]:
    if decision != "incluido":
        return []

    explicit = [
        int(value)
        for value in (explicit_answering_rqs or [])
        if isinstance(value, int) and not isinstance(value, bool) and value > 0
    ]
    if explicit:
        return sorted(set(explicit))

    if not use_suggested_rqs:
        return []

    suggested = [
        int(value)
        for value in (ai_suggested_rqs or [])
        if isinstance(value, int) and not isinstance(value, bool) and value > 0
    ]
    return sorted(set(suggested))


def _is_included_for_synthesis(article: Article) -> bool:
    if article.manualDecision == "incluido":
        return True
    if article.manualDecision == "excluido":
        return False
    return article.status == "analisado"


def _build_evidence_excerpt(article: Article) -> str | None:
    candidate = (article.manualDecisionReason or article.aiEvaluation or article.notas or "").strip()
    if not candidate:
        return None
    if len(candidate) <= 280:
        return candidate
    return candidate[:277] + "..."


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


@router.get("/{projectId}/artigos/filter-summary")
async def get_project_filter_summary(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retornar resumo de triagem do projeto para acompanhamento operacional."""
    await get_project_or_404(projectId, current_user.id, db)

    query = select(Article).where(
        Article.projectId == projectId,
        Article.ownerId == current_user.id,
    )
    result = await db.execute(query)
    articles = result.scalars().all()

    status_counts = {
        "pendente": 0,
        "analisado": 0,
        "excluido": 0,
    }
    manual_decisions = {
        "pendente": 0,
        "incluido": 0,
        "excluido": 0,
    }
    ai_suggestions = {
        "incluido": 0,
        "excluido": 0,
    }
    exclusion_breakdown: dict[str, int] = {}

    for article in articles:
        if article.status in status_counts:
            status_counts[article.status] += 1

        if article.manualDecision in manual_decisions:
            manual_decisions[article.manualDecision] += 1

        if article.aiSuggestedStatus in ai_suggestions:
            ai_suggestions[article.aiSuggestedStatus] += 1

        for criterion in article.exclusionCriteria or []:
            exclusion_breakdown[criterion] = exclusion_breakdown.get(criterion, 0) + 1

    total = len(articles)

    return {
        "projectId": projectId,
        "totalArticles": total,
        "status": status_counts,
        "manualDecisions": manual_decisions,
        "aiSuggestions": ai_suggestions,
        "exclusionCriteriaBreakdown": exclusion_breakdown,
        "coverage": {
            "reviewedPercentage": round(((status_counts["analisado"] + status_counts["excluido"]) / total) * 100, 2)
            if total > 0 else 0,
            "pendingPercentage": round((status_counts["pendente"] / total) * 100, 2)
            if total > 0 else 0,
        },
    }


@router.get("/{projectId}/artigos/rq-synthesis")
async def get_project_rq_synthesis(
    projectId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gerar síntese estruturada por questão de pesquisa (RQ) com evidências rastreáveis."""
    project = await get_project_or_404(projectId, current_user.id, db)

    query = select(Article).where(
        Article.projectId == projectId,
        Article.ownerId == current_user.id,
    )
    result = await db.execute(query)
    articles = result.scalars().all()

    research_questions = project.researchQuestions or []
    rq_count = len(research_questions)

    included_articles = [article for article in articles if _is_included_for_synthesis(article)]
    rq_to_articles: dict[int, list[Article]] = {index: [] for index in range(1, rq_count + 1)}
    included_without_rq: list[Article] = []

    for article in included_articles:
        linked_rqs = [rq for rq in (article.answeringRQs or []) if 1 <= rq <= rq_count]
        if not linked_rqs:
            included_without_rq.append(article)
            continue

        for rq in sorted(set(linked_rqs)):
            rq_to_articles[rq].append(article)

    rq_synthesis = []
    for index, question in enumerate(research_questions, start=1):
        rq_articles = rq_to_articles.get(index, [])
        rq_synthesis.append(
            {
                "rqNumber": index,
                "question": question,
                "evidenceCount": len(rq_articles),
                "articles": [
                    {
                        "id": article.id,
                        "paperId": article.paperId,
                        "title": article.title,
                        "authors": article.authors,
                        "year": article.year,
                        "status": article.status,
                        "manualDecision": article.manualDecision,
                        "reason": article.manualDecisionReason,
                        "evidenceExcerpt": _build_evidence_excerpt(article),
                    }
                    for article in rq_articles
                ],
            }
        )

    matrix = []
    for article in included_articles:
        article_links = set(rq for rq in (article.answeringRQs or []) if 1 <= rq <= rq_count)
        matrix.append(
            {
                "articleId": article.id,
                "paperId": article.paperId,
                "title": article.title,
                "year": article.year,
                "decision": article.manualDecision or article.status,
                "rqs": [index for index in range(1, rq_count + 1) if index in article_links],
            }
        )

    answered_rqs = sum(1 for index in range(1, rq_count + 1) if rq_to_articles.get(index))
    coverage_percentage = round((answered_rqs / rq_count) * 100, 2) if rq_count else 0

    return {
        "projectId": projectId,
        "projectTitle": project.title,
        "rqCount": rq_count,
        "rqSynthesis": rq_synthesis,
        "matrix": matrix,
        "coverage": {
            "answeredRQCount": answered_rqs,
            "answeredRQPercentage": coverage_percentage,
            "includedArticles": len(included_articles),
            "includedWithoutRQLinks": len(included_without_rq),
        },
        "unlinkedIncludedArticles": [
            {
                "id": article.id,
                "paperId": article.paperId,
                "title": article.title,
                "year": article.year,
                "status": article.status,
                "manualDecision": article.manualDecision,
            }
            for article in included_without_rq
        ],
    }


@router.post("/{projectId}/artigos", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    projectId: int,
    data: ArticleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Criar novo artigo com avaliação automática da IA, embedding e sincronização de grafo."""
    project = await get_project_or_404(projectId, current_user.id, db)
    
    article = Article(
        **data.model_dump(),
        projectId=projectId,
        ownerId=current_user.id
    )

    anchor_service = get_anchor_service()
    article.paperId = anchor_service.resolve(
        provided=data.paperId,
        doi=article.doi,
        title=article.title,
        year=article.year,
    )
    
    # Avaliação automática por IA e extração de metadados se tiver abstract
    if article.abstract:
        try:
            from app.services.ai_service import get_ai_service
            
            ai_service = get_ai_service()
            
            project_data = {
                "criteriosInclusao": project.criteriosInclusao or [],
                "criteriosExclusao": project.criteriosExclusao or [],
                "researchQuestions": project.researchQuestions or [],
            }
            
            # Avaliação + extração de metadados (single LLM call)
            eval_result = await ai_service.evaluate_article(
                {"title": article.title, "abstract": article.abstract},
                project_data
            )
            
            article.aiEvaluation = eval_result.get("justification")
            article.aiSuggestedStatus = eval_result.get("suggestedStatus")
            article.aiRelevanceScore = eval_result.get("relevanceScore")
            article.aiSuggestedRQs = eval_result.get("suggestedRQs", [])
            article.aiMethodology = eval_result.get("methodology")
            article.aiDatabase = eval_result.get("database")
            article.aiDomain = eval_result.get("domain")
            article.aiKeywords = eval_result.get("keywords", [])
            print(f"[GRAPH] AI metadata extracted: methodology={article.aiMethodology}, database={article.aiDatabase}")
            
        except Exception as e:
            import traceback
            print(f"[GRAPH] Erro ao avaliar artigo com IA: {e}")
            traceback.print_exc()
        
        # Gerar embedding separadamente para isolar erros
        try:
            from app.services.embedding_service import get_embedding_service
            embedding_service = get_embedding_service()
            
            print(f"[GRAPH] Gerando embedding para: {article.title[:60]}...")
            embedding = embedding_service.generate_embedding(article.abstract)
            if embedding:
                article.embedding = embedding
                print(f"[GRAPH] Embedding gerado com sucesso: {len(embedding)} dimensões")
            else:
                print(f"[GRAPH] Embedding retornou vazio!")
        except Exception as e:
            import traceback
            print(f"[GRAPH] Erro ao gerar embedding: {e}")
            traceback.print_exc()
    
    db.add(article)
    await db.flush()

    await _sync_article_graph_or_raise(article, db)

    await db.commit()
    await db.refresh(article)

    # Propagar âncora canônica para payload vetorial.
    try:
        await _sync_article_vector_payload(article)
    except Exception as e:
        print(f"[QDRANT] Erro ao sincronizar payload vetorial: {e}")
    
    response = ArticleResponse.model_validate(article)
    response.hasPdf = False
    
    # Preencher campos de IA explicitamente se a validação automática não o fizer
    response.aiEvaluation = article.aiEvaluation
    response.aiSuggestedStatus = article.aiSuggestedStatus
    response.aiRelevanceScore = article.aiRelevanceScore
    response.aiSuggestedRQs = article.aiSuggestedRQs or []
    
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

    anchor_service = get_anchor_service()
    anchor_fields_changed = any(k in update_data for k in ("paperId", "doi", "title", "year"))
    if anchor_fields_changed or not article.paperId:
        article.paperId = anchor_service.resolve(
            provided=update_data.get("paperId") if anchor_fields_changed else article.paperId,
            doi=article.doi,
            title=article.title,
            year=article.year,
        )
    
    if re_evaluate and article.abstract:
        try:
            from app.services.ai_service import get_ai_service
            ai_service = get_ai_service()
            
            project = await get_project_or_404(projectId, current_user.id, db)
            project_data = {
                "criteriosInclusao": project.criteriosInclusao or [],
                "criteriosExclusao": project.criteriosExclusao or [],
                "researchQuestions": project.researchQuestions or [],
            }
            
            eval_result = await ai_service.evaluate_article(
                {"title": article.title, "abstract": article.abstract},
                project_data
            )
            
            article.aiEvaluation = eval_result.get("justification")
            article.aiSuggestedStatus = eval_result.get("suggestedStatus")
            article.aiRelevanceScore = eval_result.get("relevanceScore")
            article.aiSuggestedRQs = eval_result.get("suggestedRQs", [])
            article.aiMethodology = eval_result.get("methodology")
            article.aiDatabase = eval_result.get("database")
            article.aiDomain = eval_result.get("domain")
            article.aiKeywords = eval_result.get("keywords", [])
        except Exception as e:
            print(f"Erro ao re-avaliar artigo com IA: {e}")

        try:
            from app.services.embedding_service import get_embedding_service

            embedding_service = get_embedding_service()
            embedding = embedding_service.generate_embedding(article.abstract)
            article.embedding = embedding if embedding else None
        except Exception as e:
            print(f"Erro ao re-gerar embedding: {e}")

    await db.flush()
    await _sync_article_graph_or_raise(article, db)

    await db.commit()
    await db.refresh(article)

    try:
        await _sync_article_vector_payload(article)
    except Exception as e:
        print(f"[QDRANT] Erro ao sincronizar payload vetorial: {e}")
    
    response = ArticleResponse.model_validate(article)
    response.hasPdf = article.pdfData is not None
    
    # Preencher campos de IA explicitamente
    response.aiEvaluation = article.aiEvaluation
    response.aiSuggestedStatus = article.aiSuggestedStatus
    response.aiRelevanceScore = article.aiRelevanceScore
    response.aiSuggestedRQs = article.aiSuggestedRQs or []
    
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

    await db.flush()
    await _sync_article_graph_or_raise(article, db)

    await db.commit()
    await db.refresh(article)
    
    response = ArticleResponse.model_validate(article)
    response.hasPdf = article.pdfData is not None
    return response


@router.put("/{projectId}/artigos/{articleId}/decision", response_model=ArticleResponse)
async def update_article_decision(
    projectId: int,
    articleId: int,
    data: ArticleDecisionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Registrar decisão manual de triagem com justificativa e vínculo opcional com RQs."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)

    article.manualDecision = data.decision
    article.manualDecisionReason = data.reason
    article.exclusionCriteria = data.exclusionCriteria
    article.answeringRQs = _resolve_answering_rqs_for_decision(
        decision=data.decision,
        explicit_answering_rqs=data.answeringRQs,
        ai_suggested_rqs=article.aiSuggestedRQs,
        use_suggested_rqs=data.useSuggestedRQs,
    )
    article.decisionUpdatedAt = datetime.utcnow()
    article.status = _decision_to_status(data.decision)

    await db.flush()
    await _sync_article_graph_or_raise(article, db)

    await db.commit()
    await db.refresh(article)

    try:
        await _sync_article_vector_payload(article)
    except Exception as e:
        print(f"[QDRANT] Erro ao sincronizar decisão no payload vetorial: {e}")

    response = ArticleResponse.model_validate(article)
    response.hasPdf = article.pdfData is not None
    return response


@router.post("/{projectId}/artigos/batch-evaluate", response_model=BatchEvaluateResponse)
async def batch_evaluate_articles(
    projectId: int,
    data: BatchEvaluateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Executar avaliação de triagem em lote usando os critérios do projeto."""
    project = await get_project_or_404(projectId, current_user.id, db)

    query = (
        select(Article)
        .where(Article.projectId == projectId, Article.ownerId == current_user.id)
        .order_by(Article.createdAt.desc())
    )

    if data.onlyPending:
        query = query.where(Article.status == "pendente")

    if data.onlyUnscored and not data.forceReevaluate:
        query = query.where(
            or_(
                Article.aiSuggestedStatus.is_(None),
                Article.aiRelevanceScore.is_(None),
            )
        )

    query = query.limit(data.limit)
    result = await db.execute(query)
    candidates = result.scalars().all()

    summary = {
        "totalCandidates": len(candidates),
        "evaluated": 0,
        "skippedNoAbstract": 0,
        "skippedAlreadyEvaluated": 0,
        "suggestedIncluded": 0,
        "suggestedExcluded": 0,
        "appliedStatusChanges": 0,
    }

    if not candidates:
        return BatchEvaluateResponse(
            projectId=projectId,
            summary=BatchEvaluateSummary(**summary),
        )

    from app.services.ai_service import get_ai_service

    ai_service = get_ai_service()
    project_data = {
        "criteriosInclusao": project.criteriosInclusao or [],
        "criteriosExclusao": project.criteriosExclusao or [],
        "researchQuestions": project.researchQuestions or [],
    }

    changed_articles: list[Article] = []

    for article in candidates:
        if not article.abstract:
            summary["skippedNoAbstract"] += 1
            continue

        already_evaluated = bool(article.aiSuggestedStatus and article.aiRelevanceScore is not None)
        if already_evaluated and not data.forceReevaluate:
            summary["skippedAlreadyEvaluated"] += 1
            suggested = article.aiSuggestedStatus
            if suggested == "incluido":
                summary["suggestedIncluded"] += 1
            elif suggested == "excluido":
                summary["suggestedExcluded"] += 1
            continue

        eval_result = await ai_service.evaluate_article(
            {"title": article.title, "abstract": article.abstract},
            project_data,
        )

        suggested = eval_result.get("suggestedStatus")
        if suggested == "incluido":
            summary["suggestedIncluded"] += 1
        elif suggested == "excluido":
            summary["suggestedExcluded"] += 1

        summary["evaluated"] += 1

        if data.dryRun:
            continue

        article.aiEvaluation = eval_result.get("justification")
        article.aiSuggestedStatus = suggested
        article.aiRelevanceScore = eval_result.get("relevanceScore")
        article.aiSuggestedRQs = eval_result.get("suggestedRQs", [])
        article.aiMethodology = eval_result.get("methodology")
        article.aiDatabase = eval_result.get("database")
        article.aiDomain = eval_result.get("domain")
        article.aiKeywords = eval_result.get("keywords", [])

        if data.applySuggestedStatus and suggested in ("incluido", "excluido"):
            mapped_status = _decision_to_status(suggested)
            if article.status != mapped_status:
                article.status = mapped_status
                summary["appliedStatusChanges"] += 1

        changed_articles.append(article)

    if not data.dryRun and changed_articles:
        await db.flush()
        for article in changed_articles:
            await _sync_article_graph_or_raise(article, db)

        await db.commit()

        for article in changed_articles:
            try:
                await _sync_article_vector_payload(article)
            except Exception as e:
                print(f"[QDRANT] Erro ao sincronizar batch do artigo {article.id}: {e}")

    return BatchEvaluateResponse(
        projectId=projectId,
        summary=BatchEvaluateSummary(**summary),
    )


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

    try:
        await _sync_article_vector_payload(article)
    except Exception as e:
        print(f"[QDRANT] Erro ao sincronizar notas no payload vetorial: {e}")
    
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
    """Deletar artigo e remover do grafo."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)

    await _delete_article_graph_or_raise(articleId)
    try:
        await _delete_article_vector_payload(articleId)
    except Exception as e:
        print(f"[QDRANT] Erro ao remover payload vetorial do artigo {articleId}: {e}")
    
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


@router.get("/{projectId}/artigos/{articleId}/download")
async def download_pdf(
    projectId: int,
    articleId: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Baixar PDF do artigo com header de anexo para download direto."""
    article = await get_article_or_404(articleId, projectId, current_user.id, db)

    if not article.pdfData:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "PDF não encontrado", "message": "Este artigo não possui PDF"}
        )

    return StreamingResponse(
        BytesIO(article.pdfData),
        media_type=article.pdfContentType,
        headers={"Content-Disposition": f"attachment; filename=\"{article.pdfFilename or 'artigo.pdf'}\""}
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
    relationship_type: str = "all",
    min_similarity: float = 0.5,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obter grafo de relacionamentos do projeto.
    
    Args:
        relationship_type: Tipo de relacionamento - 'all', 'semantic', 'methodology', 'authors', 'keywords',
            'venue', 'authored', 'has-keyword', 'published-in'
        min_similarity: Threshold mínimo para relações de similaridade semântica (0.0 a 1.0)
    """
    await get_project_or_404(projectId, current_user.id, db)
    
    try:
        from app.services.neo4j_service import get_neo4j_service

        neo4j_service = get_neo4j_service()
        graph_data = await neo4j_service.get_project_graph(
            project_id=projectId,
            relationship_type=relationship_type,
            min_similarity=min_similarity,
        )
        return graph_data
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Graph unavailable",
                "message": "Neo4j indisponível para consulta de grafo",
            },
        ) from exc


@router.post("/{projectId}/reprocessar-grafo")
async def reprocess_project_graph(
    projectId: int,
    only_missing_embeddings: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reprocessar artigos do projeto: gerar embeddings, extrair metadados e reconstruir grafo.

    Args:
        only_missing_embeddings: Se True, processa apenas artigos com embedding ausente.
    """
    project = await get_project_or_404(projectId, current_user.id, db)

    query = select(Article).where(
        Article.projectId == projectId,
        Article.ownerId == current_user.id
    )
    result = await db.execute(query)
    all_articles = result.scalars().all()

    if not all_articles:
        return {"success": True, "message": "Nenhum artigo encontrado", "processed": 0}

    articles = [
        article for article in all_articles
        if not only_missing_embeddings or article.embedding is None
    ]

    if not articles:
        return {
            "success": True,
            "message": "Nenhum artigo com embedding ausente encontrado",
            "processed": 0,
            "total": len(all_articles),
            "onlyMissingEmbeddings": only_missing_embeddings,
        }
    
    from app.services.ai_service import get_ai_service
    from app.services.embedding_service import get_embedding_service
    from app.services.graph_sync_service import get_graph_sync_service
    from app.services.neo4j_service import get_neo4j_service
    from app.services.qdrant_retrieval_service import get_qdrant_retrieval_service
    
    ai_service = get_ai_service()
    embedding_service = get_embedding_service()
    graph_sync = get_graph_sync_service()
    neo4j_service = get_neo4j_service()
    qdrant = get_qdrant_retrieval_service()
    anchor_service = get_anchor_service()
    
    # Limpar grafo Neo4j do projeto
    try:
        await neo4j_service.delete_project_graph(projectId)
        print(f"[REPROCESS] Grafo Neo4j limpo para projeto {projectId}")
    except Exception as e:
        print(f"[REPROCESS] Erro ao limpar grafo: {e}")

    try:
        await qdrant.delete_project_points(projectId)
        print(f"[REPROCESS] Vetores Qdrant limpos para projeto {projectId}")
    except Exception as e:
        print(f"[REPROCESS] Erro ao limpar vetores do projeto: {e}")
    
    project_data = {
        "criteriosInclusao": project.criteriosInclusao or [],
        "criteriosExclusao": project.criteriosExclusao or [],
        "researchQuestions": project.researchQuestions or [],
    }
    
    processed = 0
    errors = []
    
    for article in articles:
        if not article.abstract:
            print(f"[REPROCESS] Artigo {article.id} sem abstract, pulando")
            continue
        
        try:
            article.paperId = anchor_service.resolve(
                provided=article.paperId,
                doi=article.doi,
                title=article.title,
                year=article.year,
            )
            # Re-extract AI metadata
            eval_result = await ai_service.evaluate_article(
                {"title": article.title, "abstract": article.abstract},
                project_data
            )
            article.aiEvaluation = eval_result.get("justification")
            article.aiSuggestedStatus = eval_result.get("suggestedStatus")
            article.aiRelevanceScore = eval_result.get("relevanceScore")
            article.aiSuggestedRQs = eval_result.get("suggestedRQs", [])
            article.aiMethodology = eval_result.get("methodology")
            article.aiDatabase = eval_result.get("database")
            article.aiDomain = eval_result.get("domain")
            article.aiKeywords = eval_result.get("keywords", [])
            print(f"[REPROCESS] AI metadata for article {article.id}: methodology={article.aiMethodology}")
        except Exception as e:
            print(f"[REPROCESS] Erro AI para artigo {article.id}: {e}")
            errors.append(f"AI error for {article.id}: {str(e)}")
        
        try:
            # Generate embedding
            embedding = embedding_service.generate_embedding(article.abstract)
            if embedding:
                article.embedding = embedding
                print(f"[REPROCESS] Embedding gerado para artigo {article.id}: {len(embedding)} dims")
            else:
                print(f"[REPROCESS] Embedding vazio para artigo {article.id}")
        except Exception as e:
            print(f"[REPROCESS] Erro embedding para artigo {article.id}: {e}")
            errors.append(f"Embedding error for {article.id}: {str(e)}")
        
        processed += 1
    
    # Commit all embedding and metadata updates
    await db.commit()
    print(f"[REPROCESS] Commits salvos para {processed} artigos")
    
    # Refresh articles to get updated data
    for article in all_articles:
        await db.refresh(article)

    graph_synced = 0
    vector_synced = 0

    # Rebuild Neo4j from the complete relational state to avoid partial graphs.
    for article in all_articles:
        if not article.abstract:
            continue
        try:
            await graph_sync.sync_article_to_graph(article, db)
            graph_synced += 1
        except Exception as e:
            print(f"[REPROCESS] Erro sync artigo {article.id}: {e}")
            errors.append(f"Sync error for {article.id}: {str(e)}")

    # Refresh Qdrant from the complete relational state to avoid stale vector indexes.
    for article in all_articles:
        if article.embedding is None or not article.paperId:
            continue
        try:
            await _sync_article_vector_payload(article)
            vector_synced += 1
        except Exception as e:
            print(f"[REPROCESS] Erro Qdrant artigo {article.id}: {e}")
            errors.append(f"Qdrant error for {article.id}: {str(e)}")
    
    print(f"[REPROCESS] Concluído: {processed} artigos processados, {len(errors)} erros")
    
    return {
        "success": True,
        "message": f"Reprocessamento concluído: {processed} artigos",
        "processed": processed,
        "total": len(all_articles),
        "onlyMissingEmbeddings": only_missing_embeddings,
        "graphSynced": graph_synced,
        "vectorSynced": vector_synced,
        "errors": errors if errors else None
    }
