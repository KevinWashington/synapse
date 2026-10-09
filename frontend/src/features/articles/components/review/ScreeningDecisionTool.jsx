import { collaborativeReview } from "../../utils/collaborativeReview";
import ScreeningDecisionForm from "../ScreeningDecisionForm";

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
    if (isEditableTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
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
    <aside
      aria-label="Decisão de triagem"
      className="h-full bg-[#fbfbfe] p-5"
      onKeyDown={handleKeyDown}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a94aa]">Apoio à decisão</p>
      <h2 className="mt-2 text-base font-semibold text-[#111936]">Avaliar este estudo</h2>
      {review.explanation ? (
        <p className="mt-3 rounded-lg border border-[#ffe2a8] bg-[#fff9ed] px-3 py-2 text-xs leading-5 text-[#8a5a00]">
          {review.explanation}
        </p>
      ) : null}
      {article.myReviewAssignment?.status === "submitted" ? (
        <p className="mt-2 text-xs leading-5 text-[#667391]">Sua decisão e justificativa aparecem no painel do artigo.</p>
      ) : null}
      <div className="mt-5">
        <ScreeningDecisionForm
          article={article}
          canDecide={review.canDecide}
          isSaving={isSaving}
          onDirtyChange={onDirtyChange}
          onSubmit={handleSubmit}
          submitLabel="Salvar e próximo"
        />
      </div>
      <button
        type="button"
        className="mt-2 w-full rounded-lg px-3 py-2 text-xs text-[#667391] hover:bg-[#f0f2f7]"
        onClick={onSkip}
      >
        Pular por enquanto
      </button>
      <p className="mt-2 text-center text-[10px] text-[#929bb0]">Atalhos: I incluir · E excluir · P pular</p>
    </aside>
  );
}

export default ScreeningDecisionTool;
