import EligibilityDecisionForm from "../EligibilityDecisionForm";
import { collaborativeReview } from "../../utils/collaborativeReview";

function EligibilityDecisionTool({ article, checklist, researchQuestions, isSaving, onAdvance, onAssist, onDirtyChange, onSubmit }) {
  if (!article) return <aside aria-label="Decisão de elegibilidade" className="h-full bg-[#fbfbfe] p-5 text-sm text-[#667391]">Selecione um artigo para avaliar.</aside>;
  const review = collaborativeReview(article);
  async function handleSubmit(payload) {
    const saved = await onSubmit(article.id, payload);
    if (saved !== false) onAdvance?.();
  }
  return (
    <aside aria-label="Decisão de elegibilidade" className="h-full bg-[#fbfbfe] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a94aa]">Elegibilidade</p>
      <h2 className="mt-2 text-base font-semibold text-[#111936]">Validar texto completo</h2>
      {review.explanation ? <p className="mt-3 rounded-lg bg-[#fff9ed] px-3 py-2 text-xs text-[#8a5a00]">{review.explanation}</p> : null}
      <div className="mt-5"><EligibilityDecisionForm article={article} canDecide={review.canDecide} checklist={checklist} isSaving={isSaving} onAssist={onAssist} onDirtyChange={onDirtyChange} onSubmit={handleSubmit} researchQuestions={researchQuestions} submitLabel="Salvar e próximo" /></div>
    </aside>
  );
}

export default EligibilityDecisionTool;
