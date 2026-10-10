import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectPlanning from "./ProjectPlanning";
import PlanningArrayField from "./PlanningArrayField";

const mocks = vi.hoisted(() => ({
  hookState: {},
}));

vi.mock("@features/projects/hooks/useProjectPlanning", () => ({
  default: () => mocks.hookState,
}));

const project = {
  id: 7,
  framework: "PICOC",
  updatedAt: "2026-10-07T10:00:00Z",
  prismaStats: { identified: 10 },
};

function buildHookState(overrides = {}) {
  const noop = vi.fn();
  return {
    addExtractionField: noop,
    addArrayItem: noop,
    addQualityCriterion: noop,
    data: {
      title: "Revisão de saúde",
      objetivo: "Objetivo",
      picoc: { population: "Adultos" },
      researchQuestions: [],
      keywords: [],
      searchStrings: [],
      criteriosInclusao: [],
      criteriosExclusao: [],
      eligibilityChecklist: [],
      dataExtractionSchema: [],
      qualityAssessmentSchema: [],
      screeningGuidance: "",
      selectionReportNotes: "",
    },
    discardChanges: vi.fn(),
    framework: "PICOC",
    frameworkComponents: [
      {
        key: "population",
        labelPt: "População",
        placeholder: "Defina a população",
        required: true,
      },
    ],
    generateCriteria: noop,
    generateExtractionSchema: noop,
    generateQualityAssessmentSchema: noop,
    generateResearchQuestions: noop,
    generateSearchStrings: noop,
    handleSave: vi.fn().mockResolvedValue(undefined),
    isDirty: false,
    loadingMap: {
      save: false,
      researchQuestions: false,
      searchStrings: false,
      criteria: false,
      extractionSchema: false,
      qualityAssessmentSchema: false,
    },
    removeExtractionField: noop,
    removeArrayItem: noop,
    removeQualityCriterion: noop,
    setTargetDatabase: noop,
    targetDatabase: "scopus",
    updateExtractionField: noop,
    updateArrayItem: noop,
    updateComponent: noop,
    updateField: noop,
    updateQualityCriterion: noop,
    ...overrides,
  };
}

describe("ProjectPlanning", () => {
  beforeEach(() => {
    mocks.hookState = buildHookState();
  });

  it("shows a sticky unsaved changes bar only when dirty", () => {
    const onDirtyChange = vi.fn();
    const { rerender } = render(<ProjectPlanning project={project} onDirtyChange={onDirtyChange} />);

    expect(screen.queryByText("Alterações não salvas")).not.toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    mocks.hookState = buildHookState({ isDirty: true });
    rerender(<ProjectPlanning project={project} onDirtyChange={onDirtyChange} />);

    expect(screen.getByText("Alterações não salvas")).toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("keeps mobile clearance and stacks dirty actions without horizontal overflow", () => {
    mocks.hookState = buildHookState({ isDirty: true });
    const { container } = render(<ProjectPlanning project={project} />);

    expect(container.firstElementChild).toHaveClass("pb-24", "min-w-0");
    expect(screen.getByRole("button", { name: "Descartar" }).parentElement).toHaveClass("grid", "w-full", "grid-cols-2", "sm:flex");
  });

  it("discards local changes", () => {
    const discardChanges = vi.fn();
    mocks.hookState = buildHookState({ discardChanges, isDirty: true });
    render(<ProjectPlanning project={project} />);

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(discardChanges).toHaveBeenCalledOnce();
  });

  it("keeps the save action visible after a failed request", async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    mocks.hookState = buildHookState({ handleSave, isDirty: true });
    render(<ProjectPlanning project={project} />);

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(handleSave).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });

  it("organizes every planning section into compact tabs and independent accordions", () => {
    render(<ProjectPlanning project={project} />);

    expect(screen.getByRole("tab", { name: /Fundação/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /Perguntas de pesquisa/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /PICOC/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Resumo do planejamento")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar planejamento" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Seleção/ }));
    expect(screen.getByRole("tab", { name: /Seleção/ })).toHaveAttribute("aria-selected", "true");
    const criteria = screen.getByRole("button", { name: /Critérios de elegibilidade/ });
    const guidance = screen.getByRole("button", { name: /Guia para triagem/ });
    fireEvent.click(criteria);
    fireEvent.click(guidance);
    expect(criteria).toHaveAttribute("aria-expanded", "true");
    expect(guidance).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Buscar seção" }));
    const dialog = screen.getByRole("dialog", { name: "Buscar seção" });
    [
      "PICOC",
      "Perguntas de pesquisa",
      "Estratégia de busca",
      "Critérios de elegibilidade",
      "Guia para triagem",
      "Extração de dados",
      "Critérios de qualidade",
    ].forEach((label) => expect(within(dialog).getByRole("button", { name: new RegExp(label) })).toBeInTheDocument());
  });

  it("preserves a framework draft while moving between thematic tabs", () => {
    const state = buildHookState();
    state.updateComponent = vi.fn((key, value) => {
      state.data = { ...state.data, picoc: { ...state.data.picoc, [key]: value } };
      mocks.hookState = state;
    });
    mocks.hookState = state;
    const { rerender } = render(<ProjectPlanning project={project} />);

    fireEvent.click(screen.getByRole("button", { name: /PICOC/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "População" }), { target: { value: "Pessoas idosas" } });
    rerender(<ProjectPlanning project={project} />);
    fireEvent.click(screen.getByRole("tab", { name: /Seleção/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Fundação/ }));

    expect(screen.getByRole("textbox", { name: "População" })).toHaveValue("Pessoas idosas");
  });

  it("edits inclusion, exclusion, and checklist criteria inline", () => {
    render(<ProjectPlanning project={project} />);

    fireEvent.click(screen.getByRole("tab", { name: /Seleção/ }));
    fireEvent.click(screen.getByRole("button", { name: /Critérios de elegibilidade/ }));

    expect(screen.getByPlaceholderText("Novo critério de inclusão...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Novo critério de exclusão...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Novo item do checklist...")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Critérios de elegibilidade" })).not.toBeInTheDocument();
  });

  it("keeps edit actions visible for list fields", () => {
    render(
      <PlanningArrayField
        fieldKey="criteriosInclusao"
        items={["Critério 1"]}
        label="Critérios de inclusão"
        placeholder="Novo critério"
        onAddItem={vi.fn()}
        onRemoveItem={vi.fn()}
        onUpdateItem={vi.fn()}
      />
    );

    const editButton = screen.getByRole("button", { name: "Editar Critério 1" });
    expect(editButton.parentElement).not.toHaveClass("opacity-0");
  });
});
