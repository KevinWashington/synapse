from app.services.ai_service import AIService
from app.frameworks import (
    build_data_extraction_schema_prompt,
    build_quality_assessment_schema_prompt,
)


def test_schema_generation_prompts_escape_json_for_langchain_templates():
    args = (
        "PICOC",
        {
            "population": "desenvolvedores",
            "intervention": "ferramentas",
            "outcome": "qualidade",
            "context": "open-source",
        },
        ["Qual o impacto da tecnica X no resultado Y?"],
        {"title": "Projeto", "objetivo": "Avaliar impacto"},
    )

    extraction_system, _ = build_data_extraction_schema_prompt(*args)
    quality_system, _ = build_quality_assessment_schema_prompt(*args)

    assert '{{\n  "items"' in extraction_system
    assert '{{\n  "criteria"' in quality_system
    assert '"label": "Desfecho avaliado"' in extraction_system
    assert "O label deve ser nominal, curto e direto" in extraction_system
    assert "Cada op\u00e7\u00e3o deve ter no m\u00e1ximo 3 palavras e 35 caracteres" in extraction_system
    assert "Cada crit\u00e9rio deve ter no m\u00e1ximo 90 caracteres" in quality_system


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
          "label": "Impacto no resultado",
          "type": "text",
          "options": []
        },
        {
          "researchQuestionIndex": 2,
          "label": "Ado\u00e7\u00e3o industrial",
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
            "label": "Impacto no resultado",
            "type": "text",
            "options": [],
        },
        {
            "key": "rq_2",
            "label": "Ado\u00e7\u00e3o industrial",
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
            "label": "beneficios foram reportados",
            "type": "text",
            "options": [],
        },
    ]


def test_generated_extraction_schema_uses_short_fallback_label_when_ai_omits_label():
    service = AIService(api_key="test")
    research_questions = [
        "Quais s\u00e3o os tipos de servi\u00e7os ecossist\u00eamicos reguladores de suporte culturais e de provis\u00e3o reportados?",
    ]

    response = """
    {
      "items": [
        {
          "researchQuestionIndex": 1,
          "type": "multi_select",
          "options": ["Regula\u00e7\u00e3o", "Suporte", "Cultural"]
        }
      ]
    }
    """

    schema = service._build_generated_extraction_schema(response, research_questions)

    assert schema[0]["label"] == "tipos de servi\u00e7os ecossist\u00eamicos reguladores"
    assert len(schema[0]["label"]) <= 60


def test_generated_quality_schema_uses_fallback_when_json_is_invalid():
    service = AIService(api_key="test")

    schema = service._build_generated_quality_schema("sem json")

    assert len(schema) == 5
    assert schema[0]["key"] == "o_contexto_e_a_populacao_do_estudo_sao_descritos_com_clareza"


def test_generated_quality_schema_truncates_verbose_ai_labels():
    service = AIService(api_key="test")

    schema = service._build_generated_quality_schema(
        """
        {
          "criteria": [
            {
              "label": "O estudo declara claramente o contexto ecologico geografico e temporal incluindo tipo de montanha regiao bioma escala e justificativa metodologica detalhada"
            }
          ]
        }
        """
    )

    assert len(schema[0]["label"]) <= 90
