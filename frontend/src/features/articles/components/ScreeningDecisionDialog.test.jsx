import { render, screen } from "@testing-library/react";
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
});

