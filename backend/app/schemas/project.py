from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PICOCSchema(BaseModel):
    """Schema de componentes de framework com chaves canônicas em inglês."""

    outcome: str | None = Field(None, max_length=500)
    population: str | None = Field(None, max_length=500)
    intervention: str | None = Field(None, max_length=500)
    comparison: str | None = Field(None, max_length=500)
    exposure: str | None = Field(None, max_length=500)
    context: str | None = Field(None, max_length=500)
    studyDesign: str | None = Field(None, max_length=500)


EXTRACTION_FIELD_TYPES = Literal["text", "number", "single_select", "multi_select", "boolean"]


class DataExtractionFieldSchema(BaseModel):
    key: str = Field(..., min_length=1, max_length=80, pattern=r"^[a-z0-9]+(?:_[a-z0-9]+)*$")
    label: str = Field(..., min_length=1, max_length=120)
    type: EXTRACTION_FIELD_TYPES = "text"
    options: list[str] = Field(default_factory=list)


class QualityCriterionSchema(BaseModel):
    key: str = Field(..., min_length=1, max_length=80, pattern=r"^[a-z0-9]+(?:_[a-z0-9]+)*$")
    label: str = Field(..., min_length=1, max_length=120)


class ProjectBase(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=100)
    objetivo: str | None = Field(None, min_length=1, max_length=1000)
    status: str | None = "ideia"
    framework: str | None = "PICOC"
    picoc: PICOCSchema | None = None
    researchQuestions: list[str] | None = Field(default_factory=list)
    keywords: list[str] | None = Field(default_factory=list)
    searchStrings: list[str] | None = Field(default_factory=list)
    criteriosInclusao: list[str] | None = Field(default_factory=list)
    criteriosExclusao: list[str] | None = Field(default_factory=list)
    eligibilityChecklist: list[str] | None = Field(default_factory=list)
    dataExtractionSchema: list[DataExtractionFieldSchema] | None = Field(default_factory=list)
    qualityAssessmentSchema: list[QualityCriterionSchema] | None = Field(default_factory=list)
    screeningGuidance: str | None = Field(None, max_length=4000)
    selectionReportNotes: str | None = Field(None, max_length=4000)


class ProjectCreate(ProjectBase):
    title: str = Field(..., min_length=1, max_length=100)
    objetivo: str = Field(..., min_length=1, max_length=1000)


class ProjectUpdate(ProjectBase):
    pass


class ProjectPrismaStats(BaseModel):
    identified: int = 0
    screening: int = 0
    eligible: int = 0
    included: int = 0


class ProjectOverviewSource(BaseModel):
    sourceCategory: str
    sourceName: str
    total: int = 0
    included: int = 0
    duplicatesRemoved: int = 0
    excluded: int = 0


class ProjectOverviewStudyType(BaseModel):
    label: str
    total: int = 0
    percentage: float = 0


class ProjectOverviewEvolutionPoint(BaseModel):
    date: str
    identification: int = 0
    screening: int = 0
    eligibility: int = 0
    included: int = 0


class ProjectOverviewReviewerAgreement(BaseModel):
    reviewed: int = 0
    agreed: int = 0
    rate: float | None = None


class ProjectOverviewActivity(BaseModel):
    id: str
    type: str
    label: str
    description: str
    timestamp: datetime
    articleId: int | None = None


class ProjectOverviewPlanningSummary(BaseModel):
    framework: str
    researchQuestionCount: int = 0
    searchStringCount: int = 0
    inclusionCriteriaCount: int = 0
    exclusionCriteriaCount: int = 0
    eligibilityChecklistCount: int = 0
    extractionFieldCount: int = 0
    qualityCriteriaCount: int = 0
    lastUpdatedAt: datetime


class ProjectOverviewResponse(BaseModel):
    projectId: int
    prismaStats: ProjectPrismaStats
    sources: list[ProjectOverviewSource] = Field(default_factory=list)
    studyTypes: list[ProjectOverviewStudyType] = Field(default_factory=list)
    evolution: list[ProjectOverviewEvolutionPoint] = Field(default_factory=list)
    reviewerAgreement: ProjectOverviewReviewerAgreement = Field(default_factory=ProjectOverviewReviewerAgreement)
    recentActivities: list[ProjectOverviewActivity] = Field(default_factory=list)
    planningSummary: ProjectOverviewPlanningSummary


class ProjectResponse(BaseModel):
    id: int
    title: str
    objetivo: str
    status: str
    framework: str = "PICOC"
    picoc: dict | None = None
    researchQuestions: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    searchStrings: list[str] = Field(default_factory=list)
    criteriosInclusao: list[str] = Field(default_factory=list)
    criteriosExclusao: list[str] = Field(default_factory=list)
    eligibilityChecklist: list[str] = Field(default_factory=list)
    dataExtractionSchema: list[DataExtractionFieldSchema] = Field(default_factory=list)
    qualityAssessmentSchema: list[QualityCriterionSchema] = Field(default_factory=list)
    screeningGuidance: str | None = None
    selectionReportNotes: str | None = None
    ownerId: int
    createdAt: datetime
    updatedAt: datetime
    articleCount: int | None = None
    prismaStats: ProjectPrismaStats = Field(default_factory=ProjectPrismaStats)

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int
