import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  HelpCircleIcon,
  LoaderIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { articleService } from "@features/articles/services/articleService";
import { chatService } from "@/services/chatService";
import { cn } from "@/lib/utils";

const CHECKLIST_STATUS_OPTIONS = [
  {
    value: "met",
    label: "Atende",
    shortLabel: "Sim",
    icon: CheckCircle2Icon,
    className: "border-[#bfe8cf] bg-[#eefaf3] text-[#19884f]",
  },
  {
    value: "not_met",
    label: "Nao atende",
    shortLabel: "Nao",
    icon: XCircleIcon,
    className: "border-[#ffc9c9] bg-[#fff0f0] text-[#d94343]",
  },
  {
    value: "unclear",
    label: "Incerto",
    shortLabel: "Incerto",
    icon: HelpCircleIcon,
    className: "border-[#ffe2a8] bg-[#fff8e8] text-[#b26d00]",
  },
  {
    value: "not_applicable",
    label: "N/A",
    shortLabel: "N/A",
    icon: AlertTriangleIcon,
    className: "border-[#dfe4ef] bg-[#f5f7fb] text-[#56627f]",
  },
];

const STATUS_BY_VALUE = CHECKLIST_STATUS_OPTIONS.reduce((result, option) => {
  result[option.value] = option;
  return result;
}, {});

function normalizeChecklistStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["met", "atende", "sim", "yes", "included", "include"].includes(normalized)) {
    return "met";
  }
  if (["not_met", "nao_atende", "nao atende", "nao", "no", "excluded", "exclude"].includes(normalized)) {
    return "not_met";
  }
  if (["not_applicable", "na", "n/a", "not applicable"].includes(normalized)) {
    return "not_applicable";
  }
  if (["unclear", "incerto", "indefinido", "maybe", "unknown"].includes(normalized)) {
    return "unclear";
  }
  return "";
}

function parseChecklistAnswer(value) {
  if (typeof value === "boolean") {
    return {
      status: value ? "met" : "not_met",
      note: "",
    };
  }

  const text = String(value || "");
  const statusMatch = text.match(/^Status:\s*([^\n]+)\n?/i);
  if (!statusMatch) {
    return {
      status: "",
      note: text,
    };
  }

  const status = normalizeChecklistStatus(statusMatch[1]);
  const note = text.replace(/^Status:\s*[^\n]+\n?/i, "").replace(/^Evidencia:\s*/i, "").trim();
  return { status, note };
}

function formatChecklistAnswer(status, note) {
  const statusLabel = STATUS_BY_VALUE[status]?.label || "Nao avaliado";
  const normalizedNote = String(note || "").trim();
  if (!normalizedNote) {
    return status ? `Status: ${statusLabel}` : "";
  }
  return `Status: ${statusLabel}\nEvidencia: ${normalizedNote}`;
}

function extractJsonPayload(text) {
  const normalized = String(text || "").trim();
  const fenceMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1] : normalized;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return null;
  }

  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    return null;
  }
}

async function extractPdfContent(pdfData) {
  if (!(pdfData instanceof ArrayBuffer)) {
    return "";
  }

  const pdfjsLib = await import(
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs"
  );

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs";

  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  let extractedText = "";

  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 12); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    extractedText += `Pagina ${pageNumber}: ${pageText}\n\n`;
  }

  return extractedText.length > 10000
    ? `${extractedText.substring(0, 10000)}...`
    : extractedText.trim();
}

function buildAssistancePrompt({ article, checklistEntries, researchQuestions }) {
  const checklistBlock = checklistEntries
    .map((entry, index) => `${index + 1}. ${entry.label} [key=${entry.key}]`)
    .join("\n");
  const rqBlock = researchQuestions.length
    ? researchQuestions.map((question, index) => `RQ ${index + 1}: ${question}`).join("\n")
    : "Nenhuma RQ cadastrada.";

  return `ELIGIBILITY_CHECKLIST_ASSIST
Voce esta apoiando a etapa de elegibilidade por texto completo. A decisao final deve continuar humana.

Tarefa:
1. Para cada item do checklist, procure evidencia no artigo.
2. Marque status como "met", "not_met", "unclear" ou "not_applicable".
3. Use evidencia literal curta quando houver. Nao invente evidencia.
4. Sugira uma decisao apenas como rascunho: "included", "excluded" ou "review".
5. Se faltar texto completo, use "unclear" e explique a limitacao.

Checklist:
${checklistBlock}

Perguntas de pesquisa:
${rqBlock}

Artigo:
Titulo: ${article?.title || "Nao informado"}
Autores: ${article?.authors || "Nao informado"}
Ano: ${article?.year || "Nao informado"}
Resumo: ${article?.abstract || "Nao informado"}

Responda apenas em JSON neste formato:
{
  "items": [
    {
      "key": "item-1",
      "status": "met",
      "evidence": "trecho literal curto ou vazio",
      "note": "observacao curta"
    }
  ],
  "suggestedDecision": "included",
  "reasonText": "rascunho curto da justificativa"
}`;
}

