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
    picocData: PICOCInput
    projeto: ProjectContext | None = None


class ResearchQuestionsResponse(BaseModel):
    researchQuestions: list[str]


class SearchStringsRequest(BaseModel):
    researchQuestions: list[str]
    picocData: PICOCInput
    projeto: ProjectContext | None = None


class SearchStringsResponse(BaseModel):
    searchStrings: list[str]


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


class CriteriaRequest(BaseModel):
    researchQuestions: list[str]
    picocData: PICOCInput
    projeto: ProjectContext | None = None


class CriteriaResponse(BaseModel):
    inclusao: list[str]
    exclusao: list[str]


class ArticleSource(BaseModel):
    id: int
    title: str
    authors: str | None = None
    year: int | None = None


class ProjectChatRequest(BaseModel):
    messages: list[dict]
    projectId: int


class ProjectChatResponse(BaseModel):
    content: str
    sources: list[ArticleSource] = []
