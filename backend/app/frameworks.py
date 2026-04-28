"""
Módulo centralizado de frameworks para formulação de questões de pesquisa.

Define os frameworks suportados (PICO, PICOS, PECO, PICOC), seus componentes,
metadados e funções para construção dinâmica de prompts para o LLM.
"""

from enum import Enum


class FrameworkType(str, Enum):
    """Tipos de framework de formulação de questão de pesquisa."""
    PICO = "PICO"
    PICOS = "PICOS"
    PECO = "PECO"
    PICOC = "PICOC"


# ---------------------------------------------------------------------------
# Informações descritivas de cada framework
# ---------------------------------------------------------------------------
FRAMEWORK_INFO: dict[str, dict] = {
    "PICO": {
        "name": "PICO",
        "description": "Population, Intervention, Comparison, Outcome",
        "longDescription": (
            "Framework base e mais universal para formulação de questões clínicas. "
            "Ideal para estudos que avaliam efeitos de intervenções em populações específicas."
        ),
        "recommendedAreas": ["Medicina Clínica", "Enfermagem"],
    },
    "PICOS": {
        "name": "PICOS",
        "description": "Population, Intervention, Comparison, Outcome, Study Design",
        "longDescription": (
            "Extensão do PICO que inclui o tipo de estudo como componente adicional. "
            "Útil quando o desenho do estudo é um critério importante de seleção."
        ),
        "recommendedAreas": ["Medicina", "Saúde Pública"],
    },
    "PECO": {
        "name": "PECO",
        "description": "Population, Exposure, Comparison, Outcome",
        "longDescription": (
            "Framework voltado para estudos observacionais que investigam exposições "
            "a fatores de risco ou condições, em vez de intervenções controladas."
        ),
        "recommendedAreas": ["Epidemiologia", "Ciências Ambientais"],
    },
    "PICOC": {
        "name": "PICOC",
        "description": "Population, Intervention, Comparison, Outcome, Context",
        "longDescription": (
            "Framework que adiciona o contexto como componente explícito. "
            "Amplamente utilizado em revisões sistemáticas de Engenharia de Software."
        ),
        "recommendedAreas": ["Engenharia de Software", "Computação"],
    },
}


