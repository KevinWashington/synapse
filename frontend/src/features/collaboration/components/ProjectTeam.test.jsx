import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectTeam from "./ProjectTeam";
import { collaboration } from "./testFixtures";

describe("project team permissions and mutations", () => {
  it("switches connected team sections and falls back safely when access is revoked", () => {
    const state = collaboration();
    const view = render(<ProjectTeam collaboration={state} />);
    const navigation = screen.getByRole("navigation", { name: "Seções da equipe" });
    expect(screen.getByRole("table", { name: "Participantes do projeto" })).toBeVisible();
    fireEvent.click(within(navigation).getByRole("button", { name: /Convites/ }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar convite de bia@example.com" })).toBeVisible();
    fireEvent.click(within(navigation).getByRole("button", { name: /Distribuição/ }));
    expect(screen.getByRole("button", { name: "Pré-visualizar distribuição" })).toBeVisible();
    view.rerender(<ProjectTeam collaboration={{ ...state, capabilities: ["read_project"] }} />);
    expect(screen.getByRole("table", { name: "Participantes do projeto" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Pré-visualizar/ })).not.toBeInTheDocument();
  });
  it("shows reviewers the team without administrative controls or peer decisions", () => {
    render(
      <ProjectTeam
        collaboration={collaboration({
          capabilities: ["read_project", "review_assigned"],
          conflicts: [{ id: 8, decisions: [{ reason: "Secret" }] }],
        })}
      />,
    );
    expect(screen.getByText("Ana")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Convites/ }));
    expect(screen.getByText("bia@example.com")).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: /Convidar|Editar|Remover|Transferir|Cancelar convite|distribuição|discordância/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });
  it("offers coordinator controls but hides ownership transfer", () => {
    render(
      <ProjectTeam
        collaboration={collaboration({
          capabilities: [
            "manage_members",
            "manage_distribution",
            "resolve_conflicts",
          ],
        })}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Convidar pessoa" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Editar Bruno" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Transferir propriedade/ }),
    ).not.toBeInTheDocument();
  });
  it("confirms ownership transfer before mutation", async () => {
    const state = collaboration();
    render(<ProjectTeam collaboration={state} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Transferir propriedade para Bruno" }),
    );
    expect(state.transferOwnership).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Transferir propriedade",
      }),
    );
    await waitFor(() =>
      expect(state.transferOwnership).toHaveBeenCalledWith({ userId: 2 }),
    );
  });
  it("confirms member removal and invitation cancellation", async () => {
    const state = collaboration();
    render(<ProjectTeam collaboration={state} />);
    const removeButton = screen.getByRole("button", { name: "Remover Bruno" });
    expect(removeButton).toHaveClass("bg-destructive");
    fireEvent.click(removeButton);
    expect(state.removeMember).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Remover pessoa",
      }),
    );
    await waitFor(() => expect(state.removeMember).toHaveBeenCalledWith(4));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Convites/ }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Cancelar convite de bia@example.com",
      }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancelar convite",
      }),
    );
    await waitFor(() => expect(state.cancelInvitation).toHaveBeenCalledWith(3));
  });
  it("updates a member from the shared editor", async () => {
    const state = collaboration();
    render(<ProjectTeam collaboration={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Bruno" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(state.updateMember).toHaveBeenCalledWith(4, {
        role: "reviewer",
        participatesInReview: true,
      }),
    );
  });
  it("sends invitations and updates their participation", async () => {
    const state = collaboration();
    render(<ProjectTeam collaboration={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Convidar pessoa" }));
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "nova@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() =>
      expect(state.createInvitation).toHaveBeenCalledWith({
        email: "nova@example.com",
        role: "reviewer",
        participatesInReview: true,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Convites/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Editar convite de bia@example.com" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(state.updateInvitation).toHaveBeenCalledWith(3, {
        role: "reviewer",
        participatesInReview: true,
      }),
    );
  });
  it("closes administrative confirmations if the shared capability is revoked", () => {
    const state = collaboration();
    const { rerender } = render(<ProjectTeam collaboration={state} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Transferir propriedade para Bruno" }),
    );
    rerender(
      <ProjectTeam
        collaboration={{ ...state, capabilities: ["read_project"] }}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("opens a conflict destination and closes it through the caller", async () => {
    const state = collaboration({
      conflicts: [
        {
          id: 8,
          articleId: 7,
          phase: "screening",
          status: "open",
          decisions: [
            {
              id: 1,
              decision: "included",
              reasonText: "Pertinente",
              reviewerUserId: 1,
            },
          ],
        },
      ],
    });
    const onConflictClose = vi.fn();
    render(
      <ProjectTeam
        collaboration={state}
        conflictId="8"
        onConflictClose={onConflictClose}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "Discordância do artigo 7" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pertinente")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onConflictClose).toHaveBeenCalledOnce();
  });
  it.each([
    "Convidar pessoa",
    "Transferir propriedade para Bruno",
    "Inspecionar discordância do artigo 7",
  ])("returns keyboard focus to %s after Escape", async (name) => {
    render(
      <ProjectTeam
        collaboration={collaboration({
          conflicts: [
            {
              id: 8,
              articleId: 7,
              phase: "screening",
              status: "open",
              decisions: [
                {
                  id: 1,
                  decision: "included",
                  reasonText: "Pertinente",
                  reviewerUserId: 1,
                },
              ],
            },
          ],
        })}
      />,
    );
    if (name.startsWith("Inspecionar")) fireEvent.click(screen.getByRole("button", { name: /Discordâncias/ }));
    const trigger = screen.getByRole("button", { name });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
