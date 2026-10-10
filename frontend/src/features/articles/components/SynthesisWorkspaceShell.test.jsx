import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SynthesisWorkspaceShell from "./SynthesisWorkspaceShell";

describe("SynthesisWorkspaceShell", () => {
  it("keeps all three regions mounted and supports narrow-screen region switching", () => {
    render(<SynthesisWorkspaceShell index={<div>Índice mantido</div>} content={<div>Conteúdo mantido</div>} context={<div>Contexto mantido</div>} />);
    expect(screen.getByText("Índice mantido")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo mantido")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Lista" }));
    expect(screen.getByText("Contexto mantido")).toBeInTheDocument();
  });
});
