import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SynthesisDraftEditor from "./SynthesisDraftEditor";

const detail = { rqNumber: 1, question: "Quais são os efeitos?", questionFingerprint: "abc", draft: null, context: { freshness: "current" } };

describe("SynthesisDraftEditor", () => {
  it("makes queued generation visible without claiming a percentage", () => {
    render(<SynthesisDraftEditor detail={detail} canEdit job={{ status: "queued", completedBatches: 0, totalBatches: 0 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Rascunho por IA na fila");
    expect(screen.getByRole("button", { name: "Aguardando na fila…" })).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: "Progresso da geração por IA" })).not.toHaveAttribute("aria-valuenow");
  });
  it("shows real batch progress and distinguishes consolidation from completion", () => {
    const view = render(<SynthesisDraftEditor detail={detail} canEdit job={{ status: "running", completedBatches: 2, totalBatches: 5 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("IA gerando o rascunho");
    expect(screen.getByText("2 de 5 lotes de evidências analisados")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByRole("button", { name: "Gerando rascunho…" })).toBeDisabled();
    view.rerender(<SynthesisDraftEditor detail={detail} canEdit job={{ status: "running", completedBatches: 5, totalBatches: 5 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Consolidando os achados");
    expect(screen.queryByText("Rascunho gerado")).not.toBeInTheDocument();
  });
  it.each([
    ["succeeded", "Rascunho gerado"],
    ["failed", "Não foi possível gerar o rascunho"],
    ["cancelled", "Geração cancelada"],
    ["conflict", "O rascunho precisa de revisão"],
  ])("presents the terminal state %s in Portuguese", (status, label) => {
    render(<SynthesisDraftEditor detail={detail} canEdit job={{ status }} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar rascunho por IA" })).toBeEnabled();
  });
  it("acknowledges the request immediately and reports a failed submission", async () => {
    let rejectRequest;
    const onGenerate = vi.fn(() => new Promise((_, reject) => { rejectRequest = reject; }));
    render(<SynthesisDraftEditor detail={detail} canEdit onGenerate={onGenerate} />);
    fireEvent.click(screen.getByRole("button", { name: "Gerar rascunho por IA" }));
    expect(screen.getByRole("button", { name: "Enviando solicitação…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Solicitando rascunho por IA");
    await act(async () => rejectRequest(new Error("Serviço indisponível")));
    expect(screen.getByRole("alert")).toHaveTextContent("Serviço indisponível");
    expect(screen.getByRole("button", { name: "Gerar rascunho por IA" })).toBeEnabled();
  });
  it("offers the first AI draft without a replacement confirmation", () => {
    const onGenerate = vi.fn();
    render(<SynthesisDraftEditor detail={detail} value={{ narrative: "", keyFindings: [], divergences: [], limitations: [] }} dirty={false} canEdit onChange={vi.fn()} onSave={vi.fn()} onGenerate={onGenerate} />);
    fireEvent.click(screen.getByRole("button", { name: "Gerar rascunho por IA" }));
    expect(onGenerate).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Confirmar substituição")).not.toBeInTheDocument();
  });
  it("requires confirmation before replacing saved content and preserves it until generation starts", () => {
    const onGenerate = vi.fn();
    const saved = { ...detail, draft: { version: 1, content: { narrative: "Texto existente", keyFindings: [], divergences: [], limitations: [] } } };
    render(<SynthesisDraftEditor detail={saved} value={saved.draft.content} dirty={false} canEdit onChange={vi.fn()} onSave={vi.fn()} onGenerate={onGenerate} />);
    expect(screen.getByDisplayValue("Texto existente")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gerar rascunho por IA" }));
    expect(onGenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar substituição" }));
    expect(onGenerate).toHaveBeenCalledWith(true);
  });
});
