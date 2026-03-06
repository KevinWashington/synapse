import re
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.config import settings


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
    
    async def generate_research_questions(self, picoc: dict, project_context: dict | None = None) -> list[str]:
        """Generate research questions based on PICOC framework."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Você é um especialista em metodologia de pesquisa acadêmica.
Sua tarefa é gerar perguntas de pesquisa específicas e bem estruturadas baseadas nos dados do framework PICOC fornecidos.

Instruções:
1. Gere 3-5 perguntas de pesquisa específicas e mensuráveis
2. Cada pergunta deve ser clara e focada
3. Use linguagem acadêmica apropriada
4. As perguntas devem ser baseadas nos elementos do PICOC
5. Formate cada pergunta em uma linha separada, numerada (1., 2., etc.)
6. Foque em perguntas que podem ser respondidas através de revisão sistemática
7. Responda APENAS a lista numerada. NÃO inclua introduções, conclusões ou explicações."""),
            ("user", """
Contexto do Projeto:
Título: {project_title}
Objetivo: {project_objective}

Framework PICOC:
- População/Pessoa: {pessoa}
- Intervenção: {intervencao}
- Comparação: {comparacao}
- Outcome (Resultado): {outcome}
- Contexto: {contexto}

Gere as perguntas agora:""")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        
        project_title = "Não especificado"
        project_objective = "Não especificado"
        
        if project_context:
            project_title = project_context.get("title") or "Não especificado"
            project_objective = project_context.get("objective") or "Não especificado"
        
        result = await chain.ainvoke({
            "project_title": project_title,
            "project_objective": project_objective,
            "pessoa": picoc.get("pessoa") or "Não especificado",
            "intervencao": picoc.get("intervencao") or "Não especificado",
            "comparacao": picoc.get("comparacao") or "Não especificado",
            "outcome": picoc.get("outcome") or "Não especificado",
            "contexto": picoc.get("contexto") or "Não especificado",
        })
        
        return self._parse_numbered_list(result)
    
    async def generate_search_strings(self, research_questions: list[str], picoc: dict, project_context: dict | None = None) -> list[str]:
        """Generate search strings based on research questions and PICOC."""
        questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(research_questions))
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Você é um especialista em estratégias de busca bibliográfica para revisões sistemáticas.
Sua tarefa é gerar strings de busca eficazes baseadas nas perguntas de pesquisa e dados do PICOC fornecidos.

Instruções:
1. Gere 3-5 strings de busca otimizadas para bases de dados acadêmicas (PubMed, Scopus, Web of Science, etc.)
2. Cada string deve usar operadores booleanos (AND, OR, NOT) adequadamente
3. Inclua sinônimos e variações de termos importantes
4. Use truncamento (*) quando apropriado para capturar variações
5. Considere termos em inglês e português quando relevante
6. Formate cada string em uma linha separada, numerada (1., 2., etc.)
7. Foque em termos que maximizem a recuperação de estudos relevantes
8. Responda APENAS a lista numerada. NÃO inclua introduções, conclusões ou explicações."""),
            ("user", """Perguntas de Pesquisa:
{questions}

Contexto do Projeto:
Título: {project_title}
Objetivo: {project_objective}

Framework PICOC:
- População/Pessoa: {pessoa}
- Intervenção: {intervencao}
- Comparação: {comparacao}
- Outcome (Resultado): {outcome}
- Contexto: {contexto}

Gere as strings de busca agora:""")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        
        project_title = "Não especificado"
        project_objective = "Não especificado"
        
        if project_context:
            project_title = project_context.get("title") or "Não especificado"
            project_objective = project_context.get("objective") or "Não especificado"
        
        result = await chain.ainvoke({
            "questions": questions_text,
            "project_title": project_title,
            "project_objective": project_objective,
            "pessoa": picoc.get("pessoa") or "Não especificado",
            "intervencao": picoc.get("intervencao") or "Não especificado",
            "comparacao": picoc.get("comparacao") or "Não especificado",
            "outcome": picoc.get("outcome") or "Não especificado",
            "contexto": picoc.get("contexto") or "Não especificado",
        })
        
        return self._parse_numbered_list(result)
    
    async def generate_criteria(self, research_questions: list[str], picoc: dict, project_context: dict | None = None) -> dict[str, list[str]]:
        """Generate inclusion and exclusion criteria based on research questions and PICOC."""
        questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(research_questions)) if research_questions else "Não especificadas"
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """Você é um especialista em revisões sistemáticas e mapeamento sistemático de literatura.
Sua tarefa é gerar critérios de inclusão e exclusão claros, objetivos e robustos para a seleção de estudos.

Instruções:
1. Gere uma lista de 4-6 critérios de inclusão e uma lista de 4-6 critérios de exclusão.
2. Os critérios devem ser baseados no framework PICOC e nas perguntas de pesquisa fornecidas.
3. Certifique-se de que os critérios sejam específicos e fáceis de aplicar.
4. Inclua critérios relacionados a: tipo de estudo, intervalo de tempo, idioma (se relevante), população, intervenção e resultados.
5. Formate explicitamente com dois cabeçalhos: "### INCLUSÃO" e "### EXCLUSÃO".
6. Liste cada critério numerado dentro de seu respectivo cabeçalho.
7. Responda APENAS as listas. NÃO inclua introduções, conclusões ou explicações."""),
            ("user", """Perguntas de Pesquisa:
{questions}

