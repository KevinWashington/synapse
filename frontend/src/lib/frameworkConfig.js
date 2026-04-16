/**
 * Framework configuration for research question formulation.
 * Mirrors the backend FRAMEWORK_COMPONENTS and FRAMEWORK_INFO.
 */

export const FRAMEWORKS = {
  PICO: {
    name: "PICO",
    description: "Population, Intervention, Comparison, Outcome",
    longDescription:
      "Framework base e mais universal para formulação de questões clínicas. Ideal para estudos que avaliam efeitos de intervenções em populações específicas.",
    recommendedAreas: ["Medicina Clínica", "Enfermagem"],
    color: "var(--syn-badge-medium-bg)",
    textColor: "var(--syn-badge-medium-text)",
    badgeBg: "#dbeafe",
    badgeText: "#1e40af",
  },
  PICOS: {
    name: "PICOS",
    description: "Population, Intervention, Comparison, Outcome, Study Design",
    longDescription:
      "Extensão do PICO que inclui o tipo de estudo como componente adicional. Útil quando o desenho do estudo é um critério importante de seleção.",
    recommendedAreas: ["Medicina", "Saúde Pública"],
    color: "var(--syn-badge-high-bg)",
    textColor: "var(--syn-badge-high-text)",
    badgeBg: "#fce7f3",
    badgeText: "#9d174d",
  },
  PECO: {
    name: "PECO",
    description: "Population, Exposure, Comparison, Outcome",
    longDescription:
      "Framework voltado para estudos observacionais que investigam exposições a fatores de risco ou condições, em vez de intervenções controladas.",
    recommendedAreas: ["Epidemiologia", "Ciências Ambientais"],
    color: "var(--syn-badge-low-bg)",
    textColor: "var(--syn-badge-low-text)",
    badgeBg: "#d1fae5",
    badgeText: "#065f46",
  },
  PICOC: {
    name: "PICOC",
    description: "Population, Intervention, Comparison, Outcome, Context",
    longDescription:
      "Framework que adiciona o contexto como componente explícito. Amplamente utilizado em revisões sistemáticas de Engenharia de Software.",
    recommendedAreas: ["Engenharia de Software", "Computação"],
    color: "var(--syn-badge-info-bg)",
    textColor: "var(--syn-badge-info-text)",
    badgeBg: "#ede9fe",
    badgeText: "#5b21b6",
  },
};

