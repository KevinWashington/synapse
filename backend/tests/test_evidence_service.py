from app.services.evidence_service import (
    calculate_quality_metrics,
    merge_extraction_data,
    merge_quality_assessment_answers,
    sanitize_data_extraction_schema,
    sanitize_quality_assessment_schema,
)


def test_calculate_quality_metrics_handles_na_and_unrated():
    schema = [
        {"key": "bias", "label": "Bias"},
        {"key": "analysis", "label": "Analysis"},
    ]

    score, rating = calculate_quality_metrics(
        {"bias": "yes", "analysis": "na"},
        schema,
    )
    assert score == 100.0
    assert rating == "high"

    unrated_score, unrated_rating = calculate_quality_metrics({"bias": "na"}, schema)
    assert unrated_score is None
    assert unrated_rating == "unrated"


def test_merge_helpers_preserve_hidden_keys():
    extraction_schema = [
        {"key": "country", "label": "Country", "type": "single_select", "options": ["BR", "US"]},
    ]
    quality_schema = [
        {"key": "bias", "label": "Bias"},
    ]

    merged_extraction = merge_extraction_data(
        {"legacy_hidden": "keep", "country": "BR"},
        {"country": "US"},
        extraction_schema,
    )
    merged_quality = merge_quality_assessment_answers(
        {"legacy_hidden": "yes", "bias": "no"},
        {"bias": "partial"},
        quality_schema,
    )

    assert merged_extraction == {"legacy_hidden": "keep", "country": "US"}
    assert merged_quality == {"legacy_hidden": "yes", "bias": "partial"}


def test_schema_sanitizers_dedupe_and_normalize():
    extraction_schema = sanitize_data_extraction_schema(
        [
            {
                "key": "Country",
                "label": "Country",
                "type": "single_select",
                "options": ["BR", "BR", "US"],
            },
            {
                "key": "Country",
                "label": "Country Duplicate",
                "type": "unsupported",
            },
        ]
    )
    quality_schema = sanitize_quality_assessment_schema(
        [
            {"key": "Risk of Bias", "label": "Risk of Bias"},
            {"key": "Risk of Bias", "label": "Risk of Bias Duplicate"},
        ]
    )

    assert extraction_schema == [
        {
            "key": "country",
            "label": "Country",
            "type": "single_select",
            "options": ["BR", "US"],
        },
        {
            "key": "country_2",
            "label": "Country Duplicate",
            "type": "text",
            "options": [],
        },
    ]
    assert quality_schema == [
        {"key": "risk_of_bias", "label": "Risk of Bias"},
        {"key": "risk_of_bias_2", "label": "Risk of Bias Duplicate"},
    ]


def test_schema_sanitizers_limit_key_length_before_response_validation():
    long_label = (
        "O estudo declara claramente o contexto ecologico geografico e temporal "
        "incluindo tipo de montanha regiao bioma e escala"
    )

    quality_schema = sanitize_quality_assessment_schema(
        [
            {"label": long_label},
            {"label": long_label},
        ]
    )

    assert len(quality_schema[0]["key"]) <= 80
    assert len(quality_schema[1]["key"]) <= 80
    assert quality_schema[0]["key"] != quality_schema[1]["key"]
    assert quality_schema[1]["key"].endswith("_2")
