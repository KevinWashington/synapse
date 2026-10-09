import { useEffect, useMemo, useState } from "react";
import { CopyIcon, LoaderIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";

function ScreeningDecisionForm({
  article,
  aiCopyLabel = "Usar como rascunho",
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
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          data-decision="included"
          aria-pressed={decision === "included"}
          className={cn(
            "h-10 border-[#bfe8cf]",
            decision === "included" ? "bg-[#eefaf3] text-[#19884f]" : "bg-white text-[#56627f]"
          )}
          onClick={() => { setDecision("included"); setError(""); }}
          disabled={isSaving || !canDecide}
        >
          Incluir
        </Button>
        <Button
          type="button"
          variant="outline"
          data-decision="excluded"
          aria-pressed={decision === "excluded"}
          className={cn(
            "h-10 border-[#ffc9c9]",
            decision === "excluded" ? "bg-[#fff0f0] text-[#d94343]" : "bg-white text-[#56627f]"
          )}
          onClick={() => { setDecision("excluded"); setError(""); }}
          disabled={isSaving || !canDecide}
        >
          Excluir
        </Button>
      </div>

      <div className="rounded-lg border border-[#d4d0ff] bg-[#faf9ff] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#6259ff]">
            <SparklesIcon className="h-4 w-4" />
            Sugestão da IA
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border bg-white text-xs"
            disabled={isSaving || !canDecide || !aiJustification}
            onClick={() => setReasonText(aiJustification)}
          >
            <CopyIcon className="h-3.5 w-3.5" />
            {aiCopyLabel}
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#667391]">
          {aiJustification || "Execute a Triagem IA para gerar uma sugestão."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`screening-reason-${article?.id || "new"}`}>Justificativa</Label>
        <Textarea
          id={`screening-reason-${article?.id || "new"}`}
          value={reasonText}
          onChange={(event) => setReasonText(event.target.value)}
          rows={4}
          placeholder="Obrigatório ao excluir; opcional ao incluir."
          disabled={isSaving || !canDecide}
        />
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {secondaryAction}
        <Button type="submit" disabled={isSaving || !canDecide}>
          {isSaving ? <><LoaderIcon className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default ScreeningDecisionForm;
