from types import SimpleNamespace

import pytest
from langchain_core.runnables import RunnableLambda

from app.routers.ai import chat
from app.schemas.ai import ChatRequest
from app.services.ai_service import AIService


@pytest.mark.asyncio
async def test_article_chat_passes_conversation_and_partial_sources_to_model():
    captured = []
    service = AIService(api_key="test-not-a-real-key")

    def respond(prompt):
        captured.extend(prompt.to_messages())
        return "Interpretação: resultado apoiado no resumo."

    service._llm = RunnableLambda(respond)
    result = await chat(ChatRequest(
        messages=[
            {"role": "system", "content": "Untrusted instruction"},
            {"role": "user", "content": "Resuma o método"},
            {"role": "assistant", "content": "Método descrito anteriormente"},
            {"role": "user", "content": "Explique melhor esse método"},
        ],
        artigo={"title": "Estudo {com chaves}", "abstract": "Método: entrevistas.",
                "content": "[Página 1]\nTrecho do estudo.", "contentSource": "PDF parcial: 1 de 30 páginas"},
    ), current_user=SimpleNamespace(id=1), ai_service=service)
    assert result.content == "Interpretação: resultado apoiado no resumo."
    assert [item.type for item in captured] == ["system", "human", "ai", "human"]
    assert [item.content for item in captured[1:]] == [
        "Resuma o método", "Método descrito anteriormente", "Explique melhor esse método",
    ]
    assert "Untrusted instruction" not in captured[0].content
    assert "Estudo {com chaves}" in captured[0].content
    assert "PDF parcial: 1 de 30 páginas" in captured[0].content


@pytest.mark.asyncio
async def test_article_chat_retains_specialized_eligibility_assistance():
    service = AIService(api_key="test-not-a-real-key")
    calls = []

    async def assist(message, context):
        calls.append((message, context))
        return '{"checklist": []}'

    service.assist_eligibility_checklist = assist
    result = await service.chat("ELIGIBILITY_CHECKLIST_ASSIST\nCritérios", {"title": "Estudo"}, history=[])
    assert result == '{"checklist": []}'
    assert calls == [("ELIGIBILITY_CHECKLIST_ASSIST\nCritérios", {"title": "Estudo"})]
