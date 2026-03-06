from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
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
from app.services.rag_service import get_rag_service
from app.core.dependencies import get_current_user
from app.database import get_db


router = APIRouter()


@router.post("/generate-research-questions", response_model=ResearchQuestionsResponse)
async def generate_research_questions(
    data: ResearchQuestionsRequest,
    current_user: User = Depends(get_current_user)
):
    """Gerar perguntas de pesquisa baseadas no framework PICOC."""
    try:
        ai_service = get_ai_service()
        
        picoc = data.picocData.model_dump()
        questions = await ai_service.generate_research_questions(picoc)
        
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
        
        picoc = data.picocData.model_dump()
        searchStrings = await ai_service.generate_search_strings(
            data.researchQuestions, 
            picoc
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
    """Gerar critérios de inclusão e exclusão baseados no PICOC e perguntas de pesquisa."""
    try:
        ai_service = get_ai_service()
        
        picoc = data.picocData.model_dump()
        result = await ai_service.generate_criteria(
            data.researchQuestions, 
            picoc,
            data.projeto.model_dump() if data.projeto else None
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
        
        # Retrieve relevant articles via RAG
        rag_result = await rag_service.retrieve(
            query=last_message,
            project_id=data.projectId,
            db=db,
            top_k=5
        )
        
        # Generate response with project context
        response = await ai_service.chat_project(
            message=last_message,
            project_context=rag_result["project"],
            retrieved_articles=rag_result["articles"]
        )
        
        # Build sources list from retrieved articles
        sources = [
            ArticleSource(
                id=art["id"],
                title=art["title"],
                authors=art.get("authors"),
                year=art.get("year")
            )
            for art in rag_result["articles"]
        ]
        
        return ProjectChatResponse(content=response, sources=sources)
    
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Falha no chat com o projeto",
                "message": str(e)
            }
        )
