const STATUS_COLORS = {
  identified: "#6259ff",
  screening: "#7c73ff",
  eligible: "#ffd27a",
  included: "#49c987",
  excluded: "#ff6b73",
};

export const CHART_COLORS = ["#6259ff", "#5a86ff", "#49c987", "#ffd27a", "#ff8b8b", "#aab4cc"];

export const EXCLUDED_OUTCOMES = new Set([
  "duplicate_removed",
  "excluded_screening",
  "excluded_eligibility",
  "full_text_unavailable",
]);

const STUDY_TYPE_LABELS = {
  journal_article: "Artigo de periódico",
  conference_paper: "Conferência",
  review: "Revisão",
  thesis: "Tese",
  book_chapter: "Capítulo de livro",
  other: "Outros",
  unclassified: "Não classificado",
};

export function getArticleYear(article) {
  const year = Number(article?.year);
  return Number.isFinite(year) ? year : null;
}

export function getStudyTypeLabel(value) {
  return STUDY_TYPE_LABELS[value || "unclassified"] || value;
}

function groupByCount(items, getKey) {
  const map = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) {
      return;
    }
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function buildStats(articles) {
  const identified = articles.length;
  const screening = articles.filter(
    (article) =>
      article.currentPhase === "screening" ||
      article.currentPhase === "eligibility" ||
      article.currentPhase === "included" ||
      ["excluded_screening", "excluded_eligibility", "full_text_unavailable", "included"].includes(article.reviewOutcome)
  ).length;
  const eligible = articles.filter(
    (article) =>
      article.currentPhase === "eligibility" ||
      article.currentPhase === "included" ||
      ["excluded_eligibility", "full_text_unavailable", "included"].includes(article.reviewOutcome)
  ).length;
  const included = articles.filter((article) => article.reviewOutcome === "included").length;
  const excluded = articles.filter((article) => EXCLUDED_OUTCOMES.has(article.reviewOutcome)).length;

  return {
    eligible,
    excluded,
    identified,
    included,
    screening,
  };
}

export function buildYearData(articles) {
  return groupByCount(articles, getArticleYear)
    .sort((a, b) => Number(a.name) - Number(b.name))
    .map((item) => ({ ...item, year: String(item.name) }));
}

export function buildSourceData(articles) {
  return groupByCount(articles, (article) => article.sourceName || "Origem não informada").slice(0, 8);
}

export function buildStudyTypeData(articles) {
  return groupByCount(articles, (article) => getStudyTypeLabel(article.studyType));
}

export function buildStatusData(articles) {
  const values = articles.reduce(
    (acc, article) => {
      if (article.reviewOutcome === "included") {
        acc.included += 1;
      } else if (EXCLUDED_OUTCOMES.has(article.reviewOutcome)) {
        acc.excluded += 1;
      } else if (article.currentPhase === "eligibility") {
        acc.eligible += 1;
      } else if (article.currentPhase === "screening") {
        acc.screening += 1;
      } else {
        acc.identified += 1;
      }
      return acc;
    },
    { eligible: 0, excluded: 0, identified: 0, included: 0, screening: 0 }
  );

  return [
    { key: "included", name: "Incluídos", value: values.included, color: STATUS_COLORS.included },
    { key: "eligible", name: "Elegíveis", value: values.eligible, color: STATUS_COLORS.eligible },
    { key: "screening", name: "Em triagem", value: values.screening, color: STATUS_COLORS.screening },
    { key: "excluded", name: "Excluídos", value: values.excluded, color: STATUS_COLORS.excluded },
    { key: "identified", name: "Identificação", value: values.identified, color: STATUS_COLORS.identified },
  ].filter((item) => item.value > 0);
}

function normalizeKeyword(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildKeywordData(articles, projectKeywords = []) {
  const map = new Map();
  const addKeyword = (keyword) => {
    const normalized = normalizeKeyword(String(keyword || ""));
    if (!normalized || normalized.length < 3) {
      return;
    }
    map.set(normalized, (map.get(normalized) || 0) + 1);
  };

  projectKeywords.forEach(addKeyword);
  articles.forEach((article) => {
    (article.aiKeywords || []).forEach(addKeyword);
    String(article.keywords || "")
      .split(/[,;|]/)
      .forEach(addKeyword);
  });

  return Array.from(map, ([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, 18);
}

export function buildTrendData(overview, articles) {
  if (overview?.evolution?.length) {
    return overview.evolution.map((point) => ({
      label: new Date(`${point.date}T00:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      Identificados: point.identification,
      Incluídos: point.included,
      Publicações: point.screening,
    }));
  }

  const yearData = buildYearData(articles);
  return yearData.map((point) => ({
    label: point.year,
    Identificados: point.value,
    Incluídos: articles.filter((article) => article.reviewOutcome === "included" && String(article.year) === point.year).length,
    Publicações: point.value,
  }));
}
