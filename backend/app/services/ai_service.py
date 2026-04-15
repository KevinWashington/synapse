"""
Serviço de IA baseado em LangChain + Google Gemini.

Responsável pela geração de questões de pesquisa, strings de busca,
critérios de inclusão/exclusão, avaliação de artigos e chat.
"""

import json
import re
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.config import settings
from app.frameworks import (
    build_research_questions_prompt,
    build_search_string_prompt,
    build_criteria_prompt,
    normalize_framework_data,
    _build_components_text,
    FRAMEWORK_COMPONENTS,
)
from app.schemas.ai import MCPRequestEnvelope, MCPResponseEnvelope


class AIService:
    """LangChain-based AI service using Google Gemini."""
    
    def __init__(self, api_key: str | None = None, model: str = "gemini-2.0-flash"):
        self.api_key = api_key or settings.GOOGLE_API_KEY
        self.model_name = model
        self._llm = None
    
    @property
    def llm(self) -> ChatGoogleGenerativeAI:
        """Lazy loading of LLM."""
        if self._llm is None:
            self._llm = ChatGoogleGenerativeAI(
                model=self.model_name,
                google_api_key=self.api_key,
                temperature=0.7,
            )
        return self._llm
    
    async def generate_research_questions(
        self,
        components: dict,
        framework: str = "PICOC",
        project_context: dict | None = None,
    ) -> list[str]:
        """Generate research questions based on the selected framework.
        
        Args:
            components: Framework component values (standardized English keys).
            framework: Framework type (PICO, PICOS, PECO, PICOC).
            project_context: Optional project context (title, objetivo).
        """
        system_msg, user_msg = build_research_questions_prompt(
            framework, components, project_context
        )
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_msg),
            ("user", user_msg),
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        result = await chain.ainvoke({})
        
        return self._parse_numbered_list(result)
    
    async def generate_search_strings(
        self,
        research_questions: list[str],
        components: dict,
        framework: str = "PICOC",
        target_database: str = "scopus",
        project_context: dict | None = None,
    ) -> list[str]:
        """Generate search strings based on research questions and framework.
        
        Args:
            research_questions: List of research questions.
            components: Framework component values.
            framework: Framework type.
            target_database: Target database (scopus, web_of_science, ieee).
            project_context: Optional project context.
        """
        system_msg, user_msg = build_search_string_prompt(
            framework, components, research_questions, target_database, project_context
        )
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_msg),
            ("user", user_msg),
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        result = await chain.ainvoke({})
        
        return self._parse_numbered_list(result)
    
    async def generate_criteria(
        self,
        research_questions: list[str],
        components: dict,
        framework: str = "PICOC",
        project_context: dict | None = None,
    ) -> dict[str, list[str]]:
        """Generate inclusion and exclusion criteria based on research questions and framework.
        
        Args:
            research_questions: List of research questions.
            components: Framework component values.
            framework: Framework type.
            project_context: Optional project context.
        """
        system_msg, user_msg = build_criteria_prompt(
            framework, components, research_questions, project_context
        )
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_msg),
            ("user", user_msg),
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        result = await chain.ainvoke({})
        
        # Parse the dual list
        inclusion = []
        exclusion = []
        
        current_section = None
        for line in result.split("\n"):
            line = line.strip()
            if not line: continue
            
            if "INCLUSÃO" in line.upper():
                current_section = "in"
                continue
            elif "EXCLUSÃO" in line.upper():
                current_section = "ex"
                continue
            
            match = re.match(r'^(\d+)[.)]\s*(.*)$', line)
            if match:
                cleaned = match.group(2).strip().strip('"').strip("'")
                if cleaned and len(cleaned) > 5:
                    if current_section == "in":
                        inclusion.append(cleaned)
                    elif current_section == "ex":
                        exclusion.append(cleaned)
        
        return {
            "inclusao": inclusion,
            "exclusao": exclusion
        }

    async def evaluate_article(self, article_data: dict, project_data: dict) -> dict:
        """Evaluate an article's relevance and extract metadata for graph relationships."""
        abstract = article_data.get("abstract", "")
        title = article_data.get("title", "")
        research_questions = project_data.get("researchQuestions", []) or []
        
        if not abstract:
            return {
                "suggestedStatus": "pendente",
                "relevanceScore": 0,
                "justification": "Artigo sem resumo disponível para análise automática.",
                "methodology": None,
                "domain": None,
                "keywords": [],
                "suggestedRQs": [],
            }

        inclusion = "\n".join([f"- {c}" for c in project_data.get("criteriosInclusao", [])])
        exclusion = "\n".join([f"- {c}" for c in project_data.get("criteriosExclusao", [])])
        rq_block = "\n".join([f"{idx + 1}. {rq}" for idx, rq in enumerate(research_questions)])
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Você é um especialista em triagem de literatura científica.
Sua tarefa é avaliar se um artigo deve ser incluído ou excluído de uma revisão sistemática e extrair metadados do artigo.

