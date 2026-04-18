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

export const FLOW_TABS = [
  { key: "overview", label: "Overview" },
  { key: "identification", label: "Identification" },
  { key: "screening", label: "Screening" },
  { key: "eligibility", label: "Eligibility" },
  { key: "included", label: "Included" },
  { key: "report", label: "Report" },
];

export const PHASE_LABELS = {
  identification: "Identification",
  screening: "Screening",
  eligibility: "Eligibility",
  included: "Included",
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
  return `${article.sourceName} · ${article.sourceCategory}`;
}
