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
6. Foque em perguntas que podem ser respondidas através de revisão sistemática"""),
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
7. Foque em termos que maximizem a recuperação de estudos relevantes"""),
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
    
    def _parse_numbered_list(self, text: str) -> list[str]:
        """Parse a numbered list from LLM output."""
        lines = text.strip().split("\n")
        items = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Remove numbering (1., 2., etc.)
            cleaned = re.sub(r'^\d+\.\s*', '', line)
            if cleaned and len(cleaned) > 10:
                items.append(cleaned)
        
        return items


def get_ai_service(api_key: str | None = None, model: str = "gemini-2.0-flash") -> AIService:
    """Factory function to get AI service instance."""
    return AIService(api_key=api_key, model=model)