Instruções:
1. Analise o título e o resumo do artigo.
2. Compare-os com os critérios de inclusão e exclusão do projeto.
3. Forneça uma pontuação de relevância de 0 a 100.
4. Sugira o status: "incluido" ou "excluido".
5. Escreva uma justificativa curta (máximo 3 frases).
6. Extraia a metodologia do estudo. Analise cuidadosamente o abstract para identificar a metodologia REAL usada. Se o artigo descreve experimentos, é "experimental". Se faz revisão da literatura, é "literature-review" ou "systematic-review". Se propõe um framework/arquitetura, é "design-science". Se faz survey/questionário, é "survey". NÃO use "other" a menos que realmente nenhuma das opções se aplique.
7. Identifique o domínio/área do estudo.
8. Extraia 5 palavras-chave principais.
9. Se houver perguntas de pesquisa (RQs), indique quais números de RQ este artigo ajuda a responder. Retorne no máximo 3 números.

Responda APENAS no formato JSON:
{{
  "suggestedStatus": "incluido" | "excluido",
  "relevanceScore": number,
  "justification": "string",
  "methodology": "experimental" | "survey" | "case-study" | "literature-review" | "systematic-review" | "meta-analysis" | "design-science" | "simulation" | "theoretical" | "comparative-analysis" | "qualitative" | "mixed-methods" | "rct" | "cohort" | "cross-sectional" | "other" | null,
  "domain": "string (área do estudo, ex: NLP, machine learning, educação)",
    "keywords": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"],
    "suggestedRQs": [1, 2]
}}"""),
            ("user", f"""
Dados do Projeto:
Critérios de Inclusão:
{inclusion}

Critérios de Exclusão:
{exclusion}

Perguntas de Pesquisa (RQs):
{rq_block if rq_block else "Projeto sem RQs definidas"}

Dados do Artigo:
Título: {title}
Resumo: {abstract}

Avalie o artigo e extraia os metadados agora:""")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        
        try:
            result = await chain.ainvoke({})
            # Basic JSON extraction in case the model adds markdown formatting
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                import json
                eval_data = json.loads(json_match.group(0))

                raw_suggested_rqs = eval_data.get("suggestedRQs", []) or []
                valid_suggested_rqs = []
                for value in raw_suggested_rqs:
                    if isinstance(value, bool):
                        continue
                    try:
                        rq_number = int(value)
                    except (TypeError, ValueError):
                        continue

                    if rq_number < 1:
                        continue
                    if research_questions and rq_number > len(research_questions):
                        continue
                    if rq_number not in valid_suggested_rqs:
                        valid_suggested_rqs.append(rq_number)

                # Ensure all expected fields are present
                return {
                    "suggestedStatus": eval_data.get("suggestedStatus", "pendente"),
                    "relevanceScore": eval_data.get("relevanceScore", 0),
                    "justification": eval_data.get("justification", ""),
                    "methodology": eval_data.get("methodology"),
                    "domain": eval_data.get("domain"),
                    "keywords": eval_data.get("keywords", []),
                    "suggestedRQs": valid_suggested_rqs[:3],
                }
            return {
                "suggestedStatus": "pendente",
                "relevanceScore": 0,
                "justification": "Falha ao processar avaliação da IA.",
                "methodology": None,
                "domain": None,
                "keywords": [],
                "suggestedRQs": [],
            }
        except Exception as e:
            print(f"Erro na avaliação da IA: {e}")
            return {
                "suggestedStatus": "pendente",
                "relevanceScore": 0,
                "justification": f"Erro na análise: {str(e)}",
                "methodology": None,
                "domain": None,
                "keywords": [],
                "suggestedRQs": [],
            }

    async def chat(self, message: str, article_context: dict | None = None) -> str:
        """Chat with AI for article analysis using literal extraction."""
        system_prompt = """PERSONA: Você é um Mecanismo de Extração Literal (Literal Extraction Engine). Sua única função é operar como uma API de software que localiza e extrai trechos exatos de um texto-fonte. Você não interpreta, não resume e não gera texto novo."""
        
        if article_context:
            system_prompt += f"""

