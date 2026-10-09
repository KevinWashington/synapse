import { useCallback, useEffect, useState } from "react";
import { BellIcon, CheckIcon, XIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { inboxService } from "../services/inboxService";

const emptyInbox = { notifications: [], invitations: [], unreadNotificationCount: 0, pendingInvitationCount: 0 };

function destination(notification) {
  if (notification.type === "member_removed") return null;
  if (notification.entityType === "article" && Number.isInteger(notification.entityId)) return `/projetos/${notification.projectId}/artigos/${notification.entityId}`;
  if (notification.entityType === "conflict" && Number.isInteger(notification.entityId)) return `/projetos/${notification.projectId}?tab=equipe&conflict=${notification.entityId}`;
  return `/projetos/${notification.projectId}`;
}

export default function UserInbox() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState(emptyInbox);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    try { setError(null); setInbox({ ...emptyInbox, ...(await inboxService.getInbox()) }); }
    catch (failure) { setError(failure.message || "Não foi possível carregar sua central."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    refresh();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 30000);
    return () => window.clearInterval(poll);
  }, [refresh]);
  async function run(id, action) {
    if (pendingId) return;
    setPendingId(id);
    try { await action(); await refresh(); }
    catch (failure) { setError(failure.message || "Não foi possível concluir esta ação."); }
    finally { setPendingId(null); }
  }
  const total = inbox.unreadNotificationCount + inbox.pendingInvitationCount;
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) refresh(); }}>
    <DialogTrigger asChild><Button variant="outline" size="icon" aria-label={`Central de notificações, ${total} pendente${total === 1 ? "" : "s"}`} className="relative h-10 w-10 rounded-full border-[#edf0f7] bg-white text-[#182344] shadow-none hover:bg-[#f6f7fb]"><BellIcon className="h-4 w-4" />{total > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#6259ff] px-1 text-[10px] font-semibold leading-5 text-white">{total > 99 ? "99+" : total}</span> : null}</Button></DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Central de notificações</DialogTitle><DialogDescription>Convites e atualizações de todos os seus projetos.</DialogDescription></DialogHeader>
      {loading ? <p role="status" className="text-sm text-muted-foreground">Carregando atualizações…</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {!loading && !error && inbox.invitations.length === 0 && inbox.notifications.length === 0 ? <p className="text-sm text-muted-foreground">Você está em dia.</p> : null}
      {inbox.invitations.length > 0 ? <section className="grid gap-3"><h3 className="text-sm font-semibold text-[#182344]">Convites para projetos</h3><ul className="grid gap-2">{inbox.invitations.map((item) => <li key={item.id} className="rounded-lg border border-[#e4e8f1] p-3"><p className="font-medium text-[#182344]">{item.projectTitle}</p><p className="mt-1 text-sm text-[#56627f]">{item.inviterName || "Um membro"} convidou você como {item.role === "coordinator" ? "coordenador" : "revisor"}.</p><div className="mt-3 flex gap-2"><Button size="sm" disabled={pendingId === item.id} onClick={() => run(item.id, async () => { const accepted = await inboxService.acceptInvitation(item.id); setOpen(false); navigate(`/projetos/${accepted.projectId}`); })}><CheckIcon className="h-4 w-4" />Aceitar</Button><Button size="sm" variant="outline" disabled={pendingId === item.id} onClick={() => run(item.id, () => inboxService.declineInvitation(item.id))}><XIcon className="h-4 w-4" />Recusar</Button></div></li>)}</ul></section> : null}
      {inbox.notifications.length > 0 ? <section className="grid gap-3"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-[#182344]">Atualizações</h3><Button variant="ghost" size="sm" disabled={!inbox.unreadNotificationCount || Boolean(pendingId)} onClick={() => run("all", () => inboxService.markAllNotificationsRead())}>Marcar todas como lidas</Button></div><ul className="grid gap-2">{inbox.notifications.map((item) => { const target = destination(item); return <li key={item.id} className={`rounded-lg border p-3 ${item.readAt ? "border-[#e4e8f1]" : "border-[#d9d5ff] bg-[#f8f7ff]"}`}><p className="text-xs font-medium text-[#56627f]">{item.projectTitle}</p>{target ? <button type="button" className="mt-1 cursor-pointer text-left font-medium text-[#182344] hover:text-[#6259ff]" onClick={() => run(item.id, async () => { if (!item.readAt) await inboxService.markNotificationRead(item.id); setOpen(false); navigate(target); })}>{item.title}</button> : <p className="mt-1 font-medium text-[#182344]">{item.title}</p>}<p className="mt-1 text-sm text-[#56627f]">{item.body}</p>{!item.readAt ? <Button variant="ghost" size="sm" className="mt-2" disabled={Boolean(pendingId)} onClick={() => run(item.id, () => inboxService.markNotificationRead(item.id))}>Marcar como lida</Button> : null}</li>; })}</ul></section> : null}
    </DialogContent>
  </Dialog>;
}
