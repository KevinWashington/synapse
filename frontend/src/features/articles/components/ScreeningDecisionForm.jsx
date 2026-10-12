import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, CopyIcon, LoaderIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import DecisionOptions from "./review/DecisionOptions";

function ScreeningDecisionForm({
  article,
  aiCopyLabel = "Copiar para justificativa",
  initialDecision = "included",
  isSaving,
  canDecide = true,
  onDirtyChange,
  onSubmit,
  secondaryAction = null,
  submitLabel = "Salvar decisão",
}) {
  const [decision, setDecision] = useState(initialDecision);
  const [reasonText, setReasonText] = useState(article?.screeningReasonText || "");
  const [error, setError] = useState("");
  const aiJustification = useMemo(
    () => typeof article?.aiEvaluation === "string" ? article.aiEvaluation.trim() : "",
    [article?.aiEvaluation]
  );

  useEffect(() => {
    setDecision(initialDecision);
    setReasonText(article?.screeningReasonText || "");
    setError("");
  }, [article, initialDecision]);

  useEffect(() => {
    const dirty = decision !== initialDecision
      || reasonText !== (article?.screeningReasonText || "");
    onDirtyChange?.(dirty);
  }, [article?.screeningReasonText, decision, initialDecision, onDirtyChange, reasonText]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (decision === "excluded" && !reasonText.trim()) {
      setError("A justificativa é obrigatória para exclusão.");
      return;
    }

    setError("");
    try {
      await onSubmit({ decision, reasonText: reasonText.trim() || null });
    } catch {
      setError("Não foi possível salvar. Revise a conexão e tente novamente.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DecisionOptions decision={decision} onChange={(value) => { setDecision(value); setError(""); }} disabled={isSaving || !canDecide} />

      <details key={article?.id} className="group rounded-lg border border-[#e2e6ef] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg p-3 focus-visible:outline-2 focus-visible:outline-[#6259ff]">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#6259ff]">
            <SparklesIcon className="h-4 w-4" />
            Sugestão da IA
          </span>
          <ChevronDownIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8a94aa] transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-[#edf0f7] p-3">
          <p className="text-xs leading-5 text-[#667391]">{aiJustification || "Execute a Triagem IA para gerar uma sugestão."}</p>
          <p className="text-xs leading-5 text-[#667391]">Sugestão de apoio. Revise o texto; a decisão final é sua.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-8 w-full gap-1.5 whitespace-normal border bg-white text-xs"
            disabled={isSaving || !canDecide || !aiJustification}
            onClick={() => setReasonText(aiJustification)}
          >
            <CopyIcon className="h-3.5 w-3.5" />
            {aiCopyLabel}
          </Button>
        </div>
      </details>

      <div className="space-y-2">
        <Label htmlFor={`screening-reason-${article?.id || "new"}`}>Justificativa</Label>
        <p id={`screening-help-${article?.id || "new"}`} className="text-xs leading-5 text-[#667391]">Obrigatória ao excluir; opcional ao incluir.</p>
        <Textarea
          id={`screening-reason-${article?.id || "new"}`}
          value={reasonText}
          onChange={(event) => setReasonText(event.target.value)}
          rows={5}
          className="min-h-32 bg-white text-sm shadow-none"
          aria-describedby={`screening-help-${article?.id || "new"}`}
          aria-invalid={Boolean(error && decision === "excluded" && !reasonText.trim())}
          placeholder="Registre os critérios que sustentam sua decisão."
          disabled={isSaving || !canDecide}
        />
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-[#edf0f7] pt-4">
        {secondaryAction}
        <Button type="submit" className="min-h-10 w-full bg-[#6259ff] text-white hover:bg-[#5148ee]" disabled={isSaving || !canDecide}>
          {isSaving ? <><LoaderIcon className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default ScreeningDecisionForm;