export const FRAMEWORK_COMPONENTS = {
  PICO: [
    {
      key: "population",
      label: "Population",
      labelPt: "População",
      placeholder: "Ex: Pacientes adultos com diabetes tipo 2",
      tooltip: "Grupo de indivíduos ou pacientes de interesse para o estudo",
      required: true,
    },
    {
      key: "intervention",
      label: "Intervention",
      labelPt: "Intervenção",
      placeholder: "Ex: Uso de insulina glargina",
      tooltip: "Tratamento, procedimento ou ação que está sendo avaliada",
      required: true,
    },
    {
      key: "comparison",
      label: "Comparison",
      labelPt: "Comparação",
      placeholder: "Ex: Insulina NPH ou placebo",
      tooltip:
        "Alternativa com a qual a intervenção é comparada (opcional em revisões exploratórias)",
      required: false,
    },
    {
      key: "outcome",
      label: "Outcome",
      labelPt: "Resultado",
      placeholder: "Ex: Controle glicêmico (HbA1c)",
      tooltip: "Desfecho ou resultado esperado que será medido",
      required: true,
    },
  ],
  PICOS: [
    {
      key: "population",
      label: "Population",
      labelPt: "População",
      placeholder: "Ex: Adultos com hipertensão arterial",
      tooltip: "Grupo de indivíduos ou pacientes de interesse para o estudo",
      required: true,
    },
    {
      key: "intervention",
      label: "Intervention",
      labelPt: "Intervenção",
      placeholder: "Ex: Programa de exercícios aeróbicos",
      tooltip: "Tratamento, procedimento ou ação que está sendo avaliada",
      required: true,
    },
    {
      key: "comparison",
      label: "Comparison",
      labelPt: "Comparação",
      placeholder: "Ex: Grupo sedentário ou tratamento convencional",
      tooltip:
        "Alternativa com a qual a intervenção é comparada (opcional em revisões exploratórias)",
      required: false,
    },
    {
      key: "outcome",
      label: "Outcome",
      labelPt: "Resultado",
      placeholder: "Ex: Redução da pressão arterial sistólica",
      tooltip: "Desfecho ou resultado esperado que será medido",
      required: true,
    },
    {
      key: "studyDesign",
      label: "Study Design",
      labelPt: "Tipo de Estudo",
      placeholder: "Ex: Ensaios clínicos randomizados (RCTs)",
      tooltip: "Desenho ou tipo de estudo a ser considerado na revisão",
      required: true,
    },
  ],
  PECO: [
    {
      key: "population",
      label: "Population",
      labelPt: "População",
      placeholder: "Ex: Trabalhadores industriais expostos a ruído ocupacional",
      tooltip: "Grupo de indivíduos ou comunidade de interesse para o estudo",
      required: true,
    },
    {
      key: "exposure",
      label: "Exposure",
      labelPt: "Exposição",
      placeholder: "Ex: Exposição crônica a poluentes atmosféricos (PM2.5)",
      tooltip:
        "Fator de risco, agente ou condição ambiental a que a população está exposta",
      required: true,
    },
    {
      key: "comparison",
      label: "Comparison",
      labelPt: "Comparação",
      placeholder: "Ex: População não exposta ou com baixa exposição",
      tooltip:
        "Grupo de referência com o qual a população exposta será comparada (opcional em revisões exploratórias)",
      required: false,
    },
    {
      key: "outcome",
      label: "Outcome",
      labelPt: "Resultado",
      placeholder: "Ex: Incidência de doenças respiratórias",
      tooltip: "Desfecho ou resultado esperado que será medido na população",
      required: true,
    },
  ],
  PICOC: [
    {
      key: "population",
      label: "Population",
      labelPt: "População",
      placeholder: "Ex: Desenvolvedores de software em equipes ágeis",
      tooltip: "Grupo, organização ou contexto demográfico de interesse",
      required: true,
    },
    {
      key: "intervention",
      label: "Intervention",
      labelPt: "Intervenção",
      placeholder: "Ex: Adoção de práticas de code review automatizado",
      tooltip: "Tecnologia, metodologia ou prática sendo investigada",
      required: true,
    },
    {
      key: "comparison",
      label: "Comparison",
      labelPt: "Comparação",
      placeholder: "Ex: Code review manual ou sem code review",
      tooltip:
        "Alternativa com a qual a intervenção é comparada (opcional em revisões exploratórias)",
      required: false,
    },
    {
      key: "outcome",
      label: "Outcome",
      labelPt: "Resultado",
      placeholder: "Ex: Qualidade do código, número de defeitos",
      tooltip: "Métricas ou resultados esperados da investigação",
      required: true,
    },
    {
      key: "context",
      label: "Context",
      labelPt: "Contexto",
      placeholder: "Ex: Projetos open-source de médio/grande porte",
      tooltip: "Ambiente, domínio ou cenário onde o estudo se aplica",
      required: true,
    },
  ],
};

/**
 * Get the components config for a specific framework.
 */
export function getComponentsForFramework(framework) {
  return FRAMEWORK_COMPONENTS[framework] || FRAMEWORK_COMPONENTS.PICOC;
}

/**
 * Get framework info (description, areas, colors).
 */
export function getFrameworkInfo(framework) {
  return FRAMEWORKS[framework] || FRAMEWORKS.PICOC;
}

/**
 * Get all required component keys for validation.
 */
export function getRequiredKeys(framework) {
  const components = getComponentsForFramework(framework);
  return components.filter((c) => c.required).map((c) => c.key);
}

/**
 * Target database options for search string generation.
 */
export const TARGET_DATABASES = [
  { value: "scopus", label: "Scopus" },
  { value: "web_of_science", label: "Web of Science" },
  { value: "ieee", label: "IEEE Xplore" },
];
