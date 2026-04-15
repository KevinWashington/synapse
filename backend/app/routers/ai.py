from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.project import Project
from app.schemas.ai import (
    ResearchQuestionsRequest,
    ResearchQuestionsResponse,
    SearchStringsRequest,
    SearchStringsResponse,
    ChatRequest,
    ChatResponse,
    CriteriaRequest,
    CriteriaResponse,
    ProjectChatRequest,
    ProjectChatResponse,
    ArticleSource,
)
from app.services.ai_service import get_ai_service
from app.services.graph_query_agent_service import get_graph_query_agent_service
from app.services.rag_service import get_rag_service
from app.core.dependencies import get_current_user
from app.database import get_db
from app.frameworks import normalize_framework_data


router = APIRouter()


def _fallback_provenance_for_project_chat(article: dict, project_id: int) -> dict:
    source_type = article.get("source_type", "unknown")
    if source_type == "sql_validated":
        subsystem = "sql"
        backend = "postgres"
    elif source_type == "vector":
        subsystem = "vector"
        backend = "qdrant"
    elif source_type.startswith("graph_expansion"):
        subsystem = "graph"
        backend = "neo4j"
    else:
        subsystem = "unknown"
        backend = "hybrid-mcp"

    return {
        "subsystem": subsystem,
        "backend": backend,
        "projectId": project_id,
        "paperId": article.get("paper_id"),
    }


def _extract_graph_sources(result: dict, project_id: int) -> list[dict]:
    if not result:
        return []

    sources: list[dict] = []
    seen: set[tuple[int | None, str | None]] = set()

    def add_source(
        *,
        article_id: int | None,
        paper_id: str | None,
        title: str | None,
        authors: str | None = None,
        year: int | None = None,
        provenance: dict | None = None,
    ) -> None:
        key = (article_id, paper_id)
        if key in seen or (article_id is None and paper_id is None) or not title:
            return
        seen.add(key)
        sources.append(
            {
                "id": article_id,
                "title": title,
                "authors": authors,
                "year": year,
                "paper_id": paper_id,
                "provenance": provenance
                or {
                    "subsystem": "graph",
                    "backend": "neo4j",
                    "projectId": project_id,
                    "paperId": paper_id,
                },
            }
        )

    for item in result.get("recommendations", []):
        add_source(
            article_id=item.get("article_id"),
            paper_id=item.get("paper_id"),
            title=item.get("title"),
            authors=item.get("authors"),
            year=item.get("year"),
        )

    for item in result.get("paths", []):
        add_source(
            article_id=item.get("article_id"),
            paper_id=item.get("paper_id"),
            title=item.get("title"),
            year=item.get("year"),
        )

    for cluster in result.get("clusters", []):
        for sample in cluster.get("sample_articles", []):
            add_source(
                article_id=sample.get("id"),
                paper_id=sample.get("paper_id"),
                title=sample.get("title"),
                authors=sample.get("authors"),
                year=sample.get("year"),
            )

    return sources


@router.post("/generate-research-questions", response_model=ResearchQuestionsResponse)
async def generate_research_questions(
    data: ResearchQuestionsRequest,
    current_user: User = Depends(get_current_user)
):
    """Gerar perguntas de pesquisa baseadas no framework selecionado."""
    try:
        ai_service = get_ai_service()
        
        framework = data.framework or "PICOC"
        raw_components = data.picocData.model_dump()
        components = normalize_framework_data(raw_components, framework)
        project_ctx = data.projeto.model_dump() if data.projeto else None
        
        questions = await ai_service.generate_research_questions(
            components, framework=framework, project_context=project_ctx
        )
        
        return ResearchQuestionsResponse(researchQuestions=questions)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Falha na geração de perguntas",
                "message": str(e)
            }
        )


