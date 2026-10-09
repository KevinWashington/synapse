const DECISION_LABELS = {
  included: "Incluído",
  excluded: "Excluído",
  full_text_unavailable: "Texto completo indisponível",
};

function decisionLabel(value) {
  return DECISION_LABELS[value] || value || "Decisão registrada";
}

function phaseDecision(article, phase) {
  if (phase === "eligibility") {
    return {
      decision: article?.eligibilityDecision,
      reasonText: article?.eligibilityReasonText,
      submittedAt: article?.eligibilityReviewedAt,
    };
  }
  return {
    decision: article?.screeningDecision,
    reasonText: article?.screeningReasonText,
    submittedAt: article?.screeningReviewedAt,
  };
}

function hasDecision(decision) {
  return Boolean(decision && !["pending", "pendente"].includes(decision));
}

function DecisionCard({ title, decision }) {
  if (!hasDecision(decision?.decision)) return null;
  const included = decision.decision === "included";

  return (
    <section className="rounded-lg border border-[#e4e8f1] bg-[#fbfcff] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#667391]">{title}</h4>
        <span className={included
          ? "rounded-full bg-[#e8f8ef] px-2.5 py-1 text-xs font-semibold text-[#258c55]"
          : "rounded-full bg-[#ffecef] px-2.5 py-1 text-xs font-semibold text-[#d94343]"}
        >
          {decisionLabel(decision.decision)}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#46526f]">
        {decision.reasonText?.trim() || "Nenhuma justificativa informada"}
      </p>
      {decision.submittedAt ? (
        <p className="mt-2 text-xs text-[#8a94aa]">
          Registrada em {new Date(decision.submittedAt).toLocaleDateString("pt-BR")}
        </p>
      ) : null}
    </section>
  );
}

function DecisionHistory({ article, phase }) {
  if (!article) return null;

  const canonical = phaseDecision(article, phase);
  if (!article.hasActiveReviewAssignments) {
    return hasDecision(canonical.decision) ? (
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-[#111936]">Histórico da decisão</h3>
        <DecisionCard title="Decisão registrada" decision={canonical} />
      </div>
    ) : null;
  }

  const reviewerUserId = article.myReviewAssignment?.reviewerUserId;
  const ownDecision = (article.reviewDecisions || []).find(
    (decision) => String(decision.reviewerUserId) === String(reviewerUserId)
      && hasDecision(decision.decision)
  );
  const showCanonical = article.reviewState === "consolidated" && hasDecision(canonical.decision);
  if (!ownDecision && !showCanonical) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-semibold text-[#111936]">Histórico da decisão</h3>
      <div className="grid gap-3 xl:grid-cols-2">
        {ownDecision ? <DecisionCard title="Sua decisão" decision={ownDecision} /> : null}
        {showCanonical ? <DecisionCard title="Decisão consolidada" decision={canonical} /> : null}
      </div>
    </div>
  );
}

export default DecisionHistory;
