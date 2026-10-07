import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScreeningDecisionDialog from "./ScreeningDecisionDialog";

describe("ScreeningDecisionDialog accessibility", () => {
  it("associates the justification label with its field", () => {
    render(
      <ScreeningDecisionDialog
        article={{ id: 1, title: "Estudo" }}
        isOpen
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("textbox", { name: "Justificativa" })).toBeInTheDocument();
  });

  it("keeps AI copy visible and disabled when there is no suggestion", () => {
    render(
      <ScreeningDecisionDialog
        article={{ id: 1, title: "Estudo" }}
        isOpen
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Copiar justificativa da IA" })).toBeDisabled();
    expect(screen.getByText("Execute a Triagem IA para gerar uma sugestão.")).toBeInTheDocument();
  });

  it("copies the AI suggestion for editing without submitting it", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ScreeningDecisionDialog
        article={{ id: 1, title: "Estudo", aiEvaluation: "  População fora da PICO.  " }}
        initialDecision="excluded"
        isOpen
        isSaving={false}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const copyButton = screen.getByRole("button", { name: "Copiar justificativa da IA" });
    expect(copyButton).toHaveClass("border");
    fireEvent.click(copyButton);

    const field = screen.getByRole("textbox", { name: "Justificativa" });
    expect(field).toHaveValue("População fora da PICO.");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();

    fireEvent.change(field, { target: { value: "População fora da PICO; revisado manualmente." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar decisão" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      decision: "excluded",
      reasonText: "População fora da PICO; revisado manualmente.",
    }));
  });
});
