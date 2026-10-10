import pytest
from pydantic import ValidationError

from app.models.synthesis import RQSynthesis, SynthesisGenerationJob
from app.schemas.synthesis import GenerationRequest


def test_one_active_draft_per_project_rq_and_archive_retains_content():
    draft_table = RQSynthesis.__table__
    rq_number = draft_table.c.rqNumber
    active_index = next(
        index for index in draft_table.indexes if index.name == "uq_synthesis_project_rq_active"
    )

    assert rq_number.nullable is True
    assert active_index.unique is True
    assert [column.name for column in active_index.columns] == ["projectId", "rqNumber"]
    assert '"rqNumber" IS NOT NULL' in str(active_index.dialect_options["postgresql"]["where"])
    assert draft_table.c.content.nullable is False


def test_job_contains_no_credentials_and_draft_starts_at_version_one():
    job_table = SynthesisGenerationJob.__table__
    draft_table = RQSynthesis.__table__

    assert not {"apiKey", "credential", "secret"}.intersection(job_table.c.keys())
    assert draft_table.c.version.default.arg == 1


def test_generation_request_rejects_api_key_fields():
    with pytest.raises(ValidationError):
        GenerationRequest.model_validate(
            {
                "expectedVersion": 0,
                "questionFingerprint": "a" * 64,
                "replaceExisting": False,
                "idempotencyKey": "f1ea9813-f954-40af-958e-c5e0c94b0d4c",
                "apiKey": "must-not-be-accepted",
            }
        )
