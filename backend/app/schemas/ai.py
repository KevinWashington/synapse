from pydantic import BaseModel, Field


class FrameworkComponentsInput(BaseModel):
    """Input flexível para componentes de qualquer framework.
    Aceita tanto chaves legadas em português quanto padronizadas em inglês.
    """
    # Chaves padronizadas (inglês)
    population: str | None = None
    intervention: str | None = None
    comparison: str | None = None
    outcome: str | None = None
    context: str | None = None
    exposure: str | None = None
    studyDesign: str | None = None
    # Chaves legadas (português) — mantidas por compatibilidade
    pessoa: str | None = None
    intervencao: str | None = None
    comparacao: str | None = None
    contexto: str | None = None


class ProjectContext(BaseModel):
    title: str | None = None
    objetivo: str | None = None


class ResearchQuestionsRequest(BaseModel):
    picocData: FrameworkComponentsInput
    projeto: ProjectContext | None = None
    framework: str = "PICOC"


class ResearchQuestionsResponse(BaseModel):
    researchQuestions: list[str]


class SearchStringsRequest(BaseModel):
    researchQuestions: list[str]
    picocData: FrameworkComponentsInput
    projeto: ProjectContext | None = None
    framework: str = "PICOC"
    targetDatabase: str = "scopus"


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
    picocData: FrameworkComponentsInput
    projeto: ProjectContext | None = None
    framework: str = "PICOC"


class CriteriaResponse(BaseModel):
    inclusao: list[str]
    exclusao: list[str]


class ArticleSource(BaseModel):
    id: int | None = None
    title: str
    authors: str | None = None
    year: int | None = None
    paperId: str | None = None
    provenance: dict | None = None


class ChatProvenance(BaseModel):
    backends: list[str] = Field(default_factory=list)
    subsystems: list[str] = Field(default_factory=list)
    sourceCount: int = 0
    projectId: int
    traceabilityComplete: bool = False


class ProjectChatRequest(BaseModel):
    messages: list[dict]
    projectId: int


class ProjectChatResponse(BaseModel):
    content: str
    sources: list[ArticleSource] = Field(default_factory=list)
    provenance: ChatProvenance | None = None


class MCPError(BaseModel):
    code: int
    message: str
    data: dict | None = None


class MCPRequestEnvelope(BaseModel):
    jsonrpc: str = "2.0"
    id: str | int
    method: str
    params: dict = Field(default_factory=dict)


class MCPResponseEnvelope(BaseModel):
    jsonrpc: str = "2.0"
    id: str | int
    result: dict | None = None
    error: MCPError | None = None


class GraphQueryPayload(BaseModel):
    cypher: str
    params: dict = Field(default_factory=dict)


class GraphWritePayload(BaseModel):
    cypher: str
    params: dict = Field(default_factory=dict)


class GraphHealthResponse(BaseModel):
    connected: bool
    server: str = "neo4j"
    details: dict = Field(default_factory=dict)


class SQLQueryPayload(BaseModel):
    query: str
    params: dict = Field(default_factory=dict)
    max_rows: int | None = None


class SQLWritePayload(BaseModel):
    query: str
    params: dict = Field(default_factory=dict)


class SQLHealthResponse(BaseModel):
    connected: bool
    vectorExtension: bool
    server: str = "postgres"
