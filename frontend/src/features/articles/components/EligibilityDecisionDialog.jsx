import { useEffect, useMemo, useState } from "react";
import { LoaderIcon } from "lucide-react";
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

function EligibilityDecisionDialog({
  article,
  checklist = [],
  researchQuestions = [],
  isOpen,
  isSaving,
  onClose,
  onSubmit,
}) {
  const [decision, setDecision] = useState("included");
  const [reasonText, setReasonText] = useState("");
  const [answers, setAnswers] = useState({});
  const [selectedRQs, setSelectedRQs] = useState([]);
  const [error, setError] = useState("");

  const checklistEntries = useMemo(
    () => checklist.map((item, index) => ({ key: `item-${index + 1}`, label: item })),
    [checklist]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDecision("included");
    setReasonText(article?.eligibilityReasonText || "");
    setAnswers(article?.eligibilityChecklistAnswers || {});
    setSelectedRQs(article?.answeringRQs || []);
    setError("");
  }, [article, isOpen]);

  function toggleRQ(rqNumber) {
    setSelectedRQs((current) =>
      current.includes(rqNumber)
        ? current.filter((value) => value !== rqNumber)
        : [...current, rqNumber].sort((left, right) => left - right)
    );
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
    await onSubmit({
      decision,
      reasonText: reasonText.trim() || null,
      checklistAnswers: answers,
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
            <div className="space-y-3 rounded-md border border-[var(--syn-border)] p-3">
              <p className="text-sm font-semibold text-[var(--syn-text-primary)]">Checklist do projeto</p>
              {checklistEntries.map((entry) => (
                <div key={entry.key} className="space-y-2">
                  <Label>{entry.label}</Label>
                  <Textarea
                    value={answers[entry.key] || ""}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [entry.key]: event.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="Registre a avaliacao deste criterio..."
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
