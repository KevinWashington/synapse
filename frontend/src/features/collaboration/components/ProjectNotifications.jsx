import { useState } from "react";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";

function destination(projectId, notification, conflicts) {
  const base = `/projetos/${projectId}`;
  if (
    notification.type === "review_conflict" &&
    notification.entityType === "article"
  ) {
    const conflict = conflicts.find(
      (item) =>
        item.status === "open" &&
        item.articleId === notification.entityId &&
        item.phase === notification.payload?.phase,
    );
    return conflict
      ? `${base}?tab=equipe&conflict=${conflict.id}`
      : `${base}?tab=equipe`;
  }
  if (
    notification.entityType === "article" &&
    Number.isInteger(notification.entityId)
  )
    return `${base}/artigos/${notification.entityId}`;
  if (
    notification.entityType === "conflict" &&
    Number.isInteger(notification.entityId)
  )
    return `${base}?tab=equipe&conflict=${notification.entityId}`;
  return `${base}?tab=equipe`;
}

export default function ProjectNotifications({
  projectId,
  collaboration,
  onNavigate,
}) {
  const {
    notifications,
    conflicts,
    unreadCount,
    loading,
    error,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
  } = collaboration;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  async function run(action) {
    if (pending) return;
    setPending(true);
    setActionError(null);
    try {
      await action();
    } catch (failure) {
      setActionError(
        failure.message || "Não foi possível atualizar as notificações.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-10 gap-2"
          aria-label={`Notificações do projeto, ${unreadCount} não lidas`}
        >
          <BellIcon aria-hidden="true" className="h-4 w-4" />
          <span aria-hidden="true">{unreadCount}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notificações do projeto</DialogTitle>
          <DialogDescription>
            Atualizações da equipe e da revisão, dentro da plataforma.
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <p role="status" className="text-sm">
            Carregando notificações
          </p>
        )}
        {(actionError || error) && (
          <div className="grid gap-2">
            <p role="alert" className="text-sm text-destructive">
              {actionError || error}
            </p>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(refreshNotifications)}
            >
              Tentar novamente
            </Button>
          </div>
        )}
        {!loading && !error && notifications.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma notificação neste projeto.
          </p>
        )}
        {notifications.length > 0 && (
          <>
            <Button
              variant="outline"
              disabled={pending || !unreadCount}
              onClick={() => run(markAllNotificationsRead)}
            >
              Marcar todas como lidas
            </Button>
            <ul className="grid min-w-0 gap-3">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`min-w-0 rounded-lg border p-4 ${notification.readAt ? "" : "bg-muted/40"}`}
                >
                  <a
                    href={destination(projectId, notification, conflicts)}
                    className="block break-words font-medium text-[#6259ff] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]"
                    onClick={(event) => {
                      if (
                        event.button !== 0 ||
                        event.ctrlKey ||
                        event.metaKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      setOpen(false);
                      onNavigate(
                        destination(projectId, notification, conflicts),
                      );
                    }}
                  >
                    {notification.title}
                  </a>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {notification.body}
                  </p>
                  {!notification.readAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      className="mt-2"
                      aria-label={`Marcar ${notification.title} como lida`}
                      onClick={() =>
                        run(() => markNotificationRead(notification.id))
                      }
                    >
                      Marcar como lida
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
