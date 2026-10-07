import { useEffect, useState } from "react";
import { CopyIcon, LoaderIcon } from "lucide-react";
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

function ScreeningDecisionDialog({
  article,
  initialDecision = "included",
  isOpen,
  isSaving,
  onClose,
  onSubmit,
}) {
  const [decision, setDecision] = useState("included");
  const [reasonText, setReasonText] = useState("");
  const [error, setError] = useState("");
  const aiJustification = typeof article?.aiEvaluation === "string"
    ? article.aiEvaluation.trim()
    : "";

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDecision(initialDecision);
    setReasonText(article?.screeningReasonText || "");
    setError("");
  }, [article, initialDecision, isOpen]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (decision === "excluded" && !reasonText.trim()) {
      setError("A justificativa e obrigatoria para exclusao.");
      return;
    }

    setError("");
    await onSubmit({
      decision,
      reasonText: reasonText.trim() || null,
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Decisão de triagem</DialogTitle>
          <DialogDescription>{article?.title || "Registro selecionado"}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2">
            <Button
              type="button"
              variant={decision === "included" ? "default" : "outline"}
              onClick={() => setDecision("included")}
              disabled={isSaving}
            >
              Incluir para elegibilidade
            </Button>
            <Button
              type="button"
              variant={decision === "excluded" ? "default" : "outline"}
              onClick={() => setDecision("excluded")}
              disabled={isSaving}
            >
              Excluir na triagem
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="screening-reason">Justificativa</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg bg-white shadow-sm"
                disabled={isSaving || !aiJustification}
                onClick={() => setReasonText(aiJustification)}
              >
                <CopyIcon className="h-4 w-4" />
                Copiar justificativa da IA
              </Button>
            </div>
            {!aiJustification ? (
              <p className="text-sm text-gray-500">
                Execute a Triagem IA para gerar uma sugestão.
              </p>
            ) : null}
            <Textarea
              id="screening-reason"
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              rows={4}
              placeholder="Obrigatório ao excluir. Ex.: não condiz com a PICO."
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
                "Salvar decisão"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ScreeningDecisionDialog;
