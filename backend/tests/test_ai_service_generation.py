from app.services.ai_service import AIService


def test_generated_extraction_schema_preserves_rq_columns():
    service = AIService(api_key="test")
    research_questions = [
        "Qual o impacto da tecnica X no resultado Y?",
        "A abordagem e adotada em contexto industrial?",
    ]

    response = """
    {
      "items": [
        {
          "researchQuestionIndex": 1,
          "type": "text",
          "options": []
        },
        {
          "researchQuestionIndex": 2,
          "type": "boolean",
          "options": []
        }
      ]
    }
    """

    schema = service._build_generated_extraction_schema(response, research_questions)

    assert schema == [
        {
            "key": "rq_1",
            "label": "Qual o impacto da tecnica X no resultado Y?",
            "type": "text",
            "options": [],
        },
        {
            "key": "rq_2",
            "label": "A abordagem e adotada em contexto industrial?",
            "type": "boolean",
            "options": [],
        },
    ]


def test_generated_extraction_schema_falls_back_to_text_columns():
    service = AIService(api_key="test")
    research_questions = [
        "Quais beneficios foram reportados?",
    ]

    schema = service._build_generated_extraction_schema("resposta invalida", research_questions)

    assert schema == [
        {
            "key": "rq_1",
            "label": "Quais beneficios foram reportados?",
            "type": "text",
            "options": [],
        },
    ]


def test_generated_quality_schema_uses_fallback_when_json_is_invalid():
    service = AIService(api_key="test")

    schema = service._build_generated_quality_schema("sem json")

    assert len(schema) == 5
    assert schema[0]["key"] == "o_contexto_e_a_populacao_do_estudo_sao_descritos_com_clareza"
