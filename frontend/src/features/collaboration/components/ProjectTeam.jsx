import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
  const [section, setSection] = useState("participants");
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
  const sections = [
    { key: "participants", label: "Participantes", count: members.length },
    { key: "invitations", label: "Convites", count: pendingInvitations.length },
    ...(capabilities.includes("manage_distribution") ? [{ key: "distribution", label: "Distribuição" }] : []),
    ...(canResolve ? [{ key: "conflicts", label: "Discordâncias", count: conflicts.filter((conflict) => conflict.status !== "resolved").length }] : []),
  ];
  const currentSection = sections.some((item) => item.key === section) ? section : "participants";
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
    <Card className="min-w-0 gap-0 overflow-hidden border-[#e2e6ef] bg-white py-0 text-[#111936] shadow-[0_10px_30px_rgba(18,27,54,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Equipe do projeto</h2>
          <p className="mt-1 text-sm text-[#667391]">
            Pessoas, convites e organização da revisão.
          </p>
        </div>
        {canManage && (
          <Button className="bg-[#6259ff] text-white hover:bg-[#554bea]" onClick={() => setEditor({})}>Convidar pessoa</Button>
        )}
      </div>
      <nav aria-label="Seções da equipe" className="grid min-w-0 grid-cols-2 border-y border-[#e7ebf4] bg-[#fbfcff] sm:flex">
        {sections.map((item) => <button key={item.key} type="button" aria-current={currentSection === item.key ? "page" : undefined} aria-controls={`team-section-${item.key}`} onClick={() => setSection(item.key)} className={`flex min-w-0 flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6259ff] sm:text-sm ${currentSection === item.key ? "border-[#6259ff] bg-white text-[#554bea]" : "border-transparent text-[#667391] hover:text-[#111936]"}`}>
          {item.label}{item.count != null && <span className={`rounded-full px-2 py-0.5 text-[10px] ${currentSection === item.key ? "bg-[#f1efff] text-[#554bea]" : "bg-[#edf0f7] text-[#667391]"}`}>{item.count}</span>}
        </button>)}
      </nav>
      <div className="min-h-[420px] min-w-0 max-h-[min(72vh,900px)] overflow-y-auto">
      {loading && (
        <p role="status" className="px-5 py-3 text-sm">
          Carregando equipe...
        </p>
      )}
      {(actionError || error) && (
        <p role="alert" className="px-5 py-3 text-sm text-destructive">
          {actionError || error}
        </p>
      )}
      <section id="team-section-participants" aria-label="Participantes" hidden={currentSection !== "participants"} className="min-w-0">
        <div className="border-b border-[#edf0f7] px-4 py-4 sm:px-5">
          <h3 className="text-sm font-semibold">Participantes ({members.length})</h3>
          <p className="mt-1 text-xs text-[#667391]">Gerencie os papéis e a participação de cada pessoa na revisão.</p>
        </div>
        <div className="min-w-0">
          <p className="px-4 py-3 text-xs text-muted-foreground md:hidden">
            Deslize a tabela para ver todos os participantes e ações.
          </p>
          <Table aria-label="Participantes do projeto" className="min-w-[720px] [&_td]:py-4 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5">
            <TableHeader className="bg-[#fbfcff]">
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Revisão</TableHead>
                {(canManage || canTransfer) && <TableHead className="text-right">Ações</TableHead>}
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
                      <div className="flex flex-wrap justify-end gap-2">
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
                                  variant="destructive"
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
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Nenhum participante disponível.
            </p>
          )}
        </div>
      </section>
      <section id="team-section-invitations" aria-label="Convites" hidden={currentSection !== "invitations"} className="min-w-0">
        <div className="border-b border-[#edf0f7] px-4 py-4 sm:px-5">
          <h3 className="text-sm font-semibold">
            Convites pendentes ({pendingInvitations.length})
          </h3>
          <p className="mt-1 text-xs text-[#667391]">Acompanhe os convites que ainda aguardam aceite.</p>
        </div>
        <div>
          <ul className="divide-y divide-[#edf0f7]">
            {pendingInvitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-5 py-4"
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
                      variant="destructive"
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
            <p className="px-5 py-8 text-sm text-[#667391]">
              Nenhum convite pendente.
            </p>
          )}
        </div>
      </section>
      {capabilities.includes("manage_distribution") && (
        <section id="team-section-distribution" aria-label="Distribuição" hidden={currentSection !== "distribution"}>
          <DistributionPanel collaboration={collaboration} embedded />
        </section>
      )}
      {canResolve && (
        <section id="team-section-conflicts" aria-label="Discordâncias" hidden={currentSection !== "conflicts"} className="min-w-0">
          <div className="border-b border-[#edf0f7] px-4 py-4 sm:px-5">
            <h3 className="text-sm font-semibold">Discordâncias</h3>
            <p className="mt-1 text-xs text-[#667391]">
              Decisões ficam disponíveis para arbitragem após todas as
              submissões.
            </p>
          </div>
          <div>
            <ul className="divide-y divide-[#edf0f7]">
              {conflicts.map((conflict) => (
                <li
                  key={conflict.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
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
              <p className="px-5 py-8 text-sm text-[#667391]">
                Nenhuma discordância neste projeto.
              </p>
            )}
          </div>
        </section>
      )}
      </div>
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
    </Card>
  );
}