# ---------------------------------------------------------------------------
# Componentes de cada framework com metadados para renderização e prompts
# ---------------------------------------------------------------------------
FRAMEWORK_COMPONENTS: dict[str, list[dict]] = {
    "PICO": [
        {
            "key": "population",
            "label": "Population",
            "labelPt": "População",
            "placeholder": "Ex: Pacientes adultos com diabetes tipo 2",
            "tooltip": "Grupo de indivíduos ou pacientes de interesse para o estudo",
            "required": True,
        },
        {
            "key": "intervention",
            "label": "Intervention",
            "labelPt": "Intervenção",
            "placeholder": "Ex: Uso de insulina glargina",
            "tooltip": "Tratamento, procedimento ou ação que está sendo avaliada",
            "required": True,
        },
        {
            "key": "comparison",
            "label": "Comparison",
            "labelPt": "Comparação",
            "placeholder": "Ex: Insulina NPH ou placebo",
            "tooltip": "Alternativa com a qual a intervenção é comparada (opcional em revisões exploratórias)",
            "required": False,
        },
        {
            "key": "outcome",
            "label": "Outcome",
            "labelPt": "Resultado",
            "placeholder": "Ex: Controle glicêmico (HbA1c)",
            "tooltip": "Desfecho ou resultado esperado que será medido",
            "required": True,
        },
    ],
    "PICOS": [
        {
            "key": "population",
            "label": "Population",
            "labelPt": "População",
            "placeholder": "Ex: Adultos com hipertensão arterial",
            "tooltip": "Grupo de indivíduos ou pacientes de interesse para o estudo",
            "required": True,
        },
        {
            "key": "intervention",
            "label": "Intervention",
            "labelPt": "Intervenção",
            "placeholder": "Ex: Programa de exercícios aeróbicos",
            "tooltip": "Tratamento, procedimento ou ação que está sendo avaliada",
            "required": True,
        },
        {
            "key": "comparison",
            "label": "Comparison",
            "labelPt": "Comparação",
            "placeholder": "Ex: Grupo sedentário ou tratamento convencional",
            "tooltip": "Alternativa com a qual a intervenção é comparada (opcional em revisões exploratórias)",
            "required": False,
        },
        {
            "key": "outcome",
            "label": "Outcome",
            "labelPt": "Resultado",
            "placeholder": "Ex: Redução da pressão arterial sistólica",
            "tooltip": "Desfecho ou resultado esperado que será medido",
            "required": True,
        },
        {
            "key": "studyDesign",
            "label": "Study Design",
            "labelPt": "Tipo de Estudo",
            "placeholder": "Ex: Ensaios clínicos randomizados (RCTs)",
            "tooltip": "Desenho ou tipo de estudo a ser considerado na revisão",
            "required": True,
        },
    ],
    "PECO": [
        {
            "key": "population",
            "label": "Population",
            "labelPt": "População",
            "placeholder": "Ex: Trabalhadores industriais expostos a ruído ocupacional",
            "tooltip": "Grupo de indivíduos ou comunidade de interesse para o estudo",
            "required": True,
        },
        {
            "key": "exposure",
            "label": "Exposure",
            "labelPt": "Exposição",
            "placeholder": "Ex: Exposição crônica a poluentes atmosféricos (PM2.5)",
            "tooltip": "Fator de risco, agente ou condição ambiental a que a população está exposta (não é uma intervenção controlada)",
            "required": True,
        },
        {
            "key": "comparison",
            "label": "Comparison",
            "labelPt": "Comparação",
            "placeholder": "Ex: População não exposta ou com baixa exposição",
            "tooltip": "Grupo de referência com o qual a população exposta será comparada (opcional em revisões exploratórias)",
            "required": False,
        },
        {
            "key": "outcome",
            "label": "Outcome",
            "labelPt": "Resultado",
            "placeholder": "Ex: Incidência de doenças respiratórias",
            "tooltip": "Desfecho ou resultado esperado que será medido na população",
            "required": True,
        },
    ],
    "PICOC": [
        {
            "key": "population",
            "label": "Population",
            "labelPt": "População",
            "placeholder": "Ex: Desenvolvedores de software em equipes ágeis",
            "tooltip": "Grupo, organização ou contexto demográfico de interesse",
            "required": True,
        },
        {
            "key": "intervention",
            "label": "Intervention",
            "labelPt": "Intervenção",
            "placeholder": "Ex: Adoção de práticas de code review automatizado",
            "tooltip": "Tecnologia, metodologia ou prática sendo investigada",
            "required": True,
        },
        {
            "key": "comparison",
            "label": "Comparison",
            "labelPt": "Comparação",
            "placeholder": "Ex: Code review manual ou sem code review",
            "tooltip": "Alternativa com a qual a intervenção é comparada (opcional em revisões exploratórias)",
            "required": False,
        },
        {
            "key": "outcome",
            "label": "Outcome",
            "labelPt": "Resultado",
            "placeholder": "Ex: Qualidade do código, número de defeitos",
            "tooltip": "Métricas ou resultados esperados da investigação",
            "required": True,
        },
        {
            "key": "context",
            "label": "Context",
            "labelPt": "Contexto",
            "placeholder": "Ex: Projetos open-source de médio/grande porte",
            "tooltip": "Ambiente, domínio ou cenário onde o estudo se aplica",
            "required": True,
        },
    ],
}

# ---------------------------------------------------------------------------
# Funções para construção de componentes do framework em texto para prompts
# ---------------------------------------------------------------------------

def _build_components_text(framework: str, components: dict) -> str:
    """Constrói a seção textual dos componentes do framework para inserção em prompts.
    
    Args:
        framework: Tipo de framework.
        components: Dicionário com valores dos componentes (chaves padronizadas inglês).
    
    Returns:
        Texto formatado com os componentes do framework.
    """
    fw_components = FRAMEWORK_COMPONENTS.get(framework, FRAMEWORK_COMPONENTS["PICOC"])
    lines = []
    for comp in fw_components:
        key = comp["key"]
        label = comp["label"]
        label_pt = comp["labelPt"]
        value = components.get(key) or "Não especificado"
        lines.append(f"- {label} ({label_pt}): {value}")
    return "\n".join(lines)


def _get_framework_semantic_instruction(framework: str) -> str:
    """Retorna instrução semântica específica do framework para guiar o LLM."""
    instructions = {
        "PICO": (
            "O framework PICO é usado para questões clínicas. "
            "As perguntas devem focar na relação entre a intervenção (I) e o resultado (O) "
            "na população (P) especificada, comparando com a alternativa (C) quando aplicável."
        ),
        "PICOS": (
            "O framework PICOS estende o PICO com o componente Study Design (S). "
            "As perguntas devem considerar não apenas a intervenção e seus resultados, "
            "mas também o tipo de estudo mais adequado para responder à questão. "
            "Considere ensaios clínicos, estudos observacionais, revisões, etc."
        ),
        "PECO": (
            "O framework PECO é usado para estudos observacionais de exposição. "
            "O componente E representa Exposure (exposição a um fator de risco ou condição), "
            "NÃO uma intervenção controlada. As questões devem refletir estudos observacionais, "
            "não experimentais. Foque em associações entre exposição e desfechos."
        ),
        "PICOC": (
            "O framework PICOC inclui o Contexto (C) como componente explícito. "
            "É amplamente usado em Engenharia de Software e Computação. "
            "As perguntas devem considerar o contexto do estudo como fator relevante "
            "na formulação da questão de pesquisa."
        ),
    }
    return instructions.get(framework, instructions["PICOC"])