function summarizeChecklist(statuses) {
  const values = Object.values(statuses || {});
  return {
    met: values.filter((value) => value === "met").length,
    notMet: values.filter((value) => value === "not_met").length,
    unclear: values.filter((value) => value === "unclear").length,
    notApplicable: values.filter((value) => value === "not_applicable").length,
    answered: values.filter(Boolean).length,
    total: values.length,
  };
}

function suggestDecisionFromChecklist(summary) {
  if (summary.notMet > 0) {
    return {
      decision: "excluded",
      label: "Sugestao: excluir",
      description: "Ha criterios nao atendidos. Revise as evidencias antes de confirmar.",
      className: "border-[#ffc9c9] bg-[#fff5f5] text-[#b83232]",
    };
  }

  if (summary.unclear > 0 || summary.answered < summary.total) {
    return {
      decision: "review",
      label: "Sugestao: revisar",
      description: "Ainda ha criterios incertos ou sem avaliacao.",
      className: "border-[#ffe2a8] bg-[#fff9ed] text-[#a16500]",
    };
  }

  return {
    decision: "included",
    label: "Sugestao: incluir",
    description: "Todos os criterios avaliados estao atendidos ou nao se aplicam.",
    className: "border-[#bfe8cf] bg-[#f1fbf5] text-[#19884f]",
  };
}