Você está analisando o seguinte artigo acadêmico:

Título: {article_context.get('title', 'Não informado')}"""
            
            if article_context.get('authors'):
                system_prompt += f"\nAutores: {article_context['authors']}"
            if article_context.get('year'):
                system_prompt += f"\nAno: {article_context['year']}"
            if article_context.get('journal'):
                system_prompt += f"\nPeriódico: {article_context['journal']}"
            if article_context.get('doi'):
                system_prompt += f"\nDOI: {article_context['doi']}"
            if article_context.get('abstract'):
                system_prompt += f"\n\nResumo:\n{article_context['abstract']}"
            if article_context.get('content'):
                system_prompt += f"\n\nCONTEÚDO COMPLETO DO ARTIGO:\n{article_context['content']}"
            elif not article_context.get('abstract'):
                system_prompt += "\n\nOBS: Este artigo não possui resumo (abstract) ou conteúdo extraído disponível."
            if article_context.get('notas'):
                system_prompt += f"\n\nNotas existentes do usuário:\n{article_context['notas']}"
            
            system_prompt += """

DIRETIVA PRIMÁRIA: Sua operação é análoga a um Ctrl+F (Localizar) para encontrar a frase ou sentenças exatas no artigo-fonte que respondem à pergunta do usuário.

PROTOCOLO DE OPERAÇÃO:
- Se encontrar correspondência direta, copie verbatim para a saída
- Se múltiplos pontos respondem à pergunta, liste-os com bullet points
- Se não encontrar informação, responda: "Informação não disponível no artigo."
- Se a pergunta for muito vaga, responda: "Consulta muito ampla para extração literal."

REGRAS:
- NÃO parafrasear
- ZERO adições (sem "De acordo com o texto...")
- Máximo 2 parágrafos pequenos"""
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", "{message}")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        
        return await chain.ainvoke({"message": message})
    
    async def chat_project(
        self,
        message: str,
        project_context: dict,
        retrieved_articles: list[dict]
    ) -> str:
        """Chat with AI using RAG context from the project's articles.
        
        Args:
            message: User's question
            project_context: Dict with project info (title, objetivo, picoc, etc.)
            retrieved_articles: List of article dicts retrieved by the RAG service
        """
        # Build the articles context block
        articles_block = ""
        for i, art in enumerate(retrieved_articles, 1):
            articles_block += f"\n--- ARTIGO {i} ---\n"
            articles_block += f"Título: {art.get('title', 'N/A')}\n"
            articles_block += f"Autores: {art.get('authors', 'N/A')}\n"
            articles_block += f"Ano: {art.get('year', 'N/A')}\n"
            if art.get('journal'):
                articles_block += f"Periódico: {art['journal']}\n"
            if art.get('methodology'):
                articles_block += f"Metodologia: {art['methodology']}\n"
            if art.get('domain'):
                articles_block += f"Domínio: {art['domain']}\n"
            if art.get('abstract'):
                articles_block += f"Resumo: {art['abstract']}\n"
            if art.get('notas'):
                articles_block += f"Notas do pesquisador: {art['notas']}\n"
        
        # Build framework-aware components block
        framework = project_context.get("framework", "PICOC")
        raw_picoc = project_context.get("picoc", {})
        components = normalize_framework_data(raw_picoc, framework)
        
        fw_block = ""
        if components and any(v for v in components.values()):
            fw_block = f"\nFramework {framework}:\n"
            fw_block += _build_components_text(framework, components)

        # Research questions
        rq = project_context.get("researchQuestions", [])
        rq_block = ""
        if rq:
            rq_block = "\nPerguntas de pesquisa:\n" + "\n".join(f"  {i+1}. {q}" for i, q in enumerate(rq))

        system_prompt = f"""PERSONA: Você é um assistente especializado em revisão de literatura acadêmica. Você tem acesso ao contexto de um projeto de pesquisa e aos artigos mais relevantes da base do pesquisador.

CONTEXTO DO PROJETO:
Título: {project_context.get('title', 'N/A')}
Objetivo: {project_context.get('objetivo', 'N/A')}{fw_block}{rq_block}

ARTIGOS RECUPERADOS DA BASE DO PESQUISADOR:
{articles_block if articles_block else "(Nenhum artigo com embedding disponível neste projeto)"}