# ---------------------------------------------------------------------------
# Prompts para geração de questões de pesquisa
# ---------------------------------------------------------------------------

def build_research_questions_prompt(framework: str, components: dict, project_context: dict | None = None) -> tuple[str, str]:
    """Constrói o prompt de sistema e usuário para geração de questões de pesquisa.
    
    Args:
        framework: Tipo de framework.
        components: Valores dos componentes do framework.
        project_context: Contexto do projeto (title, objetivo).
    
    Returns:
        Tupla (system_prompt, user_prompt).
    """
    semantic = _get_framework_semantic_instruction(framework)
    components_text = _build_components_text(framework, components)
    
    project_title = "Não especificado"
    project_objective = "Não especificado"
    if project_context:
        project_title = project_context.get("title") or "Não especificado"
        project_objective = project_context.get("objetivo") or project_context.get("objective") or "Não especificado"

    system_prompt = f"""Você é um especialista em metodologia de pesquisa acadêmica.
Sua tarefa é gerar perguntas de pesquisa específicas e bem estruturadas baseadas nos dados do framework {framework} fornecidos.

{semantic}

Instruções:
1. Gere 3-5 perguntas de pesquisa específicas e mensuráveis
2. Cada pergunta deve ser clara e focada
3. Use linguagem acadêmica apropriada
4. As perguntas devem ser baseadas nos elementos do framework {framework}
5. Formate cada pergunta em uma linha separada, numerada (1., 2., etc.)
6. Foque em perguntas que podem ser respondidas através de revisão sistemática
7. Responda APENAS a lista numerada. NÃO inclua introduções, conclusões ou explicações."""

    user_prompt = f"""Contexto do Projeto:
Título: {project_title}
Objetivo: {project_objective}

Framework {framework}:
{components_text}

Gere as perguntas agora:"""

    return system_prompt, user_prompt


# ---------------------------------------------------------------------------
# Prompts para geração de strings de busca
# ---------------------------------------------------------------------------

# Instruções específicas por base de dados acadêmica
DATABASE_INSTRUCTIONS: dict[str, str] = {
    "scopus": (
        "Gere strings otimizadas para a base **Scopus**. "
        "Use a sintaxe Scopus: TITLE-ABS-KEY() para buscas em título, abstract e keywords. "
        "Use operadores AND, OR, AND NOT. Aspas duplas para termos compostos. "
        "Use * apenas quando necessário e evite blocos com sinônimos excessivos. "
        "Priorize precisão e legibilidade."
    ),
    "web_of_science": (
        "Gere strings otimizadas para a base **Web of Science**. "
        "Use Topic (TS=) para buscas em título, abstract e keywords. "
        "Use operadores AND, OR, NOT. Aspas duplas para termos compostos. "
        "Use * e ? somente quando útil e não repita variações triviais. "
        "Priorize consultas objetivas e fáceis de revisar."
    ),
    "ieee": (
        "Gere strings otimizadas para a base **IEEE Xplore**. "
        "Use buscas no formato de command search. "
        "Use operadores AND, OR, NOT. Aspas duplas para termos compostos. "
        "Campos: (\"All Metadata\":termo). "
        "Evite cadeias muito longas com muitos sinônimos no mesmo bloco."
    ),
}


