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


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    objetivo: str = Field(..., min_length=1, max_length=1000)
    status: str = Field(default="ideia")
    framework: str = Field(default="PICOC")
    picoc: PICOCSchema | None = None
    researchQuestions: list[str] | None = []
    keywords: list[str] | None = []
    searchStrings: list[str] | None = []
    criteriosInclusao: list[str] | None = []
    criteriosExclusao: list[str] | None = []


class ProjectUpdate(BaseModel):
    title: str | None = Field(None, max_length=100)
    objetivo: str | None = Field(None, max_length=1000)
    status: str | None = None
    framework: str | None = None
    picoc: PICOCSchema | None = None
    researchQuestions: list[str] | None = None
    keywords: list[str] | None = None
    searchStrings: list[str] | None = None
    criteriosInclusao: list[str] | None = None
    criteriosExclusao: list[str] | None = None


class ProjectResponse(BaseModel):
    id: int
    title: str
    objetivo: str
    status: str
    framework: str = "PICOC"
    picoc: dict | None = None
    researchQuestions: list[str] | None = []
    keywords: list[str] | None = []
    searchStrings: list[str] | None = []
    criteriosInclusao: list[str] | None = []
    criteriosExclusao: list[str] | None = []
    ownerId: int
    createdAt: datetime
    updatedAt: datetime
    articleCount: int | None = None

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel): 
    projects: list[ProjectResponse]
    total: int
