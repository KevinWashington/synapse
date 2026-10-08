import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import InviteMemberDialog from "./InviteMemberDialog";
import DistributionPanel from "./DistributionPanel";
import ConflictResolutionDialog from "./ConflictResolutionDialog";

const roles = {
  owner: "Proprietário",
  coordinator: "Coordenador",
  reviewer: "Revisor",
};

export default function ProjectTeam({
  collaboration,
  conflictId,
  onConflictClose = () => {},
}) {
  const { members, invitations, conflicts, capabilities, loading, error } =
    collaboration;
  const [editor, setEditor] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [activeConflict, setActiveConflict] = useState(null);
  const returnFocus = useRef(null);
  const dialogFocus = {
    onOpenAutoFocus: () => {
      returnFocus.current = document.activeElement;
    },
    onCloseAutoFocus: (event) => {
      event.preventDefault();
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    },
  };
  const canManage = capabilities.includes("manage_members");
  const canTransfer = capabilities.includes("transfer_ownership");
  const canResolve = capabilities.includes("resolve_conflicts");
  const selectedConflict =
    canResolve &&
    conflicts.find(
      (conflict) =>
        String(conflict.id) === String(activeConflict ?? conflictId),
    );
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === "pending",
  );
  const canConfirm =
    confirmation && capabilities.includes(confirmation.capability);

  async function confirm() {
    if (!canConfirm || pending) return;
    setPending(true);
    setActionError(null);
    try {
      await confirmation.action();
      setConfirmation(null);
    } catch (failure) {
      setActionError(failure.message || "Não foi possível atualizar a equipe.");
      setConfirmation(null);
    } finally {
      setPending(false);
    }
  }
  function save(data) {
    if (editor.member)
      return collaboration.updateMember(editor.member.id, data);
    if (editor.invitation)
      return collaboration.updateInvitation(editor.invitation.id, data);
    return collaboration.createInvitation(data);
  }
  return (
    <div className="grid min-w-0 gap-5 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Equipe do projeto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pessoas, convites e organização da revisão.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setEditor({})}>Convidar pessoa</Button>
        )}
      </div>
      {loading && (
        <p role="status" className="text-sm">
          Carregando equipe...
        </p>
      )}
      {(actionError || error) && (
        <p role="alert" className="text-sm text-destructive">
          {actionError || error}
        </p>
      )}
      <Card className="min-w-0 shadow-none">
        <CardHeader>
          <h3 className="font-semibold">Participantes ({members.length})</h3>
        </CardHeader>
        <CardContent className="min-w-0">
          <p className="mb-3 text-xs text-muted-foreground md:hidden">
            Deslize a tabela para ver todos os participantes e ações.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Revisão</TableHead>
                {(canManage || canTransfer) && <TableHead>Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell className="min-w-40 whitespace-normal">
                    <p className="font-medium">{member.name || member.email}</p>
                    <p className="max-w-56 break-all text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={member.role === "owner" ? "blue" : "neutral"}
                      label={roles[member.role]}
                    />
                  </TableCell>
                  <TableCell>
                    {member.participatesInReview
                      ? "Participa"
                      : "Não participa"}
                  </TableCell>
                  {(canManage || canTransfer) && (
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {member.role !== "owner" && (
                          <>
                            {canManage && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Editar ${member.name || member.email}`}
                                  onClick={() => setEditor({ member })}
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  aria-label={`Remover ${member.name || member.email}`}
                                  onClick={() =>
                                    setConfirmation({
                                      capability: "manage_members",
                                      title: "Remover pessoa?",
                                      description: `Remover ${member.name || member.email} da equipe? Revisões pendentes precisarão de reatribuição.`,
                                      label: "Remover pessoa",
                                      destructive: true,
                                      action: () =>
                                        collaboration.removeMember(member.id),
                                    })
                                  }
                                >
                                  Remover
                                </Button>
                              </>
                            )}
                            {canTransfer && (
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={`Transferir propriedade para ${member.name || member.email}`}
                                onClick={() =>
                                  setConfirmation({
                                    capability: "transfer_ownership",
                                    title: "Transferir propriedade?",
                                    description: `${member.name || member.email} será o novo proprietário. Você passará a coordenador e perderá os controles exclusivos de propriedade.`,
                                    label: "Transferir propriedade",
                                    action: () =>
                                      collaboration.transferOwnership({
                                        userId: member.userId,
                                      }),
                                  })
                                }
                              >
                                Transferir propriedade
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!loading && members.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">
              Nenhum participante disponível.
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="min-w-0 shadow-none">
        <CardHeader>
          <h3 className="font-semibold">
            Convites pendentes ({pendingInvitations.length})
          </h3>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3">
            {pendingInvitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium">
                    {invitation.emailNormalized}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {roles[invitation.role]} ·{" "}
                    {invitation.participatesInReview
                      ? "Participa da revisão"
                      : "Não participa da revisão"}
                  </p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Editar convite de ${invitation.emailNormalized}`}
                      onClick={() => setEditor({ invitation })}
                    >
                      Editar convite
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Cancelar convite de ${invitation.emailNormalized}`}
                      onClick={() =>
                        setConfirmation({
                          capability: "manage_members",
                          title: "Cancelar convite?",
                          description: `Cancelar o convite para ${invitation.emailNormalized}?`,
                          label: "Cancelar convite",
                          destructive: true,
                          action: () =>
                            collaboration.cancelInvitation(invitation.id),
                        })
                      }
                    >
                      Cancelar convite
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!pendingInvitations.length && (
            <p className="text-sm text-muted-foreground">
              Nenhum convite pendente.
            </p>
          )}
        </CardContent>
      </Card>
      {capabilities.includes("manage_distribution") && (
        <DistributionPanel collaboration={collaboration} />
      )}
      {canResolve && (
        <Card className="min-w-0 shadow-none">
          <CardHeader>
            <h3 className="font-semibold">Discordâncias</h3>
            <p className="text-sm text-muted-foreground">
              Decisões ficam disponíveis para arbitragem após todas as
              submissões.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {conflicts.map((conflict) => (
                <li
                  key={conflict.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      Artigo {conflict.articleId} ·{" "}
                      {conflict.phase === "screening"
                        ? "Triagem"
                        : "Elegibilidade"}
                    </p>
                    <StatusBadge
                      variant={
                        conflict.status === "resolved" ? "low" : "medium"
                      }
                      label={
                        conflict.status === "resolved"
                          ? "Resolvida"
                          : "Aguardando arbitragem"
                      }
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Inspecionar discordância do artigo ${conflict.articleId}`}
                    onClick={() => setActiveConflict(conflict.id)}
                  >
                    Inspecionar discordância
                  </Button>
                </li>
              ))}
            </ul>
            {!conflicts.length && (
              <p className="text-sm text-muted-foreground">
                Nenhuma discordância neste projeto.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {editor && canManage && (
        <InviteMemberDialog
          {...dialogFocus}
          open
          invitation={editor.invitation}
          member={editor.member}
          onSave={save}
          onOpenChange={(open) => !open && setEditor(null)}
        />
      )}
      <ConfirmationDialog
        {...dialogFocus}
        open={Boolean(canConfirm)}
        title={confirmation?.title}
        description={confirmation?.description}
        confirmLabel={confirmation?.label}
        tone={confirmation?.destructive ? "destructive" : "default"}
        isPending={pending}
        onConfirm={confirm}
        onOpenChange={(open) => !open && setConfirmation(null)}
      />
      {selectedConflict && (
        <ConflictResolutionDialog
          {...dialogFocus}
          key={selectedConflict.id}
          conflict={selectedConflict}
          onResolve={collaboration.resolveConflict}
          onOpenChange={(open) => {
            if (!open) {
              setActiveConflict(null);
              onConflictClose();
            }
          }}
        />
      )}
    </div>
  );
}
