import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SynthesisWorkspacePanel from "./SynthesisWorkspacePanel";

const useWorkspace = vi.hoisted(() => vi.fn());
vi.mock("../hooks/useSynthesisWorkspace", () => ({ useSynthesisWorkspace: useWorkspace }));

const base = {
  setMode: vi.fn(),
  filters: {},
  selection: { rqNumber: 1, articleId: null, chartKey: "year", criterionKey: "overall" },
  actions: { refresh: vi.fn(), export: vi.fn(), selectRQ: vi.fn(), setFilter: vi.fn(), setPage: vi.fn(), save: vi.fn(), generate: vi.fn(), setDraft: vi.fn(), selectArticle: vi.fn(), selectChart: vi.fn(), selectCriterion: vi.fn(), discardDraft: vi.fn() },
  draft: { content: { narrative: "", keyFindings: [], divergences: [], limitations: [] }, dirty: false, conflict: null },
  pages: { rqs: 1, evidence: 1, matrix: 1, quality: 1 },
  resources: { overview: { data: { includedCount: 3, extractedCount: 2, coveredRQCount: 1, researchQuestionCount: 1, qualityAssessedCount: 2 } }, rqs: { data: { items: [{ rqNumber: 1, question: "Quais os resultados?", evidenceCount: 3, draftState: "not_started" }], total: 1 } }, detail: { data: { rqNumber: 1, question: "Quais os resultados?", questionFingerprint: "abc", draft: null, context: {} } }, evidence: { data: { items: [], total: 0 } }, matrix: { data: { items: [], total: 0, page: 1 } }, chartCatalog: { data: [{ key: "year", label: "Ano", type: "number" }] }, chart: { data: { field: { label: "Ano" }, rows: [], sampleSize: 0, missingCount: 0 } }, criteria: { data: [{ key: "overall", label: "Avaliação geral", total: 3 }] }, quality: { data: { items: [], total: 0, page: 1 } }, study: { data: null } },
};

describe("SynthesisWorkspacePanel", () => {
  beforeEach(() => useWorkspace.mockReset());
  it("keeps the four synthesis modes and presents the selected mode", () => {
    useWorkspace.mockReturnValue({ ...base, mode: "rqs" });
    const view = render(<SynthesisWorkspacePanel project={{ id: 2, dataExtractionSchema: [] }} canEdit onOpenArticle={vi.fn()} />);
    expect(screen.getByRole("navigation", { name: "Modos de síntese" })).toHaveTextContent("Perguntas de pesquisa");
    expect(screen.getByRole("navigation", { name: "Modos de síntese" })).toHaveTextContent("Matriz de extração");
    expect(screen.getAllByText("Quais os resultados?", { exact: false }).length).toBeGreaterThan(0);
    useWorkspace.mockReturnValue({ ...base, mode: "matrix" });
    view.rerender(<SynthesisWorkspacePanel project={{ id: 2, dataExtractionSchema: [] }} canEdit onOpenArticle={vi.fn()} />);
    expect(screen.getAllByText("Matriz de extração").length).toBeGreaterThan(0);
    useWorkspace.mockReturnValue({ ...base, mode: "visualizations" });
    view.rerender(<SynthesisWorkspacePanel project={{ id: 2, dataExtractionSchema: [] }} canEdit onOpenArticle={vi.fn()} />);
    expect(screen.getByText("Como ler")).toBeInTheDocument();
    useWorkspace.mockReturnValue({ ...base, mode: "quality" });
    view.rerender(<SynthesisWorkspacePanel project={{ id: 2, dataExtractionSchema: [] }} canEdit onOpenArticle={vi.fn()} />);
    expect(screen.getByText("Estudos avaliados")).toBeInTheDocument();
  });

  it("allows extraction fields to be hidden from the matrix without changing the article index", () => {
    useWorkspace.mockReturnValue({ ...base, mode: "matrix" });
    render(<SynthesisWorkspacePanel project={{ id: 2, dataExtractionSchema: [{ key: "outcome", label: "Desfecho" }, { key: "method", label: "Método" }] }} canEdit onOpenArticle={vi.fn()} />);
    fireEvent.click(screen.getByText("Campos exibidos (2/2)"));
    expect(screen.getAllByText("Método").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("Método"));
    expect(screen.queryByRole("columnheader", { name: "Método" })).not.toBeInTheDocument();
    expect(screen.getByText("Campos exibidos (1/2)")).toBeInTheDocument();
  });

  it("keeps the unsaved draft and navigation guard open when saving before continuing fails", async () => {
    const save = vi.fn().mockResolvedValue(null);
    const setMode = vi.fn();
    useWorkspace.mockReturnValue({
      ...base,
      mode: "rqs",
      setMode,
      actions: { ...base.actions, save },
      draft: { ...base.draft, dirty: true, content: { ...base.draft.content, narrative: "local unsaved finding" } },
    });
    render(<SynthesisWorkspacePanel project={{ id: 2, dataExtractionSchema: [] }} canEdit onOpenArticle={vi.fn()} />);

    fireEvent.click(screen.getByRole("navigation").querySelectorAll("button")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar e continuar" }));

    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(setMode).not.toHaveBeenCalled();
    expect(base.actions.discardDraft).not.toHaveBeenCalled();
  });
});
