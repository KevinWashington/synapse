from datetime import datetime
from pydantic import BaseModel, Field


class PICOCSchema(BaseModel):
    pessoa: str | None = Field(None, max_length=500)
    intervencao: str | None = Field(None, max_length=500)
    comparacao: str | None = Field(None, max_length=500)
    outcome: str | None = Field(None, max_length=500)
    contexto: str | None = Field(None, max_length=500)


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    objetivo: str = Field(..., min_length=1, max_length=1000)
    status: str = Field(default="ideia")
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