@router.post("/generate-search-strings", response_model=SearchStringsResponse)
async def generate_search_strings(
    data: SearchStringsRequest,
    current_user: User = Depends(get_current_user)
):
    """Gerar strings de busca baseadas nas perguntas de pesquisa."""
    try:
        ai_service = get_ai_service()
        
        framework = data.framework or "PICOC"
        raw_components = data.picocData.model_dump()
        components = normalize_framework_data(raw_components, framework)
        project_ctx = data.projeto.model_dump() if data.projeto else None
        
        searchStrings = await ai_service.generate_search_strings(
            data.researchQuestions, 
            components,
            framework=framework,
            target_database=data.targetDatabase or "scopus",
            project_context=project_ctx,
        )
        
        return SearchStringsResponse(searchStrings=searchStrings)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Falha na geração de strings de busca",
                "message": str(e)
            }
        )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Chat com IA para análise de artigos."""
    try:
        ai_service = get_ai_service()
        
        # Get last user message
        last_message = ""
        for msg in reversed(data.messages):
            if msg.get("role") == "user":
                last_message = msg.get("content", "")
                break
        
        if not last_message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "Mensagem inválida",
                    "message": "Nenhuma mensagem do usuário encontrada"
                }
            )
        
        article_context = data.artigo.model_dump() if data.artigo else None
        response = await ai_service.chat(last_message, article_context)
        
        return ChatResponse(content=response)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Falha na comunicação com o modelo de IA",
                "message": str(e)
            }
        )


@router.post("/generate-criteria", response_model=CriteriaResponse)
async def generate_criteria(
    data: CriteriaRequest,
    current_user: User = Depends(get_current_user)
):
    """Gerar critérios de inclusão e exclusão baseados no framework e perguntas de pesquisa."""
    try:
        ai_service = get_ai_service()
        
        framework = data.framework or "PICOC"
        raw_components = data.picocData.model_dump()
        components = normalize_framework_data(raw_components, framework)
        project_ctx = data.projeto.model_dump() if data.projeto else None
        
        result = await ai_service.generate_criteria(
            data.researchQuestions, 
            components,
            framework=framework,
            project_context=project_ctx,
        )
        
        return CriteriaResponse(
            inclusao=result["inclusao"],
            exclusao=result["exclusao"]
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Falha na geração de critérios",
                "message": str(e)
            }
        )


@router.post("/project-chat", response_model=ProjectChatResponse)
async def project_chat(
    data: ProjectChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Chat com IA usando RAG sobre os artigos do projeto."""
    try:
        ai_service = get_ai_service()
        rag_service = get_rag_service()
        graph_agent = get_graph_query_agent_service()

        project = await db.get(Project, data.projectId)
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "Projeto não encontrado",
                    "message": f"Projeto {data.projectId} não encontrado"
                }
            )
        if project.ownerId != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "Acesso negado",
                    "message": "Você não tem permissão para consultar este projeto"
                }
            )
        
        # Get last user message
        last_message = ""
        for msg in reversed(data.messages):
            if msg.get("role") == "user":
                last_message = msg.get("content", "")
                break
        
        if not last_message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "Mensagem inválida",
                    "message": "Nenhuma mensagem do usuário encontrada"
                }
            )
        
        agent_plan = graph_agent.plan(last_message)

        if agent_plan.get("intent") != "fallback_hybrid_rag":
            agent_context = {
                "article_id": data.articleId,
                "paper_id": data.paperId,
                "author_query": data.authorQuery,
                "topic_query": data.topicQuery,
                "methodology": data.methodology,
                "limit": data.limit,
            }
            agent_result = await graph_agent.run(
                query=last_message,
                project_id=data.projectId,
                context=agent_context,
            )

            missing = agent_result.get("missing", [])
            if missing:
                response = (
                    "Preciso de mais contexto para executar essa consulta exploratória. "
                    f"Campos ausentes: {', '.join(missing)}."
                )
                graph_sources_raw = []
            else:
                response = await ai_service.chat_graph_agent(
                    message=last_message,
                    project_context={
                        "title": project.title,
                        "objetivo": project.objetivo,
                        "framework": getattr(project, "framework", "PICOC") or "PICOC",
                        "picoc": getattr(project, "picoc", {}) or {},
                        "researchQuestions": project.researchQuestions or [],
                    },
                    agent_plan=agent_result["plan"],
                    agent_trace=agent_result["trace"],
                    agent_result=agent_result.get("result"),
                )
                graph_sources_raw = _extract_graph_sources(agent_result.get("result") or {}, data.projectId)

            sources = [
                ArticleSource(
                    id=art.get("id"),
                    title=art.get("title", "N/A"),
                    authors=art.get("authors"),
                    year=art.get("year"),
                    paperId=art.get("paper_id"),
                    provenance=art.get("provenance"),
                )
                for art in graph_sources_raw
            ]

            backends = sorted({
                (art.get("provenance") or {}).get("backend")
                for art in graph_sources_raw
                if (art.get("provenance") or {}).get("backend")
            })
            subsystems = sorted({
                (art.get("provenance") or {}).get("subsystem")
                for art in graph_sources_raw
                if (art.get("provenance") or {}).get("subsystem")
            })
            traceability_complete = all(
                bool((art.get("provenance") or {}).get("paperId"))
                for art in graph_sources_raw
            ) if graph_sources_raw else True

            provenance = {
                "backends": backends,
                "subsystems": subsystems,
                "sourceCount": len(graph_sources_raw),
                "projectId": data.projectId,
                "traceabilityComplete": traceability_complete,
                "agentIntent": agent_result["plan"].get("intent"),
                "agentTools": agent_result["plan"].get("tools", []),
                "agentTrace": agent_result.get("trace", []),
            }
        else:
            rag_result = await rag_service.retrieve(
                query=last_message,
                project_id=data.projectId,
                db=db,
                top_k=5,
                owner_id=current_user.id,
            )

            response = await ai_service.chat_project(
                message=last_message,
                project_context=rag_result["project"],
                retrieved_articles=rag_result["articles"]
            )

            sources = [
                ArticleSource(
                    id=art.get("id"),
                    title=art.get("title", "N/A"),
                    authors=art.get("authors"),
                    year=art.get("year"),
                    paperId=art.get("paper_id"),
                    provenance=art.get("provenance") or _fallback_provenance_for_project_chat(art, data.projectId),
                )
                for art in rag_result["articles"]
            ]

            backends = sorted({
                (art.get("provenance") or {}).get("backend")
                for art in rag_result["articles"]
                if (art.get("provenance") or {}).get("backend")
            })
            subsystems = sorted({
                (art.get("provenance") or {}).get("subsystem")
                for art in rag_result["articles"]
                if (art.get("provenance") or {}).get("subsystem")
            })
            traceability_complete = all(
                bool((art.get("provenance") or {}).get("paperId"))
                for art in rag_result["articles"]
            ) if rag_result["articles"] else True

            diagnostics = rag_result.get("diagnostics") or {}
            tool_call_counts = (diagnostics.get("tool_calls") or {}) if isinstance(diagnostics, dict) else {}

            fallback_agent_tools = []
            if tool_call_counts.get("tool3_vector", 0) > 0:
                fallback_agent_tools.append("search_semantic")
            if tool_call_counts.get("tool1_graph", 0) > 0:
                fallback_agent_tools.append("execute_expansion")
            if tool_call_counts.get("tool2_sql", 0) > 0:
                fallback_agent_tools.append("rerank_by_impact")

            fallback_agent_trace = []
            if tool_call_counts.get("tool3_vector", 0) > 0:
                fallback_agent_trace.append(
                    {
                        "tool": "search_semantic",
                        "observation": {"calls": tool_call_counts.get("tool3_vector", 0)},
                    }
                )
            if tool_call_counts.get("tool1_graph", 0) > 0:
                fallback_agent_trace.append(
                    {
                        "tool": "execute_expansion",
                        "observation": {"calls": tool_call_counts.get("tool1_graph", 0)},
                    }
                )
            if tool_call_counts.get("tool2_sql", 0) > 0:
                fallback_agent_trace.append(
                    {
                        "tool": "rerank_by_impact",
                        "observation": {"calls": tool_call_counts.get("tool2_sql", 0)},
                    }
                )

            provenance = {
                "backends": backends,
                "subsystems": subsystems,
                "sourceCount": len(rag_result["articles"]),
                "projectId": data.projectId,
                "traceabilityComplete": traceability_complete,
                "agentIntent": "fallback_hybrid_rag",
                "agentTools": fallback_agent_tools,
                "agentTrace": fallback_agent_trace,
            }
        
        return ProjectChatResponse(content=response, sources=sources, provenance=provenance)
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Projeto não encontrado",
                "message": str(e)
            }
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Acesso negado",
                "message": str(e)
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Falha no chat com o projeto",
                "message": str(e)
            }
        )
