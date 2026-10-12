import EligibilityDecisionForm from "../EligibilityDecisionForm";
import { collaborativeReview } from "../../utils/collaborativeReview";
import DecisionPanel from "./DecisionPanel";

function EligibilityDecisionTool({ article, checklist, researchQuestions, isSaving, onAdvance, onAssist, onDirtyChange, onSubmit, onSkip }) {
  if (!article) return <aside aria-label="Decisão de elegibilidade" className="h-full bg-[#fbfbfe] p-5 text-sm text-[#667391]">Selecione um artigo para avaliar.</aside>;
  const review = collaborativeReview(article);
  async function handleSubmit(payload) {
    const saved = await onSubmit(article.id, payload);
    if (saved !== false) onAdvance?.();
  }
  return (
    <DecisionPanel title="Decisão de elegibilidade" description="Confira o texto completo antes de decidir sobre a inclusão." article={article} review={review}>
      <EligibilityDecisionForm article={article} canDecide={review.canDecide} checklist={checklist} isSaving={isSaving} onAssist={onAssist} onDirtyChange={onDirtyChange} onSubmit={handleSubmit} researchQuestions={researchQuestions} submitLabel="Salvar e próximo" />
      {onSkip && <button type="button" disabled={isSaving} onClick={onSkip} className="w-full rounded-lg px-3 py-2 text-xs text-[#667391] hover:bg-[#f0f2f7] focus-visible:outline-2 focus-visible:outline-[#6259ff] disabled:cursor-not-allowed disabled:opacity-50">Pular estudo</button>}
    </DecisionPanel>
  );
}

export default EligibilityDecisionTool;