def build_search_string_prompt(
    framework: str,
    components: dict,
    research_questions: list[str],
    target_database: str = "scopus",
    project_context: dict | None = None,
) -> tuple[str, str]:
    """Constrói o prompt de sistema e usuário para geração de strings de busca.
    
    Args:
        framework: Tipo de framework.
        components: Valores dos componentes do framework.
        research_questions: Lista de perguntas de pesquisa.
        target_database: Base de dados alvo (scopus, web_of_science, ieee).
        project_context: Contexto do projeto.
    
    Returns:
        Tupla (system_prompt, user_prompt).
    """
    semantic = _get_framework_semantic_instruction(framework)
    components_text = _build_components_text(framework, components)
    questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(research_questions))
    db_instruction = DATABASE_INSTRUCTIONS.get(target_database, DATABASE_INSTRUCTIONS["scopus"])

    project_title = "Não especificado"
    project_objective = "Não especificado"
    if project_context:
        project_title = project_context.get("title") or "Não especificado"
        project_objective = project_context.get("objetivo") or project_context.get("objective") or "Não especificado"

    system_prompt = f"""Você é um especialista em estratégias de busca bibliográfica para revisões sistemáticas.
Sua tarefa é gerar strings de busca eficazes baseadas nas perguntas de pesquisa e dados do framework {framework}.

{semantic}

{db_instruction}

Instruções:
1. Gere EXATAMENTE 3 strings de busca otimizadas para a base de dados especificada.
2. Cada string deve usar operadores booleanos (AND, OR, NOT) com sintaxe correta da base.
3. Estruture cada string em blocos por componente do framework {framework}, conectando os blocos com AND.
4. Dentro de cada bloco, use no máximo 3 termos/sinônimos realmente relevantes; evite expansões redundantes.
5. Priorize termos em inglês; inclua português apenas quando agregar cobertura sem inflar a consulta.
6. Evite repetição de termos quase idênticos e não gere explicações ou comentários.
7. Formate cada string em uma linha separada, numerada (1., 2., 3.).
8. Mantenha cada string objetiva, clara e aplicável diretamente na base escolhida.
9. Responda APENAS a lista numerada. NÃO inclua introduções, conclusões ou explicações."""

    user_prompt = f"""Perguntas de Pesquisa:
{questions_text}

Contexto do Projeto:
Título: {project_title}
Objetivo: {project_objective}

Framework {framework}:
{components_text}

Gere as strings de busca agora:"""

    return system_prompt, user_prompt


# ---------------------------------------------------------------------------
# Prompts para geração de critérios de inclusão/exclusão
# ---------------------------------------------------------------------------

def build_criteria_prompt(
    framework: str,
    components: dict,
    research_questions: list[str],
    project_context: dict | None = None,
) -> tuple[str, str]:
    """Constrói o prompt para geração de critérios de inclusão e exclusão.
    
    Args:
        framework: Tipo de framework.
        components: Valores dos componentes do framework.
        research_questions: Lista de perguntas de pesquisa.
        project_context: Contexto do projeto.
    
    Returns:
        Tupla (system_prompt, user_prompt).
    """
    semantic = _get_framework_semantic_instruction(framework)
    components_text = _build_components_text(framework, components)
    questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(research_questions)) if research_questions else "Não especificadas"

    # Construir lista de componentes para instrução de critérios
    fw_comps = FRAMEWORK_COMPONENTS.get(framework, FRAMEWORK_COMPONENTS["PICOC"])
    comp_names = ", ".join(c["labelPt"].lower() for c in fw_comps)

    project_title = "Não especificado"
    project_objective = "Não especificado"
    if project_context:
        project_title = project_context.get("title") or "Não especificado"
        project_objective = project_context.get("objetivo") or project_context.get("objective") or "Não especificado"

    system_prompt = f"""Você é um especialista em revisões sistemáticas e mapeamento sistemático de literatura.
Sua tarefa é gerar critérios de inclusão e exclusão claros, objetivos e robustos para a seleção de estudos.

{semantic}

Instruções:
1. Gere uma lista de 4-6 critérios de inclusão e uma lista de 4-6 critérios de exclusão.
2. Os critérios devem ser baseados no framework {framework} e nas perguntas de pesquisa fornecidas.
3. Certifique-se de que os critérios sejam específicos e fáceis de aplicar.
4. Inclua critérios relacionados a: tipo de estudo, intervalo de tempo, idioma (se relevante), {comp_names}.
5. Formate explicitamente com dois cabeçalhos: "### INCLUSÃO" e "### EXCLUSÃO".
6. Liste cada critério numerado dentro de seu respectivo cabeçalho.
7. Responda APENAS as listas. NÃO inclua introduções, conclusões ou explicações."""

    user_prompt = f"""Perguntas de Pesquisa:
{questions_text}

Contexto do Projeto:
Título: {project_title}
Objetivo: {project_objective}

Framework {framework}:
{components_text}

Gere os critérios de inclusão e exclusão agora:"""

    return system_prompt, user_prompt


