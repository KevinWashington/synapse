export const PLANNING_TABS = [
  { key: "foundation", label: "Fundação" },
  { key: "selection", label: "Seleção" },
  { key: "data", label: "Dados" },
];

function list(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function getPlanningSectionState({ data = {}, framework = "Framework", frameworkComponents = [] } = {}) {
  const requiredComponents = list(frameworkComponents).filter((component) => component.required);
  const completedFrameworkFields = requiredComponents.filter((component) => (
    hasText(data.picoc?.[component.key])
  )).length;
  const researchQuestions = list(data.researchQuestions);
  const searchStrings = list(data.searchStrings);
  const inclusionCriteria = list(data.criteriosInclusao);
  const exclusionCriteria = list(data.criteriosExclusao);
  const eligibilityChecklist = list(data.eligibilityChecklist);
  const extractionSchema = list(data.dataExtractionSchema);
  const qualitySchema = list(data.qualityAssessmentSchema);
  const criteriaCount = inclusionCriteria.length + exclusionCriteria.length;

  const sections = [
    {
      key: "framework",
      tab: "foundation",
      label: framework || "Framework",
      description: "Defina a pergunta de pesquisa estruturada.",
      keywords: ["framework", "picoc", "pico", "spider", "população", "intervenção"],
      complete: requiredComponents.length > 0 && completedFrameworkFields === requiredComponents.length,
      summary: `${completedFrameworkFields} de ${requiredComponents.length} campos obrigatórios`,
    },
    {
      key: "research-questions",
      tab: "foundation",
      label: "Perguntas de pesquisa",
      description: "Defina as perguntas que orientam a revisão sistemática.",
      keywords: ["perguntas", "pesquisa", "rq"],
      complete: researchQuestions.length > 0,
      summary: `${researchQuestions.length} perguntas`,
    },
    {
      key: "search-strategy",
      tab: "selection",
      label: "Estratégia de busca",
      description: "Gerencie as strings de busca para as bases de dados.",
      keywords: ["busca", "strings", "bases", "scopus", "web of science"],
      complete: searchStrings.length > 0,
      summary: `${searchStrings.length} strings`,
    },
    {
      key: "eligibility-criteria",
      tab: "selection",
      label: "Critérios de elegibilidade",
      description: "Defina inclusão, exclusão e o checklist de texto completo.",
      keywords: ["critérios", "elegibilidade", "inclusão", "exclusão", "checklist"],
      complete: criteriaCount > 0,
      summary: `${criteriaCount} critérios · ${eligibilityChecklist.length} itens no checklist`,
    },
    {
      key: "screening-guidance",
      tab: "selection",
      label: "Guia para triagem",
      description: "Oriente a triagem por título e resumo.",
      keywords: ["guia", "triagem", "screening", "título", "resumo"],
      complete: hasText(data.screeningGuidance),
      summary: hasText(data.screeningGuidance) ? "Orientação definida" : "Não iniciado",
    },
    {
      key: "extraction-schema",
      tab: "data",
      label: "Extração de dados",
      description: "Configure os campos extraídos dos estudos incluídos.",
      keywords: ["extração", "dados", "campos", "resultados"],
      complete: extractionSchema.length > 0,
      summary: `${extractionSchema.length} campos`,
    },
    {
      key: "quality-criteria",
      tab: "data",
      label: "Critérios de qualidade",
      description: "Defina como a qualidade metodológica será avaliada.",
      keywords: ["qualidade", "avaliação", "viés", "critérios"],
      complete: qualitySchema.length > 0,
      summary: `${qualitySchema.length} critérios`,
    },
  ];

  const tabs = PLANNING_TABS.map((tab) => {
    const tabSections = sections.filter((section) => section.tab === tab.key);
    return {
      ...tab,
      completed: tabSections.filter((section) => section.complete).length,
      total: tabSections.length,
    };
  });
  const completed = sections.filter((section) => section.complete).length;

  return {
    sections,
    tabs,
    completed,
    total: sections.length,
    percent: Math.round((completed / sections.length) * 100),
  };
}

export function findFirstIncompleteSection(sections = []) {
  return sections.find((section) => !section.complete) || sections[0] || null;
}