REGRAS DE OPERAÇÃO:
1. Responda à pergunta do pesquisador baseando-se PREFERENCIALMENTE nos artigos fornecidos acima.
2. Ao citar informações de um artigo, use o formato [Autor, Ano] (ex: [Silva, 2023]).
3. Se a informação não estiver coberta pelos artigos, você pode usar seu conhecimento geral, mas AVISE claramente que é uma informação externa aos artigos do projeto.
4. Seja conciso e acadêmico.
5. Quando fizer sínteses ou comparações, organize a resposta de forma clara (listas, tabelas quando apropriado).
6. Se não houver artigos relevantes, responda com seu conhecimento geral e sugira ao pesquisador que adicione mais artigos à base.
7. CRÍTICO: Sempre que você utilizar uma informação vinda de um artigo, você DEVE observar o campo 'source_type' (se fornecido na lista de artigos) para entender se a informação foi validada por metadados, busca semântica ou expansão de grafo."""
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", "{message}")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        
        return await chain.ainvoke({"message": message})

    async def chat_graph_agent(
        self,
        *,
        message: str,
        project_context: dict,
        agent_plan: dict,
        agent_trace: list[dict],
        agent_result: dict | None,
    ) -> str:
        """Synthesize answers from graph-agent tool outputs."""
        framework = project_context.get("framework", "PICOC")
        raw_picoc = project_context.get("picoc", {})
        components = normalize_framework_data(raw_picoc, framework)

        fw_block = ""
        if components and any(v for v in components.values()):
            fw_block = f"\nFramework {framework}:\n"
            fw_block += _build_components_text(framework, components)

        rq = project_context.get("researchQuestions", [])
        rq_block = ""
        if rq:
            rq_block = "\nPerguntas de pesquisa:\n" + "\n".join(f"  {i+1}. {q}" for i, q in enumerate(rq))

        plan_block = json.dumps(agent_plan, ensure_ascii=False, indent=2).replace("{", "{{").replace("}", "}}")
        trace_block = json.dumps(agent_trace, ensure_ascii=False, indent=2).replace("{", "{{").replace("}", "}}")
        result_block = json.dumps(agent_result or {}, ensure_ascii=False, indent=2).replace("{", "{{").replace("}", "}}")

        system_prompt = f"""PERSONA: Você é um assistente especializado em revisão de literatura orientada a grafos.

CONTEXTO DO PROJETO:
Título: {project_context.get('title', 'N/A')}
Objetivo: {project_context.get('objetivo', 'N/A')}{fw_block}{rq_block}

PLANO DO AGENTE:
{plan_block}

TRILHA DE EXECUÇÃO:
{trace_block}

RESULTADO DAS TOOLS:
{result_block}

REGRAS:
1. Responda com base prioritariamente no resultado das tools do grafo.
2. Não invente informações ausentes no resultado.
3. Quando houver artigos no resultado, cite no formato [Autor, Ano] quando possível.
4. Quando o resultado for estrutural, explique padrões, clusters, pontes e tendências com linguagem clara.
5. Se o resultado estiver vazio ou incompleto, diga isso explicitamente.
6. Seja conciso, analítico e orientado à decisão do pesquisador."""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", "{message}")
        ])

        chain = prompt | self.llm | StrOutputParser()
        return await chain.ainvoke({"message": message})

    def _parse_numbered_list(self, text: str) -> list[str]:
        """Parse a numbered list from LLM output, ignoring non-numbered lines."""
        lines = text.strip().split("\n")
        items = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Apenas aceita linhas que comecem explicitamente com um número seguido de . ou )
            match = re.match(r'^(\d+)[.)]\s*(.*)$', line)
            if match:
                cleaned = match.group(2).strip()
                # Remove aspas se o modelo as incluir
                cleaned = cleaned.strip('"').strip("'")
                if cleaned and len(cleaned) > 5:
                    items.append(cleaned)
        
        return items

    def validate_mcp_envelope(self, payload: dict) -> MCPRequestEnvelope | None:
        """Validate MCP JSON-RPC envelope shape before tool invocation."""
        try:
            envelope = MCPRequestEnvelope(**payload)
            if envelope.jsonrpc != "2.0":
                return None
            return envelope
        except Exception:
            return None

    def mcp_validation_error_response(self, request_id: str | int = "validation") -> MCPResponseEnvelope:
        return MCPResponseEnvelope(
            id=request_id,
            error={
                "code": -32600,
                "message": "Invalid MCP envelope payload",
                "data": {
                    "category": "validation",
                    "hint": "Provide a JSON-RPC 2.0 envelope with id, method, and object params.",
                },
            },
        )


def get_ai_service(api_key: str | None = None, model: str = "gemini-2.0-flash") -> AIService:
    """Factory function to get AI service instance."""
    return AIService(api_key=api_key, model=model)
