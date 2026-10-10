from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, PositiveInt


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FindingItem(StrictSchema):
    text: str = Field(min_length=1, max_length=3_000)
    articleIds: list[PositiveInt] = Field(default_factory=list, max_length=500)


class SynthesisContent(StrictSchema):
    narrative: str = Field(default="", max_length=20_000)
    keyFindings: list[FindingItem] = Field(default_factory=list, max_length=50)
    divergences: list[FindingItem] = Field(default_factory=list, max_length=50)
    limitations: list[FindingItem] = Field(default_factory=list, max_length=50)


class GenerationRequest(StrictSchema):
    expectedVersion: int = Field(ge=0)
    questionFingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    replaceExisting: bool
    idempotencyKey: UUID


class ManualSynthesisUpdate(StrictSchema):
    expectedVersion: int = Field(ge=1)
    questionFingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    content: SynthesisContent


class GenerationStatus(StrictSchema):
    id: int
    rqNumber: int
    status: Literal["queued", "running", "succeeded", "failed", "cancelled", "conflict"]
    completedBatches: int = Field(ge=0)
    totalBatches: int = Field(ge=0)
    errorCode: str | None = None
