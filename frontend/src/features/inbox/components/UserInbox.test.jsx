import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserInbox from "./UserInbox";
import { inboxService } from "../services/inboxService";

const inbox = { unreadNotificationCount: 1, pendingInvitationCount: 1, notifications: [{ id: 8, projectId: 7, projectTitle: "Projeto A", type: "review_assigned", title: "Novo estudo", body: "Revise este estudo.", entityType: "article", entityId: 4, readAt: null }], invitations: [{ id: 3, projectId: 9, projectTitle: "Projeto B", inviterName: "Ana", role: "reviewer" }] };
beforeEach(() => {
  vi.spyOn(inboxService, "getInbox").mockResolvedValue(inbox);
  vi.spyOn(inboxService, "acceptInvitation").mockResolvedValue({ projectId: 9 });
  vi.spyOn(inboxService, "declineInvitation").mockResolvedValue({});
  vi.spyOn(inboxService, "markNotificationRead").mockResolvedValue({});
  vi.spyOn(inboxService, "markAllNotificationsRead").mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());
function renderInbox() { return render(<MemoryRouter><UserInbox /></MemoryRouter>); }

describe("UserInbox", () => {
  it("shows pending invitations and notifications from every project", async () => {
    renderInbox();
    await waitFor(() => expect(screen.getByRole("button", { name: /Central de notificações, 2 pendentes/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Central de notificações/ }));
    expect(await screen.findByText("Convites para projetos")).toBeInTheDocument();
    expect(screen.getByText("Projeto A")).toBeInTheDocument();
    expect(screen.getByText("Projeto B")).toBeInTheDocument();
  });
  it("accepts an invitation only when the recipient chooses to", async () => {
    renderInbox();
    await waitFor(() => expect(screen.getByRole("button", { name: /Central de notificações/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Central de notificações/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Aceitar" }));
    await waitFor(() => expect(inboxService.acceptInvitation).toHaveBeenCalledWith(3));
  });
});
