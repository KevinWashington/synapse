from pydantic import BaseModel


class PICOCInput(BaseModel):
    pessoa: str | None = None
    intervencao: str | None = None
    comparacao: str | None = None
    outcome: str | None = None
    contexto: str | None = None


class ProjectContext(BaseModel):
    title: str | None = None
    objetivo: str | None = None


class ResearchQuestionsRequest(BaseModel):
    picoc_data: PICOCInput
    projeto: ProjectContext | None = None


class ResearchQuestionsResponse(BaseModel):
    research_questions: list[str]


class SearchStringsRequest(BaseModel):
    research_questions: list[str]
    picoc_data: PICOCInput
    projeto: ProjectContext | None = None


class SearchStringsResponse(BaseModel):
    search_strings: list[str]


class ArticleContext(BaseModel):
    title: str
    authors: str | None = None
    year: int | None = None
    journal: str | None = None
    doi: str | None = None
    abstract: str | None = None
    content: str | None = None
    notas: str | None = None


class ChatRequest(BaseModel):
    messages: list[dict]
    artigo: ArticleContext | None = None


class ChatResponse(BaseModel):
    content: str
