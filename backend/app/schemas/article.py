from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ENTRY_METHODS = Literal["manual", "bibtex"]
SOURCE_CATEGORIES = Literal["database", "grey_literature", "manual_other"]
CURRENT_PHASES = Literal["identification", "screening", "eligibility", "included"]
REVIEW_OUTCOMES = Literal[
    "active",
    "duplicate_removed",
    "excluded_screening",
    "full_text_unavailable",
    "excluded_eligibility",
    "included",
]
SCREENING_DECISIONS = Literal["pending", "included", "excluded"]
FULL_TEXT_STATUSES = Literal["not_requested", "pending_upload", "uploaded", "unavailable"]
ELIGIBILITY_DECISIONS = Literal["pending", "included", "excluded"]
DUPLICATE_REASON_CODES = Literal[
    "same_doi",
    "same_title_year",
    "strong_metadata_match",
    "manual_merge",
    "other",
]


class ArticleCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    authors: str = Field(..., min_length=1, max_length=300)
    year: int = Field(..., ge=1900, le=2100)
    journal: str = Field(..., min_length=1, max_length=200)
    sourceCategory: SOURCE_CATEGORIES
    sourceName: str = Field(..., min_length=1, max_length=120)
    entryMethod: ENTRY_METHODS = "manual"
    importBatchLabel: str | None = Field(None, max_length=120)
    paperId: str | None = Field(None, max_length=120)
    doi: str | None = Field(None, max_length=100)
    abstract: str | None = Field(None, max_length=8000)
    keywords: str | None = Field(None, max_length=500)
    pages: str | None = Field(None, max_length=50)
    volume: str | None = Field(None, max_length=50)
    number: str | None = Field(None, max_length=50)
    issn: str | None = Field(None, max_length=50)
    notas: str | None = None


class ArticleUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    authors: str | None = Field(None, min_length=1, max_length=300)
    year: int | None = Field(None, ge=1900, le=2100)
    journal: str | None = Field(None, min_length=1, max_length=200)
    sourceCategory: SOURCE_CATEGORIES | None = None
    sourceName: str | None = Field(None, min_length=1, max_length=120)
    importBatchLabel: str | None = Field(None, max_length=120)
    paperId: str | None = Field(None, max_length=120)
    doi: str | None = Field(None, max_length=100)
    abstract: str | None = None
    keywords: str | None = Field(None, max_length=500)
    pages: str | None = Field(None, max_length=50)
    volume: str | None = Field(None, max_length=50)
    number: str | None = Field(None, max_length=50)
    issn: str | None = Field(None, max_length=50)
    notas: str | None = None


class ArticleNotesUpdate(BaseModel):
    notas: str


class ImportBibTeXArticleInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    authors: str = Field(..., min_length=1, max_length=300)
    year: int = Field(..., ge=1900, le=2100)
    journal: str = Field(..., min_length=1, max_length=200)
    paperId: str | None = Field(None, max_length=120)
    doi: str | None = Field(None, max_length=100)
    abstract: str | None = Field(None, max_length=8000)
    keywords: str | None = Field(None, max_length=500)
    pages: str | None = Field(None, max_length=50)
    volume: str | None = Field(None, max_length=50)
    number: str | None = Field(None, max_length=50)
    issn: str | None = Field(None, max_length=50)
    notas: str | None = None


class ImportBibTeXRequest(BaseModel):
    sourceCategory: SOURCE_CATEGORIES
    sourceName: str = Field(..., min_length=1, max_length=120)
    importBatchLabel: str | None = Field(None, max_length=120)
    entries: list[ImportBibTeXArticleInput] = Field(default_factory=list)


class ImportBibTeXResponse(BaseModel):
    projectId: int
    importedCount: int
    batchLabel: str | None = None
    articleIds: list[int] = Field(default_factory=list)


class SelectionSummaryPhaseItem(BaseModel):
    total: int = 0
    active: int = 0
    excluded: int = 0


class SelectionSummaryResponse(BaseModel):
    projectId: int
    totalRecords: int
    identification: SelectionSummaryPhaseItem
    screening: SelectionSummaryPhaseItem
    eligibility: SelectionSummaryPhaseItem
    included: int
    duplicatesRemoved: int
    greyLiterature: int
    fullTextUnavailable: int
    bySource: list[dict] = Field(default_factory=list)


class DuplicateCandidateArticle(BaseModel):
    id: int
    title: str
    authors: str
    year: int
    journal: str
    doi: str | None = None
    sourceName: str
    sourceCategory: str
    reviewOutcome: str


class DuplicateCandidate(BaseModel):
    groupKey: str
    reasonCode: DUPLICATE_REASON_CODES
    reasonText: str
    candidateIds: list[int]
    articles: list[DuplicateCandidateArticle] = Field(default_factory=list)


class DedupAnalyzeResponse(BaseModel):
    projectId: int
    candidateCount: int
    candidates: list[DuplicateCandidate] = Field(default_factory=list)


