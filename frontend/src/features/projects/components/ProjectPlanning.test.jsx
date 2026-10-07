import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
