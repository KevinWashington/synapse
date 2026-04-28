export const SOURCE_NAME_OPTIONS = [
  "Scopus",
  "Web of Science",
  "IEEE Xplore",
  "ACM Digital Library",
  "PubMed",
  "ScienceDirect",
  "SpringerLink",
  "Google Scholar",
  "BDTD",
  "CAPES",
  "outra",
];

export const SOURCE_CATEGORY_OPTIONS = [
  { value: "database", label: "Base de dados" },
  { value: "grey_literature", label: "Literatura cinzenta" },
  { value: "manual_other", label: "Origem manual" },
];

export const STUDY_TYPE_OPTIONS = [
  { value: "journal_article", label: "Artigo de periodico" },
  { value: "conference_paper", label: "Conferencia" },
  { value: "review", label: "Revisao" },
  { value: "thesis", label: "Tese" },
  { value: "book_chapter", label: "Capitulo de livro" },
  { value: "other", label: "Outro" },
];

export const FLOW_TABS = [
  { key: "overview", label: "Visao geral" },
  { key: "identification", label: "Identificacao" },
  { key: "screening", label: "Triagem" },
  { key: "eligibility", label: "Elegibilidade" },
  { key: "included", label: "Incluidos" },
  { key: "report", label: "Relatorio" },
];

export const PHASE_LABELS = {
  identification: "Identificacao",
  screening: "Triagem",
  eligibility: "Elegibilidade",
  included: "Incluidos",
};

export const OUTCOME_LABELS = {
  active: "Ativo",
  duplicate_removed: "Duplicado removido",
  excluded_screening: "Excluido no screening",
  full_text_unavailable: "Texto completo indisponivel",
  excluded_eligibility: "Excluido na elegibilidade",
  included: "Incluido",
};

export function formatSourceLabel(article) {
  if (!article) {
    return "-";
  }
  return `${article.sourceName} - ${article.sourceCategory}`;
}
