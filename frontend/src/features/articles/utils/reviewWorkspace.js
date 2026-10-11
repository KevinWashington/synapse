const TONES = {
  neutral: { className: "bg-[#edf1f7] text-[#667391]", dot: "bg-[#a4adc2]" },
  warning: { className: "bg-[#fff6e5] text-[#d48700]", dot: "bg-[#ff9f1c]" },
  success: { className: "bg-[#e8f8ef] text-[#258c55]", dot: "bg-[#22b66f]" },
  danger: { className: "bg-[#ffecef] text-[#d94343]", dot: "bg-[#f04444]" },
};

/** @param {unknown} value */
export function hasExtractionValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/** @param {import("../../../types/api").ExtractionArticle} article @param {import("../../../types/api").ExtractionField[]} schema */
export function getExtractionProgress(article, schema = []) {
  const extractionData = article?.extractionData || {};
  const fields = Array.isArray(schema) ? schema : [];
  const completed = fields.length
    ? fields.filter((field) => hasExtractionValue(extractionData[field.key])).length
    : Object.values(extractionData).filter(hasExtractionValue).length;
  const total = fields.length;

  if (article?.extractionCompletedAt) {
    return { completed, total, state: "completed", label: "Concluída" };
  }
  if (!completed) {
    return { completed, total, state: "not_started", label: "Não iniciada" };
  }
  return {
    completed,
    total,
    state: "in_progress",
    label: total ? `Em andamento ${completed}/${total}` : "Em andamento",
  };
}

function collaborativeStatus(article) {
  if (!article?.hasActiveReviewAssignments) return null;

  const own = article.myReviewAssignment;
  if (article.reviewState === "conflict") {
    return {
      label: "Discordância",
      tooltip: "A coordenação precisa resolver a divergência.",
      ...TONES.danger,
    };
  }
  if (article.reviewState === "consolidated") {
    return {
      label: "Consolidado",
      tooltip: "A decisão conjunta foi encerrada.",
      ...TONES.success,
    };
  }
  if (own?.status === "submitted") {
    return {
      label: "Aguardando pares",
      tooltip: "Sua decisão foi registrada e a revisão aguarda outros revisores.",
      ...TONES.warning,
    };
  }
  if (own?.status === "pending") {
    return {
      label: "Minha vez",
      tooltip: "Sua decisão ainda não foi registrada.",
      ...TONES.warning,
    };
  }
  if (own?.status === "needs_reassignment") {
    return {
      label: "Redistribuir",
      tooltip: "A atribuição requer redistribuição.",
      ...TONES.warning,
    };
  }
  return {
    label: "Em revisão",
    tooltip: "A revisão está aguardando os revisores atribuídos.",
    ...TONES.neutral,
  };
}

export function getQueueStatus(article, stageKey, duplicateIds = new Set(), extractionSchema = []) {
  if (!article) return { label: "-", ...TONES.neutral };

  if (stageKey === "included") {
    const progress = getExtractionProgress(article, extractionSchema);
    const tone = progress.state === "completed"
      ? TONES.success
      : progress.state === "in_progress"
        ? TONES.warning
        : TONES.neutral;
    return {
      label: progress.label,
      tooltip: progress.total
        ? `${progress.completed} de ${progress.total} campos preenchidos.`
        : progress.label,
      ...tone,
    };
  }

  const collaboration = collaborativeStatus(article);
  if (collaboration) return collaboration;

  if (stageKey === "identification") {
    const duplicate = duplicateIds.has(article.id)
      || article.duplicateGroupKey
      || article.reviewOutcome === "duplicate_removed";
    return duplicate
      ? { label: "Duplicata", ...TONES.warning }
      : { label: "Único", ...TONES.success };
  }

  if (stageKey === "screening") {
    return article.screeningDecision === "excluded"
      ? { label: "Excluído", ...TONES.danger }
      : { label: "Pendente", ...TONES.warning };
  }

  if (
    article.reviewOutcome === "excluded_eligibility"
    || article.reviewOutcome === "full_text_unavailable"
    || article.eligibilityDecision === "excluded"
  ) {
    return { label: "Excluído", ...TONES.danger };
  }
  if (article.reviewOutcome === "included") {
    return { label: "Incluir", ...TONES.success };
  }
  return { label: "Pendente", ...TONES.neutral };
}
