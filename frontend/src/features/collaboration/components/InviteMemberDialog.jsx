import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import TeamSelect from "./TeamSelect";

export default function InviteMemberDialog({
  open,
  onOpenChange,
  onSave,
  invitation,
  member,
  onOpenAutoFocus,
  onCloseAutoFocus,
}) {
  const entry = invitation || member;
  // The caller mounts a fresh editor for each selected member/invitation.
  const [email, setEmail] = useState(
    entry?.emailNormalized || entry?.email || "",
  );
  const [role, setRole] = useState(entry?.role || "reviewer");
  const [participates, setParticipates] = useState(
    entry?.participatesInReview ?? true,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const id = useId();
  const editing = Boolean(entry);

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave({
        ...(!editing ? { email: email.trim() } : {}),
        role,
        participatesInReview: role === "reviewer" || participates,
      });
      onOpenChange(false);
    } catch (failure) {
      setError(failure.message || "Não foi possível salvar o convite.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        showCloseButton={!pending}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar participação" : "Convidar pessoa"}
          </DialogTitle>
          <DialogDescription>
            {member
              ? "Atualize o papel e a participação na revisão."
              : "O convite fica disponível dentro da plataforma para este e-mail."}
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid min-w-0 gap-4">
          <div className="grid gap-2">
            <label htmlFor={`${id}-email`} className="text-sm font-medium">
              E-mail
            </label>
            <Input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              value={email}
              disabled={editing || pending}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Papel</span>
            <TeamSelect
              label="Papel"
              value={role}
              disabled={pending}
              onValueChange={setRole}
              options={[
                { value: "reviewer", label: "Revisor" },
                { value: "coordinator", label: "Coordenador" },
              ]}
            />
          </div>
          {role === "coordinator" ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={participates}
                disabled={pending}
                onChange={(event) => setParticipates(event.target.checked)}
                className="h-4 w-4 accent-[#6259ff] focus-visible:ring-2"
              />
              Participa da revisão
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">
              Revisores sempre participam da revisão.
            </p>
          )}
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
            <Button type="submit" disabled={pending}>
              {pending
                ? "Salvando..."
                : editing
                  ? "Salvar alterações"
                  : "Enviar convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