function EligibilityDecisionDialog({
  article,
  checklist = [],
  pdfData,
  projectId,
  initialDecision = "included",
  researchQuestions = [],
  isOpen,
  isSaving,
  onClose,
  onSubmit,
}) {
  const [decision, setDecision] = useState("included");
  const [reasonText, setReasonText] = useState("");
  const [answers, setAnswers] = useState({});
  const [answerStatuses, setAnswerStatuses] = useState({});
  const [selectedRQs, setSelectedRQs] = useState([]);
  const [error, setError] = useState("");
  const [assistantError, setAssistantError] = useState("");
  const [assistantRaw, setAssistantRaw] = useState("");
  const [assistantSuggestedDecision, setAssistantSuggestedDecision] = useState("");
  const [isAssisting, setIsAssisting] = useState(false);

  const checklistKey = useMemo(() => JSON.stringify(checklist || []), [checklist]);
  const checklistEntries = useMemo(
    () => checklist.map((item, index) => ({ key: `item-${index + 1}`, label: item })),
    [checklistKey]
  );
  const checklistSummary = useMemo(() => summarizeChecklist(answerStatuses), [answerStatuses]);
  const checklistSuggestion = useMemo(
    () => suggestDecisionFromChecklist(checklistSummary),
    [checklistSummary]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const savedAnswers = article?.eligibilityChecklistAnswers || {};
    const nextAnswers = {};
    const nextStatuses = {};

    checklistEntries.forEach((entry) => {
      const parsed = parseChecklistAnswer(savedAnswers[entry.key]);
      nextAnswers[entry.key] = parsed.note;
      nextStatuses[entry.key] = parsed.status;
    });

    setDecision(initialDecision);
    setReasonText(article?.eligibilityReasonText || "");
    setAnswers(nextAnswers);
    setAnswerStatuses(nextStatuses);
    setSelectedRQs(article?.answeringRQs || []);
    setError("");
    setAssistantError("");
    setAssistantRaw("");
    setAssistantSuggestedDecision("");
    setIsAssisting(false);
  }, [article, checklistEntries, initialDecision, isOpen]);

  function toggleRQ(rqNumber) {
    setSelectedRQs((current) =>
      current.includes(rqNumber)
        ? current.filter((value) => value !== rqNumber)
        : [...current, rqNumber].sort((left, right) => left - right)
    );
  }

  function updateChecklistStatus(key, status) {
    setAnswerStatuses((current) => ({
      ...current,
      [key]: current[key] === status ? "" : status,
    }));
  }

  async function resolveArticleContent() {
    if (pdfData instanceof ArrayBuffer) {
      return extractPdfContent(pdfData);
    }

    const resolvedProjectId = projectId || article?.projectId;
    if (!resolvedProjectId || !article?.id || article?.hasPdf === false) {
      return "";
    }

    const fetchedPdfData = await articleService.getPdfData(resolvedProjectId, article.id);
    return extractPdfContent(fetchedPdfData);
  }

  async function handleAssistWithAI() {
    if (!checklistEntries.length || isAssisting) {
      return;
    }

    setAssistantError("");
    setAssistantRaw("");
    setAssistantSuggestedDecision("");
    setIsAssisting(true);

    try {
      let content = "";
      try {
        content = await resolveArticleContent();
      } catch (contentError) {
        console.warn("Nao foi possivel extrair texto do PDF:", contentError);
      }

      const prompt = buildAssistancePrompt({
        article,
        checklistEntries,
        researchQuestions,
      });

      const response = await chatService.sendChatMessage({
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        article: {
          title: article?.title || "Artigo selecionado",
          abstract: article?.abstract,
          authors: article?.authors,
          year: article?.year,
          journal: article?.journal,
          doi: article?.doi,
          content,
        },
      });

      const parsed = extractJsonPayload(response?.content);
      if (!parsed) {
        setAssistantRaw(response?.content || "");
        setAssistantError("A IA retornou uma resposta sem estrutura. Revise o texto bruto abaixo.");
        return;
      }

      const nextAnswers = {};
      const nextStatuses = {};
      (parsed.items || []).forEach((item) => {
        const key = item.key;
        if (!checklistEntries.some((entry) => entry.key === key)) {
          return;
        }

        const status = normalizeChecklistStatus(item.status) || "unclear";
        const evidence = String(item.evidence || "").trim();
        const note = String(item.note || "").trim();
        nextStatuses[key] = status;
        nextAnswers[key] = [evidence, note].filter(Boolean).join("\n");
      });

      setAnswerStatuses((current) => ({
        ...current,
        ...nextStatuses,
      }));
      setAnswers((current) => ({
        ...current,
        ...nextAnswers,
      }));

      if (parsed.suggestedDecision) {
        setAssistantSuggestedDecision(parsed.suggestedDecision);
      }
      if (parsed.reasonText && !reasonText.trim()) {
        setReasonText(parsed.reasonText);
      }
    } catch (assistError) {
      setAssistantError(`Erro ao executar assistencia IA: ${assistError.message}`);
    } finally {
      setIsAssisting(false);
    }
  }

  function applyChecklistSuggestion() {
    const suggestedDecision =
      assistantSuggestedDecision === "included" || assistantSuggestedDecision === "excluded"
        ? assistantSuggestedDecision
        : checklistSuggestion.decision;

    if (suggestedDecision === "included" || suggestedDecision === "excluded") {
      setDecision(suggestedDecision);
    }

    if (!reasonText.trim() && suggestedDecision === "excluded") {
      const failedItems = checklistEntries
        .filter((entry) => answerStatuses[entry.key] === "not_met")
        .map((entry) => entry.label);
      setReasonText(
        failedItems.length
          ? `Criterios nao atendidos: ${failedItems.join("; ")}.`
          : "Exclusao sugerida pela avaliacao assistida. Revise e ajuste esta justificativa."
      );
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (decision !== "included" && !reasonText.trim()) {
      setError("A justificativa e obrigatoria para exclusoes e full text indisponivel.");
      return;
    }

    if (decision === "included" && article?.fullTextStatus !== "uploaded" && !article?.hasPdf) {
      setError("Envie o PDF antes de incluir o artigo no corpus final.");
      return;
    }

    setError("");
    const checklistAnswers = Object.fromEntries(
      checklistEntries.map((entry) => [
        entry.key,
        formatChecklistAnswer(answerStatuses[entry.key], answers[entry.key]),
      ])
    );

    await onSubmit({
      decision,
      reasonText: reasonText.trim() || null,
      checklistAnswers,
      answeringRQs: decision === "included" ? selectedRQs : [],
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Decisao de Elegibilidade</DialogTitle>
          <DialogDescription>{article?.title || "Artigo selecionado"}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2 md:grid-cols-3">
            <Button type="button" variant={decision === "included" ? "default" : "outline"} onClick={() => setDecision("included")} disabled={isSaving}>
              Incluir no corpus
            </Button>
            <Button type="button" variant={decision === "excluded" ? "default" : "outline"} onClick={() => setDecision("excluded")} disabled={isSaving}>
              Excluir
            </Button>
            <Button
              type="button"
              variant={decision === "full_text_unavailable" ? "default" : "outline"}
              onClick={() => setDecision("full_text_unavailable")}
              disabled={isSaving}
            >
              Full text indisponivel
            </Button>
          </div>

          {checklistEntries.length ? (
            <div className="space-y-4 rounded-md border border-[var(--syn-border)] p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--syn-text-primary)]">Checklist assistido</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--syn-text-secondary)]">
                    A IA pode preencher evidencias como rascunho. A decisao final continua humana.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-2"
                  onClick={handleAssistWithAI}
                  disabled={isSaving || isAssisting}
                >
                  {isAssisting ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
                  {isAssisting ? "Analisando..." : "Assistir com IA"}
                </Button>
              </div>

              <div className={cn("rounded-md border px-3 py-2 text-xs", checklistSuggestion.className)}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{checklistSuggestion.label}</p>
                    <p className="mt-1">{checklistSuggestion.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 bg-white/80"
                    onClick={applyChecklistSuggestion}
                    disabled={isSaving || checklistSuggestion.decision === "review"}
                  >
                    Usar sugestao
                  </Button>
                </div>
                <p className="mt-2">
                  {checklistSummary.met} atendidos | {checklistSummary.notMet} nao atendidos | {checklistSummary.unclear} incertos | {checklistSummary.notApplicable} N/A
                </p>
              </div>

              {assistantError ? (
                <div className="rounded-md border border-[#ffe2a8] bg-[#fff9ed] px-3 py-2 text-xs text-[#9b6200]">
                  <p className="font-semibold">{assistantError}</p>
                  {assistantRaw ? <p className="mt-2 whitespace-pre-wrap leading-5">{assistantRaw}</p> : null}
                </div>
              ) : null}

              {checklistEntries.map((entry) => (
                <div key={entry.key} className="space-y-2 rounded-md border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <Label className="text-[var(--syn-text-primary)]">{entry.label}</Label>
                    <div className="flex flex-wrap gap-1">
                      {CHECKLIST_STATUS_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const active = answerStatuses[entry.key] === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateChecklistStatus(entry.key, option.value)}
                            disabled={isSaving}
                            className={cn(
                              "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
                              active ? option.className : "border-[#dfe4ef] bg-white text-[#56627f]"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {option.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Textarea
                    value={answers[entry.key] || ""}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [entry.key]: event.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="Registre evidencia, pagina, trecho ou observacao deste criterio..."
                    disabled={isSaving}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {researchQuestions.length ? (
            <div className="space-y-2">
              <Label>RQs respondidas</Label>
              <div className="flex flex-wrap gap-2">
                {researchQuestions.map((question, index) => {
                  const rqNumber = index + 1;
                  const active = selectedRQs.includes(rqNumber);
                  return (
                    <button
                      key={rqNumber}
                      type="button"
                      onClick={() => toggleRQ(rqNumber)}
                      disabled={isSaving || decision !== "included"}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        active
                          ? "border-[var(--syn-sidebar-accent)] bg-[var(--syn-bg-secondary)]"
                          : "border-[var(--syn-border)]"
                      }`}
                      title={question}
                    >
                      {`RQ ${rqNumber}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Justificativa</Label>
            <Textarea
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              rows={4}
              placeholder="Obrigatoria para exclusao ou texto completo indisponivel."
              disabled={isSaving}
            />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                  Salvando...
                </span>
              ) : (
                "Salvar decisao"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EligibilityDecisionDialog;
