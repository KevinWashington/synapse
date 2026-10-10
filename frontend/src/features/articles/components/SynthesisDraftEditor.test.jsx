import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SynthesisDraftEditor from "./SynthesisDraftEditor";

const detail = { rqNumber: 1, question: "Quais são os efeitos?", questionFingerprint: "abc", draft: null, context: { freshness: "current" } };

describe("SynthesisDraftEditor", () => {
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