def build_data_extraction_schema_prompt(
    framework: str,
    components: dict,
    research_questions: list[str],
    project_context: dict | None = None,
) -> tuple[str, str]:
    """Build prompt for AI-assisted extraction schema generation.

    The resulting schema must preserve a 1:1 mapping with the research questions:
    each generated field stores the answer that an included article provides for
    that question.
    """
    semantic = _get_framework_semantic_instruction(framework)
    components_text = _build_components_text(framework, components)
    questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(research_questions))

    project_title = "N\u00e3o especificado"
    project_objective = "N\u00e3o especificado"
    if project_context:
        project_title = project_context.get("title") or "N\u00e3o especificado"
        project_objective = project_context.get("objetivo") or project_context.get("objective") or "N\u00e3o especificado"

    system_prompt = f"""Voc\u00ea \u00e9 um especialista em extra\u00e7\u00e3o de dados para revis\u00f5es sistem\u00e1ticas.
Sua tarefa \u00e9 analisar as perguntas de pesquisa e sugerir o formato mais adequado para as colunas de uma tabela de extra\u00e7\u00e3o.

{semantic}

Regras obrigat\u00f3rias:
1. Deve existir EXATAMENTE uma coluna para cada pergunta de pesquisa, na mesma ordem.
2. Cada coluna armazenar\u00e1 a RESPOSTA do artigo para a respectiva pergunta de pesquisa.
3. N\u00e3o crie colunas extras de metadados como autor, ano, pa\u00eds ou metodologia.
4. Escolha o tipo da coluna usando apenas: "text", "number", "single_select", "multi_select", "boolean".
5. Prefira "text" para perguntas anal\u00edticas, explicativas, comparativas ou abertas.
6. Use "boolean" apenas quando a resposta natural for sim/n\u00e3o.
7. Use "number" apenas quando a resposta esperada for claramente num\u00e9rica.
8. Use "single_select" ou "multi_select" apenas quando houver categorias claras e est\u00e1veis.
9. Se usar campos de sele\u00e7\u00e3o, forne\u00e7a no m\u00e1ximo 6 op\u00e7\u00f5es curtas e distintas.
10. Responda APENAS em JSON v\u00e1lido, sem markdown, no formato:
{{
  "items": [
    {{
      "researchQuestionIndex": 1,
      "type": "text",
      "options": []
    }}
  ]
}}"""

    user_prompt = f"""Contexto do Projeto:
T\u00edtulo: {project_title}
Objetivo: {project_objective}

Framework {framework}:
{components_text}

Perguntas de Pesquisa:
{questions_text}

Gere o JSON agora:"""

    return system_prompt, user_prompt


def build_quality_assessment_schema_prompt(
    framework: str,
    components: dict,
    research_questions: list[str],
    project_context: dict | None = None,
) -> tuple[str, str]:
    """Build prompt for AI-assisted quality assessment criteria generation."""
    semantic = _get_framework_semantic_instruction(framework)
    components_text = _build_components_text(framework, components)
    questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(research_questions)) if research_questions else "N\u00e3o especificadas"

    project_title = "N\u00e3o especificado"
    project_objective = "N\u00e3o especificado"
    if project_context:
        project_title = project_context.get("title") or "N\u00e3o especificado"
        project_objective = project_context.get("objetivo") or project_context.get("objective") or "N\u00e3o especificado"

    system_prompt = f"""Voc\u00ea \u00e9 um especialista em avalia\u00e7\u00e3o de qualidade metodol\u00f3gica para revis\u00f5es sistem\u00e1ticas.
Sua tarefa \u00e9 propor crit\u00e9rios de qualidade que possam ser avaliados com a escala fixa: yes, partial, no, na.

{semantic}

Regras obrigat\u00f3rias:
1. Gere entre 5 e 7 crit\u00e9rios.
2. Cada crit\u00e9rio deve ser curto, objetivo e verific\u00e1vel no artigo.
3. Os crit\u00e9rios devem ajudar a julgar a confiabilidade metodol\u00f3gica dos estudos para responder \u00e0s perguntas de pesquisa.
4. Evite crit\u00e9rios vagos como "artigo bom" ou "resultado relevante".
5. Prefira formula\u00e7\u00f5es avali\u00e1veis como clareza de contexto, adequa\u00e7\u00e3o do desenho, descri\u00e7\u00e3o da coleta, rigor da an\u00e1lise, amea\u00e7as \u00e0 validade e alinhamento com a pergunta.
6. Responda APENAS em JSON v\u00e1lido, sem markdown, no formato:
{{
  "criteria": [
    {{ "label": "Criterion text" }}
  ]
}}"""

    user_prompt = f"""Contexto do Projeto:
T\u00edtulo: {project_title}
Objetivo: {project_objective}

Framework {framework}:
{components_text}

Perguntas de Pesquisa:
{questions_text}

Gere o JSON agora:"""

    return system_prompt, user_prompt