Contexto do Projeto:
Título: {project_title}
Objetivo: {project_objective}

Framework PICOC:
- População/Pessoa: {pessoa}
- Intervenção: {intervencao}
- Comparacao: {comparacao}
- Outcome (Resultado): {outcome}
- Contexto: {contexto}

Gere os critérios de inclusão e exclusão agora:""")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        
        project_title = "Não especificado"
        project_objective = "Não especificado"
        
        if project_context:
            project_title = project_context.get("title") or "Não especificado"
            project_objective = project_context.get("objective") or "Não especificado"
        
        result = await chain.ainvoke({
            "questions": questions_text,
            "project_title": project_title,
            "project_objective": project_objective,
            "pessoa": picoc.get("pessoa") or "Não especificado",
            "intervencao": picoc.get("intervencao") or "Não especificado",
            "comparacao": picoc.get("comparacao") or "Não especificado",
            "outcome": picoc.get("outcome") or "Não especificado",
            "contexto": picoc.get("contexto") or "Não especificado",
        })
        
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
        
        if not abstract:
            return {
                "suggestedStatus": "pendente",
                "relevanceScore": 0,
                "justification": "Artigo sem resumo disponível para análise automática.",
                "methodology": None,
                "domain": None,
                "keywords": []
            }

        inclusion = "\n".join([f"- {c}" for c in project_data.get("criteriosInclusao", [])])
        exclusion = "\n".join([f"- {c}" for c in project_data.get("criteriosExclusao", [])])
        
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

Responda APENAS no formato JSON:
{{
  "suggestedStatus": "incluido" | "excluido",
  "relevanceScore": number,
  "justification": "string",
  "methodology": "experimental" | "survey" | "case-study" | "literature-review" | "systematic-review" | "meta-analysis" | "design-science" | "simulation" | "theoretical" | "comparative-analysis" | "qualitative" | "mixed-methods" | "rct" | "cohort" | "cross-sectional" | "other" | null,
  "domain": "string (área do estudo, ex: NLP, machine learning, educação)",
  "keywords": ["palavra1", "palavra2", "palavra3", "palavra4", "palavra5"]
}}"""),
            ("user", f"""
Dados do Projeto:
Critérios de Inclusão:
{inclusion}

Critérios de Exclusão:
{exclusion}

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
                # Ensure all expected fields are present
                return {
                    "suggestedStatus": eval_data.get("suggestedStatus", "pendente"),
                    "relevanceScore": eval_data.get("relevanceScore", 0),
                    "justification": eval_data.get("justification", ""),
                    "methodology": eval_data.get("methodology"),
                    "domain": eval_data.get("domain"),
                    "keywords": eval_data.get("keywords", [])
                }
            return {
                "suggestedStatus": "pendente",
                "relevanceScore": 0,
                "justification": "Falha ao processar avaliação da IA.",
                "methodology": None,
                "domain": None,
                "keywords": []
            }
        except Exception as e:
            print(f"Erro na avaliação da IA: {e}")
            return {
                "suggestedStatus": "pendente",
                "relevanceScore": 0,
                "justification": f"Erro na análise: {str(e)}",
                "methodology": None,
                "domain": None,
                "keywords": []
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
        
        # Build PICOC block
        picoc = project_context.get("picoc", {})
        picoc_block = ""
        if picoc:
            picoc_block = f"""
Framework PICOC:
- População: {picoc.get('pessoa', 'N/A')}
- Intervenção: {picoc.get('intervencao', 'N/A')}
- Comparação: {picoc.get('comparacao', 'N/A')}
- Outcome: {picoc.get('outcome', 'N/A')}
- Contexto: {picoc.get('contexto', 'N/A')}"""

        # Research questions
        rq = project_context.get("researchQuestions", [])
        rq_block = ""
        if rq:
            rq_block = "\nPerguntas de pesquisa:\n" + "\n".join(f"  {i+1}. {q}" for i, q in enumerate(rq))

        system_prompt = f"""PERSONA: Você é um assistente especializado em revisão de literatura acadêmica. Você tem acesso ao contexto de um projeto de pesquisa e aos artigos mais relevantes da base do pesquisador.

CONTEXTO DO PROJETO:
Título: {project_context.get('title', 'N/A')}
Objetivo: {project_context.get('objetivo', 'N/A')}{picoc_block}{rq_block}

ARTIGOS RECUPERADOS DA BASE DO PESQUISADOR:
{articles_block if articles_block else "(Nenhum artigo com embedding disponível neste projeto)"}

REGRAS DE OPERAÇÃO:
1. Responda à pergunta do pesquisador baseando-se PREFERENCIALMENTE nos artigos fornecidos acima.
2. Ao citar informações de um artigo, use o formato [Autor, Ano] (ex: [Silva, 2023]).
3. Se a informação não estiver coberta pelos artigos, você pode usar seu conhecimento geral, mas AVISE claramente que é uma informação externa aos artigos do projeto.
4. Seja conciso e acadêmico.
5. Quando fizer sínteses ou comparações, organize a resposta de forma clara (listas, tabelas quando apropriado).
6. Se não houver artigos relevantes, responda com seu conhecimento geral e sugira ao pesquisador que adicione mais artigos à base."""
        
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


def get_ai_service(api_key: str | None = None, model: str = "gemini-2.0-flash") -> AIService:
    """Factory function to get AI service instance."""
    return AIService(api_key=api_key, model=model)
