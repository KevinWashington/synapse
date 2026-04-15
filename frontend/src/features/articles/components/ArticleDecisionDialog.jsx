import { useEffect, useMemo, useState } from "react";
import { AlertTriangleIcon, LoaderIcon } from "lucide-react";
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

function parseTextList(value) {
  return String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ArticleDecisionDialog({
  article,
  researchQuestions = [],
  initialDecision,
  isOpen,
  isSaving,
  onClose,
  onSubmit,
}) {
  const [decision, setDecision] = useState("pendente");
  const [reason, setReason] = useState("");
  const [exclusionCriteria, setExclusionCriteria] = useState("");
  const [answeringRQs, setAnsweringRQs] = useState([]);
  const [useSuggestedRQs, setUseSuggestedRQs] = useState(true);
  const [error, setError] = useState("");

  const articleTitle = useMemo(
    () => article?.title || "artigo selecionado",
    [article?.title]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const nextDecision =
      initialDecision ||
      article?.manualDecision ||
      (article?.status === "analisado"
        ? "incluido"
        : article?.status === "excluido"
          ? "excluido"
          : "pendente");

    setDecision(nextDecision);
    setReason(article?.manualDecisionReason || "");
    setExclusionCriteria((article?.exclusionCriteria || []).join(", "));
    const preselectedRQs =
      (article?.answeringRQs && article.answeringRQs.length > 0
        ? article.answeringRQs
        : article?.aiSuggestedRQs || []);
    setAnsweringRQs(
      preselectedRQs
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    );
    setUseSuggestedRQs(
      !article?.answeringRQs?.length && (article?.aiSuggestedRQs || []).length > 0
    );
    setError("");
  }, [article, initialDecision, isOpen]);

  function toggleRQSelection(rqNumber) {
    setAnsweringRQs((current) => {
      if (current.includes(rqNumber)) {
        return current.filter((value) => value !== rqNumber);
      }
      return [...current, rqNumber].sort((a, b) => a - b);
    });
  }

  function handleRQSelectChange(event) {
    const selectedValues = Array.from(event.target.selectedOptions)
      .map((option) => Number(option.value))
      .filter((value) => Number.isInteger(value) && value > 0);
    setAnsweringRQs(Array.from(new Set(selectedValues)).sort((a, b) => a - b));
  }

  function handleClose() {
    if (isSaving) {
      return;
    }
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const parsedCriteria = parseTextList(exclusionCriteria);
    const normalizedReason = reason.trim() || null;

    const payload = {
      decision,
      reason: normalizedReason,
      exclusionCriteria: decision === "excluido" ? parsedCriteria : [],
      answeringRQs: decision === "incluido" ? answeringRQs : [],
      useSuggestedRQs: decision === "incluido" ? useSuggestedRQs : false,
    };

    try {
      setError("");
      await onSubmit(payload);
    } catch (submitError) {
      setError(submitError?.message || "Não foi possível registrar a decisão.");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar decisão de triagem</DialogTitle>
          <DialogDescription className="line-clamp-2" title={articleTitle}>
            {articleTitle}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="article-decision">Decisão</Label>
            <select
              id="article-decision"
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              disabled={isSaving}
            >
              <option value="pendente">Pendente</option>
              <option value="incluido">Incluir no estudo</option>
              <option value="excluido">Excluir do estudo</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="article-decision-reason">Justificativa (opcional)</Label>
            <Textarea
              id="article-decision-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: atende aos critérios de inclusão 1 e 3"
              className="min-h-24"
              disabled={isSaving}
            />
          </div>

          {decision === "excluido" ? (
            <div className="space-y-2">
              <Label htmlFor="article-exclusion-criteria">Critérios de exclusão</Label>
              <input
                id="article-exclusion-criteria"
                value={exclusionCriteria}
                onChange={(event) => setExclusionCriteria(event.target.value)}
                placeholder="Ex.: fora do escopo, sem avaliação empírica"
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
                disabled={isSaving}
              />
              <p className="text-xs text-[var(--syn-text-secondary)]">
                Separe por vírgula.
              </p>
            </div>
          ) : null}

          {decision === "incluido" ? (
            <div className="space-y-2">
              <Label htmlFor="article-answering-rqs-select">RQs respondidas</Label>
              {researchQuestions.length ? (
                <>
                  <select
                    id="article-answering-rqs-select"
                    multiple
                    value={answeringRQs.map(String)}
                    onChange={handleRQSelectChange}
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                    disabled={isSaving}
                  >
                    {researchQuestions.map((question, index) => {
                      const rqNumber = index + 1;
                      return (
                        <option key={rqNumber} value={rqNumber}>
                          {`RQ ${rqNumber}: ${question}`}
                        </option>
                      );
                    })}
                  </select>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {researchQuestions.map((question, index) => {
                      const rqNumber = index + 1;
                      const selected = answeringRQs.includes(rqNumber);
                      return (
                        <button
                          key={`chip-rq-${rqNumber}`}
                          type="button"
                          onClick={() => toggleRQSelection(rqNumber)}
                          disabled={isSaving}
                          className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                            selected
                              ? "border-[var(--syn-sidebar-accent)] bg-[var(--syn-bg-secondary)] text-[var(--syn-text-primary)]"
                              : "border-[var(--syn-border)] text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)]"
                          }`}
                          title={question}
                        >
                          {`RQ ${rqNumber}`}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[var(--syn-text-secondary)]">
                    Selecione uma ou mais RQs no select (ou pelos atalhos acima).
                  </p>

                  <label className="flex items-center gap-2 text-xs text-[var(--syn-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={useSuggestedRQs}
                      onChange={(event) => setUseSuggestedRQs(event.target.checked)}
                      disabled={isSaving}
                    />
                    Usar RQs sugeridas pela IA quando nenhuma RQ for selecionada.
                  </label>
                </>
              ) : (
                <p className="text-xs text-[var(--syn-text-secondary)]">
                  Este projeto ainda não possui perguntas de pesquisa cadastradas.
                </p>
              )}
            </div>
          ) : null}

          {error ? (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangleIcon className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                  Salvando...
                </span>
              ) : (
                "Salvar decisão"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ArticleDecisionDialog;