import { useEffect, useMemo, useState } from "react";
import { LoaderIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import DecisionOptions from "./review/DecisionOptions";

const STATUS_OPTIONS = [
  { value: "met", label: "Sim", stored: "Atende", tone: "border-[#bfe8cf] bg-[#eefaf3] text-[#19884f]" },
  { value: "not_met", label: "Não", stored: "Nao atende", tone: "border-[#ffc9c9] bg-[#fff0f0] text-[#d94343]" },
  { value: "unclear", label: "Incerto", stored: "Incerto", tone: "border-[#ffe2a8] bg-[#fff8e8] text-[#a16500]" },
  { value: "not_applicable", label: "N/A", stored: "N/A", tone: "border-[#dfe4ef] bg-[#f5f7fb] text-[#56627f]" },
];

function formatAnswer(status, evidence) {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  if (!option && !evidence.trim()) return "";
  return `Status: ${option?.stored || "Nao avaliado"}${evidence.trim() ? `\nEvidencia: ${evidence.trim()}` : ""}`;
}

function EligibilityDecisionForm({
  article,
  checklist = [],
  researchQuestions = [],
  initialDecision = "included",
  isSaving,
  canDecide = true,
  onAssist,
  onDirtyChange,
  onSubmit,
  secondaryAction = null,
  submitLabel = "Salvar decisão",
}) {
  const entries = useMemo(() => checklist.map((label, index) => ({ key: `item-${index + 1}`, label })), [checklist]);
  const [decision, setDecision] = useState(initialDecision);
  const [reasonText, setReasonText] = useState("");
  const [statuses, setStatuses] = useState({});
  const [evidence, setEvidence] = useState({});
  const [selectedRQs, setSelectedRQs] = useState([]);
  const [error, setError] = useState("");
  const [assistError, setAssistError] = useState("");
  const [aiDraft, setAiDraft] = useState(false);
  const [isAssisting, setIsAssisting] = useState(false);

  useEffect(() => {
    setDecision(initialDecision);
    setReasonText(article?.eligibilityReasonText || "");
    setSelectedRQs(article?.answeringRQs || []);
    setStatuses({});
    setEvidence({});
    setError("");
    setAssistError("");
    setAiDraft(false);
  }, [article, initialDecision]);

  useEffect(() => {
    const initialReason = article?.eligibilityReasonText || "";
    const initialRQs = article?.answeringRQs || [];
    const hasChangedRQs = selectedRQs.length !== initialRQs.length
      || selectedRQs.some((value) => !initialRQs.includes(value));
    onDirtyChange?.(
      decision !== initialDecision
      || reasonText !== initialReason
      || Object.keys(statuses).length > 0
      || Object.values(evidence).some(Boolean)
      || hasChangedRQs
    );
  }, [article?.answeringRQs, article?.eligibilityReasonText, decision, evidence, initialDecision, onDirtyChange, reasonText, selectedRQs, statuses]);

  async function assistWithAI() {
    if (!onAssist || isAssisting) return;
    setAssistError("");
    setIsAssisting(true);
    try {
      const result = await onAssist({ articleId: article?.id, checklist: entries, researchQuestions });
      const nextStatuses = {};
      const nextEvidence = {};
      (result?.items || []).forEach((item) => {
        if (!entries.some((entry) => entry.key === item.key)) return;
        nextStatuses[item.key] = item.status || "unclear";
        nextEvidence[item.key] = item.evidence || item.note || "";
      });
      setStatuses((current) => ({ ...current, ...nextStatuses }));
      setEvidence((current) => ({ ...current, ...nextEvidence }));
      if (result?.reasonText && !reasonText) setReasonText(result.reasonText);
      setAiDraft(true);
    } catch {
      setAssistError("A assistência da IA não está disponível. Continue a avaliação manualmente.");
    } finally {
      setIsAssisting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (decision === "included" && !article?.hasPdf) return setError("Envie o PDF antes de incluir o artigo no corpus final.");
    if (decision === "excluded" && !reasonText.trim()) return setError("A justificativa da exclusão é obrigatória.");
    if (decision === "full_text_unavailable" && !reasonText.trim()) return setError("O motivo da indisponibilidade é obrigatório.");
    const checklistAnswers = decision === "full_text_unavailable" ? {} : Object.fromEntries(
      entries.map((entry) => [entry.key, formatAnswer(statuses[entry.key], evidence[entry.key] || "")])
    );
    setError("");
    try {
      await onSubmit({
        decision,
        reasonText: reasonText.trim() || null,
        checklistAnswers,
        answeringRQs: decision === "included" ? selectedRQs : [],
      });
    } catch {
      setError("Não foi possível salvar. Revise a conexão e tente novamente.");
    }
  }

  const reasonLabel = decision === "excluded" ? "Justificativa da exclusão" : decision === "full_text_unavailable" ? "Motivo da indisponibilidade" : "Justificativa";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <DecisionOptions decision={decision} onChange={(value) => { setDecision(value); setError(""); }} disabled={isSaving || !canDecide} allowUnavailable />

      {decision !== "full_text_unavailable" && entries.length ? (
        <section className="space-y-3 border-y border-[#e5e8f0] py-4">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-[#111936]">Checklist assistido</h3><p className="mt-1 text-xs leading-5 text-[#667391]">A IA preenche apenas um rascunho. A decisão final continua humana.</p></div>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 bg-white text-xs" disabled={isSaving || isAssisting || !canDecide || !onAssist} onClick={assistWithAI}>
              {isAssisting ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : <SparklesIcon className="h-3.5 w-3.5" />}{isAssisting ? "Analisando..." : "Assistir com IA"}
            </Button>
          </div>
          {aiDraft ? <p className="rounded-md bg-[#f0edff] px-3 py-2 text-xs text-[#554bea]">Rascunho gerado pela IA — revise antes de salvar.</p> : null}
          {assistError ? <p role="alert" className="rounded-md bg-[#fff9ed] px-3 py-2 text-xs text-[#8a5a00]">{assistError}</p> : null}
          {entries.map((entry) => (
            <div key={entry.key} className="rounded-lg border border-[#e2e6ef] bg-white p-3">
              <p className="text-xs font-semibold leading-5 text-[#111936]">{entry.label}</p>
              <div className="mt-2 flex flex-wrap gap-1">{STATUS_OPTIONS.map((option) => (
                <button key={option.value} type="button" aria-label={option.label} aria-pressed={statuses[entry.key] === option.value} className={cn("rounded-md border px-2 py-1 text-[11px]", statuses[entry.key] === option.value ? option.tone : "border-[#dfe4ef] bg-white text-[#667391]")} disabled={isSaving || !canDecide} onClick={() => setStatuses((current) => ({ ...current, [entry.key]: option.value }))}>{option.label}</button>
              ))}</div>
              <Label htmlFor={`evidence-${entry.key}`} className="sr-only">Evidência: {entry.label}</Label>
              <Textarea id={`evidence-${entry.key}`} aria-label={`Evidência: ${entry.label}`} className="mt-2" rows={2} value={evidence[entry.key] || ""} onChange={(event) => setEvidence((current) => ({ ...current, [entry.key]: event.target.value }))} disabled={isSaving || !canDecide} />
            </div>
          ))}
        </section>
      ) : null}

      {decision === "included" && researchQuestions.length ? (
        <section><h3 className="text-sm font-medium text-[#111936]">Perguntas respondidas pelo estudo</h3>
          <p className="mt-1 text-xs leading-5 text-[#667391]">Selecione as perguntas para as quais o artigo oferece evidências.</p>
          <details key={article?.id} className="mt-2 rounded-lg border border-[#e2e6ef] bg-white">
            <summary className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium text-[#667391] focus-visible:outline-2 focus-visible:outline-[#6259ff]">Consultar perguntas</summary>
            <ol className="max-h-48 space-y-3 overflow-y-auto border-t border-[#edf0f7] p-3">{researchQuestions.map((question, index) => <li key={index} className="text-xs leading-5 text-[#56627f]"><span className="font-semibold text-[#111936]">RQ {index + 1}</span><p className="break-words">{question}</p></li>)}</ol>
          </details>
          <div role="group" aria-label="Perguntas respondidas pelo estudo" className="mt-3 flex flex-wrap gap-2">{researchQuestions.map((question, index) => {
          const number = index + 1; const selected = selectedRQs.includes(number);
          return <button key={number} type="button" aria-pressed={selected} className={cn("min-h-8 rounded-md border px-3 py-1 text-xs focus-visible:outline-2 focus-visible:outline-[#6259ff] disabled:cursor-not-allowed disabled:opacity-50", selected ? "border-[#6259ff] bg-[#f0edff] font-semibold text-[#554bea]" : "border-[#dfe4ef] bg-white text-[#667391]")} title={question} disabled={isSaving || !canDecide} onClick={() => setSelectedRQs((current) => selected ? current.filter((value) => value !== number) : [...current, number])}>RQ {number}</button>;
        })}</div></section>
      ) : null}

      {decision === "full_text_unavailable" ? <p className="rounded-md bg-[#f5f7fb] p-3 text-xs leading-5 text-[#667391]">Informe por que não foi possível acessar o texto completo deste artigo.</p> : null}

      <div className="space-y-2">
        <Label htmlFor={`eligibility-reason-${article?.id || "new"}`}>{reasonLabel}</Label>
        <p id={`eligibility-help-${article?.id || "new"}`} className="text-xs leading-5 text-[#667391]">{decision === "full_text_unavailable" ? "Descreva as tentativas de acesso e o motivo da indisponibilidade." : "Obrigatória ao excluir; opcional ao incluir."}</p>
        <Textarea id={`eligibility-reason-${article?.id || "new"}`} aria-describedby={`eligibility-help-${article?.id || "new"}`} aria-invalid={Boolean(error && decision !== "included" && !reasonText.trim())} className="min-h-32 bg-white text-sm shadow-none" value={reasonText} onChange={(event) => setReasonText(event.target.value)} rows={5} placeholder="Registre os critérios que sustentam sua decisão." required={decision !== "included"} disabled={isSaving || !canDecide} />
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      </div>
      <div className="flex flex-col gap-2 border-t border-[#edf0f7] pt-4">{secondaryAction}<Button type="submit" className="min-h-10 w-full bg-[#6259ff] text-white hover:bg-[#5148ee]" disabled={isSaving || !canDecide}>{isSaving ? <><LoaderIcon className="h-4 w-4 animate-spin" />Salvando...</> : submitLabel}</Button></div>
    </form>
  );
}

export default EligibilityDecisionForm;
