import json

import pytest
from langchain_core.runnables import RunnableLambda

from app.services.ai_service import AIService
from app.services.synthesis_generation_service import generate_synthesis


@pytest.mark.asyncio
@pytest.mark.parametrize("fenced", [False, True])
async def test_real_synthesis_adapter_parses_provider_response_and_preserves_sources(fenced):
    payload = {"narrative": "Síntese apoiada na evidência.", "keyFindings": [{"text": "Achado", "articleIds": [7]}],
               "divergences": [], "limitations": []}
    response = json.dumps(payload)
    if fenced:
        response = f"```json\n{response}\n```"
    service = AIService(api_key="test-only-not-a-real-key")
    # Replace only the external model transport; use the real prompt, output
    # parser, synthesis adapter and validation that the worker calls.
    service._llm = RunnableLambda(lambda prompt: response)
    result = await generate_synthesis(service, question="Qual o achado?", packets=[{"articleId": 7, "title": "Estudo"}])
    assert result.narrative == "Síntese apoiada na evidência."
    assert result.keyFindings[0].articleIds == [7]


@pytest.mark.asyncio
@pytest.mark.parametrize("response", ["not-json", "[]"])
async def test_real_synthesis_adapter_rejects_non_object_model_output(response):
    service = AIService(api_key="test-only-not-a-real-key")
    service._llm = RunnableLambda(lambda prompt: response)
    with pytest.raises(ValueError, match="JSON object"):
        await service.synthesize_evidence(question="RQ", packets=[{"articleId": 7}], stage="final")
