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
  it("presents matrix metadata in Portuguese and extraction values as labeled fields instead of JSON", () => {
    const study = { articleId: 1, title: "Original English title", year: 2026, sourceName: "Web of Science", qualityRating: "medium", qualityScore: 50, extractionValues: { finding: "Original English finding", confirmed: false, groups: ["Idosos", "Adultos"], empty: null } };
    useWorkspace.mockReturnValue({ ...base, mode: "matrix", resources: { ...base.resources, matrix: { data: { items: [study], total: 1 } }, study: { data: study } } });
    const { container } = render(<SynthesisWorkspacePanel project={{ id: 2, dataExtractionSchema: [{ key: "finding", label: "Achado" }, { key: "confirmed", label: "Confirmado" }, { key: "groups", label: "Grupos" }, { key: "empty", label: "Observações" }] }} />);
    expect(screen.getByRole("columnheader", { name: "Fonte" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Avaliação" })).toBeInTheDocument();
    expect(screen.queryByText("medium")).not.toBeInTheDocument();
    expect(container.querySelector("pre")).toBeNull();
    const details = screen.getByText("Achado", { selector: "dt", exact: true }).closest("dl");
    expect(details).toHaveTextContent("AchadoOriginal English finding");
    expect(details).toHaveTextContent("ConfirmadoNão");
    expect(details).toHaveTextContent("GruposIdosos, Adultos");
    expect(details).toHaveTextContent("ObservaçõesNão preenchido");
  });

  it("presents quality answers using planning labels and Portuguese response names", () => {
    useWorkspace.mockReturnValue({ ...base, mode: "quality", resources: { ...base.resources, study: { data: { articleId: 1, title: "Study", qualityRating: "unrated", qualityScore: null, qualityAnswers: { clear: "yes", bias: "partial", suitable: "no", other: "na" } } } } });
    const { container } = render(<SynthesisWorkspacePanel project={{ id: 2, qualityAssessmentSchema: [{ key: "clear", label: "Objetivo claro" }, { key: "bias", label: "Risco de viés" }, { key: "suitable", label: "Método adequado" }, { key: "other", label: "Outro critério" }] }} />);
    expect(container.querySelector("pre")).toBeNull();
    const details = screen.getByText("Objetivo claro", { exact: true }).closest("dl");
    expect(details).toHaveTextContent("Objetivo claroSim");
    expect(details).toHaveTextContent("Risco de viésParcial");
    expect(details).toHaveTextContent("Método adequadoNão");
    expect(details).toHaveTextContent("Outro critérioNão se aplica");
    expect(screen.queryByText(/unrated|—%/)).not.toBeInTheDocument();
  });
  it("selects a matrix study without navigating and opens extraction only through its explicit action", () => {
    const selectArticle = vi.fn();
    const onOpenArticle = vi.fn();
    const study = { articleId: 42, title: "Estudo selecionável", year: 2026, extractionValues: { outcome: "Resultado extraído" }, qualityAnswers: {} };
    const workspace = { ...base, mode: "matrix", actions: { ...base.actions, selectArticle }, resources: { ...base.resources, matrix: { data: { items: [study], total: 1, page: 1 } } } };
    useWorkspace.mockReturnValue(workspace);
    const view = render(<SynthesisWorkspacePanel project={{ id: 2 }} onOpenArticle={onOpenArticle} />);

    fireEvent.click(screen.getByRole("button", { name: study.title }));
    expect(selectArticle).toHaveBeenCalledWith(42);
    expect(onOpenArticle).not.toHaveBeenCalled();

    useWorkspace.mockReturnValue({ ...workspace, selection: { ...base.selection, articleId: 42 }, resources: { ...workspace.resources, study: { data: study } } });
    view.rerender(<SynthesisWorkspacePanel project={{ id: 2 }} onOpenArticle={onOpenArticle} />);
    expect(screen.getByRole("button", { name: study.title })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Resultado extraído/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir na extração" }));
    expect(onOpenArticle).toHaveBeenCalledWith(42);
  });
  it("reports a failed request instead of claiming the project has no questions", () => {
    const refresh = vi.fn();
    useWorkspace.mockReturnValue({
      ...base, mode: "rqs", actions: { ...base.actions, refresh },
      resources: { ...base.resources, rqs: { data: null, loading: false, error: new Error("API unavailable") } },
    });
    render(<SynthesisWorkspacePanel project={{ id: 2 }} canEdit />);
    expect(screen.getByRole("alert")).toHaveTextContent("carregar os dados");
    expect(screen.queryByText(/Cadastre perguntas/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
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
