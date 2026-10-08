import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InviteMemberDialog from "./InviteMemberDialog";

describe("invitation editor", () => {
  it("rejects malformed emails and sends a valid invitation", async () => {
    const onSave = vi.fn().mockResolvedValue({});
    const onOpenChange = vi.fn();
    render(
      <InviteMemberDialog open onOpenChange={onOpenChange} onSave={onSave} />,
    );
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "invalido" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Enviar convite" }).closest("form"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("e-mail válido");
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: " bia@example.com " },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Enviar convite" }).closest("form"),
    );
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        email: "bia@example.com",
        role: "reviewer",
        participatesInReview: true,
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("lets coordinators opt out of review and edits invitations without resending email", async () => {
    const onSave = vi.fn().mockResolvedValue({});
    render(
      <InviteMemberDialog
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        invitation={{
          emailNormalized: "bia@example.com",
          role: "coordinator",
          participatesInReview: false,
        }}
      />,
    );
    expect(screen.getByLabelText("Participa da revisão")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Participa da revisão"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        role: "coordinator",
        participatesInReview: true,
      }),
    );
  });
  it("preserves the form and reports a failed mutation", async () => {
    render(
      <InviteMemberDialog
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockRejectedValue(new Error("Convite indisponível"))}
      />,
    );
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "bia@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar convite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Convite indisponível",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
