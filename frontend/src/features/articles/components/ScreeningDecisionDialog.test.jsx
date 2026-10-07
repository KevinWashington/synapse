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

  it("hides AI copy when there is no suggestion", () => {
    render(
      <ScreeningDecisionDialog
        article={{ id: 1, title: "Estudo" }}
        isOpen
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Usar justificativa da IA" })).not.toBeInTheDocument();
  });

  it("copies the AI suggestion for editing without submitting it", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ScreeningDecisionDialog
        article={{ id: 1, title: "Estudo", aiEvaluation: "População fora da PICO." }}
        initialDecision="excluded"
        isOpen
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Usar justificativa da IA" }));

    const field = screen.getByRole("textbox", { name: "Justificativa" });
    expect(field).toHaveValue("População fora da PICO.");
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: "População fora da PICO; revisado manualmente." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar decisao" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      decision: "excluded",
      reasonText: "População fora da PICO; revisado manualmente.",
    }));
  });
});
