from fastapi import APIRouter, Depends, HTTPException, status

from app.models.user import User
from app.schemas.ai import (
    ResearchQuestionsRequest,
    ResearchQuestionsResponse,
    SearchStringsRequest,
    SearchStringsResponse,
    ChatRequest,
    ChatResponse,
)
from app.services.ai_service import get_ai_service
from app.core.dependencies import get_current_user


router = APIRouter()


@router.post("/generate-research-questions", response_model=ResearchQuestionsResponse)
async def generate_research_questions(
    data: ResearchQuestionsRequest,
    current_user: User = Depends(get_current_user)
):
    """Gerar perguntas de pesquisa baseadas no framework PICOC."""
    try:
        ai_service = get_ai_service()
        
        picoc = data.picoc_data.model_dump()
        questions = await ai_service.generate_research_questions(picoc)
        
        return ResearchQuestionsResponse(research_questions=questions)
    
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
        
        picoc = data.picoc_data.model_dump()
        search_strings = await ai_service.generate_search_strings(
            data.research_questions, 
            picoc
        )
        
        return SearchStringsResponse(search_strings=search_strings)
    
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
