import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfirmationDialog from "./ConfirmationDialog";

function renderDialog(overrides = {}) {
  const props = {
    open: true,
    title: "Concluir extração?",
    description: "O estudo será contabilizado como extraído.",
    confirmLabel: "Marcar como concluído",
    cancelLabel: "Cancelar",
    onConfirm: vi.fn(),
    onOpenChange: vi.fn(),
    ...overrides,
  };
  render(<ConfirmationDialog {...props} />);
  return props;
}

describe("ConfirmationDialog", () => {
  it("exposes an accessible title and description", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Concluir extração?" })).toBeInTheDocument();
    expect(screen.getByText("O estudo será contabilizado como extraído.")).toBeInTheDocument();
  });

  it("cancels without confirming", () => {
    const props = renderDialog();

    screen.getByRole("button", { name: "Cancelar" }).click();

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("confirms exactly once", () => {
    const props = renderDialog();

    screen.getByRole("button", { name: "Marcar como concluído" }).click();

    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it("disables both actions while pending", () => {
    renderDialog({ isPending: true });

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Marcar como concluído" })).toBeDisabled();
  });
});