class DedupApplyDecision(BaseModel):
    groupKey: str = Field(..., min_length=1, max_length=120)
    canonicalArticleId: int
    duplicateArticleIds: list[int] = Field(default_factory=list)
    reasonCode: DUPLICATE_REASON_CODES = "manual_merge"
    reasonText: str | None = Field(None, max_length=2000)


class DedupApplyRequest(BaseModel):
    decisions: list[DedupApplyDecision] = Field(default_factory=list)


class DedupApplyResponse(BaseModel):
    projectId: int
    appliedGroups: int
    removedDuplicates: int


class PromoteToScreeningRequest(BaseModel):
    articleIds: list[int] = Field(default_factory=list)


class PromoteToScreeningResponse(BaseModel):
    projectId: int
    movedCount: int


class ScreeningDecisionRequest(BaseModel):
    decision: Literal["included", "excluded"]
    reasonText: str | None = Field(None, max_length=2000)


class FullTextStatusUpdate(BaseModel):
    fullTextStatus: Literal["pending_upload", "uploaded", "unavailable"]
    reasonText: str | None = Field(None, max_length=2000)


class EligibilityDecisionRequest(BaseModel):
    decision: Literal["included", "excluded", "full_text_unavailable"]
    reasonText: str | None = Field(None, max_length=2000)
    checklistAnswers: dict[str, str | bool | int | float | None] = Field(default_factory=dict)
    answeringRQs: list[int] = Field(default_factory=list)


class BatchEvaluateRequest(BaseModel):
    limit: int = Field(default=200, ge=1, le=2000)
    onlyPending: bool = True
    forceReevaluate: bool = False
    dryRun: bool = False


class BatchEvaluateSummary(BaseModel):
    totalCandidates: int
    evaluated: int
    skippedNoAbstract: int
    skippedAlreadyEvaluated: int
    suggestedIncluded: int
    suggestedExcluded: int


class BatchEvaluateResponse(BaseModel):
    summary: BatchEvaluateSummary
    projectId: int


class LegacyArticleStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pendente|analisado|excluido)$")


class LegacyArticleDecisionUpdate(BaseModel):
    decision: str = Field(..., pattern="^(pendente|incluido|excluido)$")
    reason: str | None = Field(None, max_length=2000)
    exclusionCriteria: list[str] = Field(default_factory=list)
    answeringRQs: list[int] = Field(default_factory=list)
    useSuggestedRQs: bool = True


class ArticleResponse(BaseModel):
    id: int
    paperId: str | None = None
    title: str
    authors: str
    year: int
    journal: str
    sourceCategory: str
    sourceName: str
    entryMethod: str
    importBatchLabel: str | None = None
    currentPhase: str
    reviewOutcome: str
    duplicateGroupKey: str | None = None
    duplicateOfArticleId: int | None = None
    duplicateReasonCode: str | None = None
    duplicateReasonText: str | None = None
    screeningDecision: str
    screeningReasonText: str | None = None
    screeningReviewedAt: datetime | None = None
    fullTextStatus: str
    eligibilityDecision: str
    eligibilityReasonText: str | None = None
    eligibilityReviewedAt: datetime | None = None
    eligibilityChecklistAnswers: dict | None = None
    includedAt: datetime | None = None
    doi: str | None = None
    abstract: str | None = None
    keywords: str | None = None
    pages: str | None = None
    volume: str | None = None
    number: str | None = None
    issn: str | None = None
    notas: str | None = None
    status: str
    pdfFilename: str | None = None
    hasPdf: bool = False
    aiEvaluation: str | None = None
    aiSuggestedStatus: str | None = None
    aiRelevanceScore: int | None = None
    aiSuggestedRQs: list[int] | None = None
    manualDecision: str | None = None
    manualDecisionReason: str | None = None
    exclusionCriteria: list[str] | None = None
    answeringRQs: list[int] | None = None
    decisionUpdatedAt: datetime | None = None
    aiMethodology: str | None = None
    aiDatabase: str | None = None
    aiDomain: str | None = None
    aiKeywords: list[str] | None = None
    projectId: int
    ownerId: int
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True


class ArticleListResponse(BaseModel):
    articles: list[ArticleResponse]
    total: int
    page: int = 1
    limit: int = 50


class SelectionReportCounts(BaseModel):
    identified: int
    duplicatesRemoved: int
    screeningPool: int
    excludedScreening: int
    eligibilityPool: int
    fullTextUnavailable: int
    excludedEligibility: int
    included: int


class SelectionReportResponse(BaseModel):
    projectId: int
    projectTitle: str
    counts: SelectionReportCounts
    bySource: list[dict] = Field(default_factory=list)
    exclusionReasons: dict[str, list[dict]] = Field(default_factory=dict)
    greyLiteratureCount: int = 0


class RelationshipCreate(BaseModel):
    relatedArticleId: int
