from datetime import datetime
from typing import Any, Literal
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
    expectedVersion: int = Field(ge=0)
    questionFingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")
    content: SynthesisContent


class GenerationStatus(StrictSchema):
    id: int
    rqNumber: int
    status: Literal["queued", "running", "succeeded", "failed", "cancelled", "conflict"]
    completedBatches: int = Field(ge=0)
    totalBatches: int = Field(ge=0)
    errorCode: str | None = None


class ResponseSchema(BaseModel):
    """Permissive response base for legacy and schema-driven synthesis fields."""

    model_config = ConfigDict(extra="allow")


class SynthesisOverviewResponse(StrictSchema):
    includedCount: int
    extractedCount: int
    coveredRQCount: int
    qualityAssessedCount: int
    researchQuestionCount: int


class RQListItemResponse(StrictSchema):
    rqNumber: int
    question: str
    evidenceCount: int
    draftState: Literal["not_started", "stale", "draft"]
    duplicateQuestion: bool


class RQListResponse(StrictSchema):
    items: list[RQListItemResponse]
    page: int
    pageSize: int
    total: int


class SynthesisDraftResponse(StrictSchema):
    content: SynthesisContent
    version: int
    questionFingerprint: str
    evidenceFingerprint: str
    updatedAt: datetime | None = None
    updatedByUserId: int | None = None


class RQDraftDetailResponse(SynthesisDraftResponse):
    questionSnapshot: str | None = None
    sourceArticleIds: list[int] = Field(default_factory=list)
    modelName: str | None = None
    generatedAt: datetime | None = None
    staleCandidate: bool = False


class QualitySummaryResponse(StrictSchema):
    counts: dict[str, int]
    total: int


class RQDetailContextResponse(StrictSchema):
    evidenceCount: int
    includedCount: int
    coverage: float
    quality: QualitySummaryResponse
    freshness: Literal["current", "stale"]


class RQDetailResponse(StrictSchema):
    rqNumber: int
    question: str
    questionFingerprint: str
    draft: RQDraftDetailResponse | None
    context: RQDetailContextResponse
    activeGeneration: GenerationStatus | None = None
    lastGeneration: GenerationStatus | None = None


class SynthesisArticleResponse(ResponseSchema):
    articleId: int | None = None
    paperId: str | None = None
    title: str | None = None
    authors: str | None = None
    year: int | None = None
    journal: str | None = None
    sourceName: str | None = None
    sourceCategory: str | None = None
    decision: str | None = None
    rqNumbers: list[int] | None = None
    evidenceExcerpt: str | None = None
    excerptKind: str | None = None
    extractionValues: dict[str, Any] | None = None
    extractionCompleted: bool | None = None
    qualityScore: float | None = None
    qualityRating: str | None = None
    qualityAnswers: dict[str, Any] | None = None


class EvidenceListResponse(StrictSchema):
    items: list[SynthesisArticleResponse]
    page: int
    pageSize: int
    total: int


class MatrixResponse(StrictSchema):
    items: list[dict[str, Any]]
    page: int
    pageSize: int
    total: int


class ChartCatalogResponse(StrictSchema):
    key: str
    label: str
    type: str
    group: str
    rqNumber: int | None = None


class ChartTextRowsResponse(StrictSchema):
    items: list[dict[str, Any]]
    page: int
    pageSize: int
    total: int


class ChartResponse(ResponseSchema):
    key: str
    field: dict[str, Any] | None = None
    question: str | None = None
    type: str | None = None
    sampleSize: int
    missingCount: int
    rows: list[dict[str, Any]] | ChartTextRowsResponse


class QualityCriteriaResponse(StrictSchema):
    key: str
    label: str
    kind: Literal["overall", "criterion"]
    total: int
    distribution: dict[str, int]


class QualityStudyListResponse(StrictSchema):
    items: list[SynthesisArticleResponse]
    page: int
    pageSize: int
    total: int


class QualityStudyResponse(SynthesisArticleResponse):
    pass
