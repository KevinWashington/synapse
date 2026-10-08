import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import TeamSelect from "./TeamSelect";

const labels = {
  included: "Incluir",
  excluded: "Excluir",
  full_text_unavailable: "Texto completo indisponível",
};
export default function ConflictResolutionDialog({
  conflict,
  onOpenChange,
  onResolve,
  onOpenAutoFocus,
  onCloseAutoFocus,
}) {
  const [decision, setDecision] = useState(
    conflict?.decisions?.find((entry) => entry.decision)?.decision ||
      "included",
  );
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const id = useId();
  if (!conflict) return null;
  const resolved = conflict.status === "resolved";
  const decisions = [
    ...new Set(
      (conflict.decisions || []).map((entry) => entry.decision).filter(Boolean),
    ),
  ];
  async function resolve(event) {
    event.preventDefault();
    if (!reason.trim() || pending || resolved) return;
    setPending(true);
    setError(null);
    try {
      await onResolve(conflict.id, { decision, reason: reason.trim() });
      onOpenChange(false);
    } catch (failure) {
      setError(failure.message || "Não foi possível resolver a discordância.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        showCloseButton={!pending}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>Discordância do artigo {conflict.articleId}</DialogTitle>
          <DialogDescription>
            {conflict.phase === "screening" ? "Triagem" : "Elegibilidade"} ·
            Compare as decisões concluídas e registre a justificativa da
            arbitragem.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-3">
          {(conflict.decisions || []).map((entry, index) => (
            <li
              key={entry.id || index}
              className="min-w-0 rounded-lg border p-3 text-sm"
            >
              <p className="font-medium">
                Revisor {entry.reviewerUserId}:{" "}
                {labels[entry.decision] || "Decisão registrada"}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words">
                {entry.reasonText}
              </p>
            </li>
          ))}
        </ul>
        {resolved ? (
          <div className="text-sm">
            <p className="font-medium">
              Decisão final: {labels[conflict.resolvedDecision]}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words">
              {conflict.resolutionReason}
            </p>
          </div>
        ) : (
          <form onSubmit={resolve} className="grid gap-4">
            <TeamSelect
              label="Decisão final"
              value={decision}
              onValueChange={setDecision}
              disabled={pending}
              options={decisions.map((value) => ({
                value,
                label: labels[value],
              }))}
            />
            <div className="grid gap-2">
              <label htmlFor={id} className="text-sm font-medium">
                Justificativa da arbitragem
              </label>
              <Textarea
                id={id}
                value={reason}
                maxLength={2000}
                disabled={pending}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  pending || !reason.trim() || !decisions.includes(decision)
                }
              >
                Resolver discordância
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
