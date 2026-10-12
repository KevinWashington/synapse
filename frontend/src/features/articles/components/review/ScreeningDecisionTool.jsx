import { collaborativeReview } from "../../utils/collaborativeReview";
import ScreeningDecisionForm from "../ScreeningDecisionForm";
import DecisionPanel from "./DecisionPanel";

function isEditableTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return ["input", "textarea", "select"].includes(tagName) || target?.isContentEditable;
}

function ScreeningDecisionTool({
  article,
  isSaving,
  onAdvance,
  onDirtyChange,
  onSubmit,
  onSkip,
}) {
  if (!article) {
    return <aside aria-label="Decisão de triagem" className="h-full bg-[#fbfbfe] p-5 text-sm text-[#667391]">Selecione um artigo para decidir.</aside>;
  }

  const review = collaborativeReview(article);

  function handleKeyDown(event) {
    if (isSaving || isEditableTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "i") event.currentTarget.querySelector('[data-decision="included"]')?.click();
    if (key === "e") event.currentTarget.querySelector('[data-decision="excluded"]')?.click();
    if (key === "p") onSkip?.();
  }

  async function handleSubmit(payload) {
    const saved = await onSubmit(article.id, payload);
    if (saved !== false) onAdvance?.();
  }

  return (
    <DecisionPanel title="Decisão de triagem" description="Avalie título e resumo conforme os critérios da revisão." article={article} review={review} onKeyDown={handleKeyDown}>
        <ScreeningDecisionForm
          article={article}
          canDecide={review.canDecide}
          isSaving={isSaving}
          onDirtyChange={onDirtyChange}
          onSubmit={handleSubmit}
          submitLabel="Salvar e próximo"
        />
      <button
        type="button"
        className="w-full rounded-lg px-3 py-2 text-xs text-[#667391] hover:bg-[#f0f2f7] focus-visible:outline-2 focus-visible:outline-[#6259ff] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onSkip}
        disabled={isSaving || !onSkip}
      >
        Pular estudo
      </button>
      <p className="mt-2 text-center text-[10px] text-[#929bb0]">Atalhos: I incluir · E excluir · P pular</p>
    </DecisionPanel>
  );
}

export default ScreeningDecisionTool;
