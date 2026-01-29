from datetime import datetime
from pydantic import BaseModel, Field


class ArticleCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    authors: str = Field(..., min_length=1, max_length=300)
    year: int = Field(..., ge=1900, le=2100)
    journal: str = Field(..., min_length=1, max_length=200)
    doi: str | None = Field(None, max_length=100)
    abstract: str | None = Field(None, max_length=5000)
    keywords: str | None = Field(None, max_length=500)
    pages: str | None = Field(None, max_length=50)
    volume: str | None = Field(None, max_length=50)
    number: str | None = Field(None, max_length=50)
    issn: str | None = Field(None, max_length=50)
    notas: str | None = None


class ArticleUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    authors: str | None = Field(None, max_length=300)
    year: int | None = Field(None, ge=1900, le=2100)
    journal: str | None = Field(None, max_length=200)
    doi: str | None = Field(None, max_length=100)
    abstract: str | None = None
    keywords: str | None = Field(None, max_length=500)
    pages: str | None = Field(None, max_length=50)
    volume: str | None = Field(None, max_length=50)
    number: str | None = Field(None, max_length=50)
    issn: str | None = Field(None, max_length=50)
    notas: str | None = None


class ArticleStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pendente|analisado|excluido)$")


class ArticleNotesUpdate(BaseModel):
    notas: str


class ArticleResponse(BaseModel):
    id: int
    title: str
    authors: str
    year: int
    journal: str
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
    projectId: int
    ownerId: int
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_pdf_check(cls, article):
        data = cls.model_validate(article)
        data.hasPdf = article.pdfData is not None
        return data


class ArticleListResponse(BaseModel):
    articles: list[ArticleResponse]
    total: int
    page: int = 1
    limit: int = 50


class RelationshipCreate(BaseModel):
    relatedArticleId: int
