export const UNASSIGNED_REVIEW_MESSAGE = "Este artigo não foi atribuído a você.";

export function collaborativeReview(article) {
  const managed = Boolean(article?.hasActiveReviewAssignments);
  const own = article?.myReviewAssignment;
  const state = article?.reviewState;
  let label = null;
  let explanation = null;
  if (managed) {
    if (state === "conflict") {
      label = "Em discordância";
      explanation = "A coordenação precisa resolver a discordância antes de continuar.";
    } else if (state === "consolidated") {
      label = "Consolidado";
      explanation = "A decisão conjunta foi consolidada. Uma nova decisão exige reabertura pela coordenação.";
    } else if (own?.status === "submitted") {
      label = "Aguardando outro revisor";
      explanation = "Sua decisão já foi registrada. Aguarde a conclusão dos outros revisores.";
    } else if (own?.status === "pending") {
      label = "Aguardando minha decisão";
    } else if (own?.status === "needs_reassignment") {
      label = "Aguardando redistribuição";
      explanation = "Esta atribuição precisa ser redistribuída pela coordenação.";
    } else {
      label = "Aguardando revisores";
    }
  }
  const canWrite = article?.canWriteReview ?? (!managed || Boolean(own && own.status !== "needs_reassignment"));
  const canDecide = (article?.canDecideReview ?? canWrite) && (!managed || (
    own?.status === "pending" && state !== "conflict" && state !== "consolidated"
  ));
  return {
    managed, label, canDecide, canWrite,
    explanation: managed && !own ? UNASSIGNED_REVIEW_MESSAGE : explanation,
    writeExplanation: canWrite ? null : own?.status === "needs_reassignment" ? explanation : UNASSIGNED_REVIEW_MESSAGE,
    className: state === "conflict" ? "bg-[#ffecef] text-[#d94343]" : state === "consolidated" ? "bg-[#e8f8ef] text-[#258c55]" : "bg-[#fff6e5] text-[#d48700]",
  };
}
