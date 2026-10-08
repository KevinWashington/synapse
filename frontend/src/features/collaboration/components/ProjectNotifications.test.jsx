import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectNotifications from "./ProjectNotifications";
import { collaboration } from "./testFixtures";

const notifications = [
  {
    id: 5,
    title: "Artigo atribuído",
    body: "Revise o artigo",
    entityType: "article",
    entityId: 9,
    readAt: null,
  },
  {
    id: 6,
    title: "Discordância",
    body: "Arbitre",
    entityType: "conflict",
    entityId: 8,
    readAt: null,
  },
];
describe("project notifications", () => {
  it("provides an accessible unread bell and mark-one/all actions", async () => {
    const state = collaboration({ notifications, unreadCount: 2 });
    render(
      <ProjectNotifications
        projectId={7}
        collaboration={state}
        onNavigate={vi.fn()}
      />,
    );
    const bell = screen.getByRole("button", {
      name: "Notificações do projeto, 2 não lidas",
    });
    bell.focus();
    fireEvent.click(bell);
    expect(
      screen.getByRole("dialog", { name: "Notificações do projeto" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Marcar Artigo atribuído como lida" }),
    );
    await waitFor(() =>
      expect(state.markNotificationRead).toHaveBeenCalledWith(5),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Marcar todas como lidas" }),
    );
    await waitFor(() =>
      expect(state.markAllNotificationsRead).toHaveBeenCalled(),
    );
  });
  it.each([
    ["article", 9, "/projetos/7/artigos/9"],
    ["conflict", 8, "/projetos/7?tab=equipe&conflict=8"],
    ["project", 7, "/projetos/7?tab=equipe"],
    ["https://evil.test", 7, "/projetos/7?tab=equipe"],
  ])("keeps %s navigation in the platform", (entityType, entityId, target) => {
    const navigate = vi.fn();
    render(
      <ProjectNotifications
        projectId={7}
        collaboration={collaboration({
          notifications: [
            {
              id: 5,
              title: "Evento",
              body: "Detalhes",
              readAt: "date",
              entityType,
              entityId,
            },
          ],
        })}
        onNavigate={navigate}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Notificações do projeto,/ }),
    );
    expect(screen.getByRole("link", { name: "Evento" })).toHaveAttribute(
      "href",
      target,
    );
    fireEvent.click(screen.getByRole("link", { name: "Evento" }));
    expect(navigate).toHaveBeenCalledWith(target);
  });
  it.each([
    [{ loading: true }, "Carregando notificações"],
    [{ error: "Erro de conexão" }, "Erro de conexão"],
    [{}, "Nenhuma notificação neste projeto."],
  ])("shows collection state", (overrides, text) => {
    render(
      <ProjectNotifications
        projectId={7}
        collaboration={collaboration(overrides)}
        onNavigate={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Notificações do projeto,/ }),
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
