from datetime import datetime

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
    screeningGuidance: str | None = Field(None, max_length=4000)
    selectionReportNotes: str | None = Field(None, max_length=4000)


class ProjectCreate(ProjectBase):
    title: str = Field(..., min_length=1, max_length=100)
    objetivo: str = Field(..., min_length=1, max_length=1000)


class ProjectUpdate(ProjectBase):
    pass


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
    screeningGuidance: str | None = None
    selectionReportNotes: str | None = None
    ownerId: int
    createdAt: datetime
    updatedAt: datetime
    articleCount: int | None = None

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int
