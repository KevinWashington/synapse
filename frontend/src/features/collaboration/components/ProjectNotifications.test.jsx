import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProjectNotifications from "./ProjectNotifications";
import { collaboration } from "./testFixtures";
import { apiService } from "@/services/api";
import { useProjectCollaboration } from "../hooks/useProjectCollaboration";

afterEach(() => vi.restoreAllMocks());

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
    type: "review_conflict",
    entityType: "article",
    entityId: 7,
    payload: { phase: "screening" },
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
  it.each([
    [
      [{ id: 8, articleId: 7, phase: "screening", status: "open" }],
      "/projetos/7?tab=equipe&conflict=8",
    ],
    [
      [
        { id: 9, articleId: 7, phase: "screening", status: "resolved" },
        { id: 10, articleId: 7, phase: "eligibility", status: "open" },
      ],
      "/projetos/7?tab=equipe",
    ],
    [[], "/projetos/7?tab=equipe"],
  ])(
    "routes a backend review_conflict article event to its open conflict or team fallback",
    (conflicts, target) => {
      const navigate = vi.fn();
      render(
        <ProjectNotifications
          projectId={7}
          collaboration={collaboration({
            notifications: [notifications[1]],
            conflicts,
          })}
          onNavigate={navigate}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: /Notificações do projeto,/ }),
      );
      expect(
        screen.getByRole("link", { name: "Discordância" }),
      ).toHaveAttribute("href", target);
      fireEvent.click(screen.getByRole("link", { name: "Discordância" }));
      expect(navigate).toHaveBeenCalledWith(target);
    },
  );
  it("recovers the real notification hook error and shows the empty state after retry", async () => {
    let failNotifications = true;
    vi.spyOn(apiService, "get").mockImplementation(async (url) => {
      if (url.endsWith("/members")) return { members: [], invitations: [] };
      if (failNotifications) throw new Error("Falha nas notificações");
      return [];
    });
    const project = { id: 7, capabilities: ["read_project"] };
    function Harness() {
      const state = useProjectCollaboration(project);
      return (
        <ProjectNotifications
          projectId={7}
          collaboration={state}
          onNavigate={vi.fn()}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: /Notificações do projeto,/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha nas notificações",
    );
    failNotifications = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByText("Nenhuma notificação neste projeto."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
