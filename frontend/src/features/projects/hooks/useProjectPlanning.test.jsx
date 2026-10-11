import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useProjectPlanning from "./useProjectPlanning";

const mocks = vi.hoisted(() => ({
  updateProject: vi.fn(),
}));

vi.mock("@features/projects/services/projectService", () => ({
  projectService: {
    getFrameworks: vi.fn().mockResolvedValue([{ name: "PICOC", components: [{ key: "population", required: true }, { key: "intervention", required: true }, { key: "comparison", required: false }, { key: "outcome", required: true }, { key: "context", required: true }] }]),
    updateProject: mocks.updateProject,
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const project = {
  id: 7,
  title: "Revisão de saúde",
  objetivo: "Objetivo inicial",
  framework: "PICOC",
  picoc: { population: "Adultos", intervention: "Tecnologia" },
  researchQuestions: ["Qual é o efeito?"],
  keywords: [],
  searchStrings: [],
  criteriosInclusao: [],
  criteriosExclusao: [],
  eligibilityChecklist: [],
  dataExtractionSchema: [],
  qualityAssessmentSchema: [],
  screeningGuidance: "",
  selectionReportNotes: "",
  updatedAt: "2026-10-07T10:00:00Z",
};

describe("useProjectPlanning dirty state", () => {
  beforeEach(() => {
    mocks.updateProject.mockReset();
  });

  it("becomes dirty after a field change", () => {
    const { result } = renderHook(() => useProjectPlanning(project));

    expect(result.current.isDirty).toBe(false);
    act(() => result.current.updateField("objetivo", "Novo objetivo"));
    expect(result.current.isDirty).toBe(true);
  });

  it("stays clean for an equivalent project refresh", async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useProjectPlanning(value),
      { initialProps: { value: project } }
    );

    rerender({ value: { ...project, updatedAt: "2026-10-07T11:00:00Z" } });

    await waitFor(() => expect(result.current.isDirty).toBe(false));
  });

  it("clears dirty state after a successful save", async () => {
    const { result } = renderHook(() => useProjectPlanning(project));
    const updatedProject = { ...project, objetivo: "Novo objetivo", updatedAt: "2026-10-07T11:00:00Z" };
    mocks.updateProject.mockResolvedValue(updatedProject);

    act(() => result.current.updateField("objetivo", "Novo objetivo"));
    await waitFor(() => expect(result.current.catalogReady).toBe(true));
    await act(async () => result.current.handleSave());

    expect(result.current.data.objetivo).toBe("Novo objetivo");
    expect(result.current.isDirty).toBe(false);
  });

  it("keeps edits dirty after a failed save", async () => {
    const { result } = renderHook(() => useProjectPlanning(project));
    mocks.updateProject.mockRejectedValue(new Error("Falha de rede"));

    act(() => result.current.updateField("objetivo", "Objetivo não salvo"));
    await waitFor(() => expect(result.current.catalogReady).toBe(true));
    await act(async () => result.current.handleSave());

    expect(result.current.data.objetivo).toBe("Objetivo não salvo");
    expect(result.current.isDirty).toBe(true);
  });

  it("restores the last saved snapshot when discarded", () => {
    const { result } = renderHook(() => useProjectPlanning(project));

    act(() => result.current.updateField("objetivo", "Objetivo descartável"));
    act(() => result.current.discardChanges());

    expect(result.current.data.objetivo).toBe("Objetivo inicial");
    expect(result.current.isDirty).toBe(false);
  });

  it("keeps manual schema identifiers stable while their labels are edited", () => {
    const { result } = renderHook(() => useProjectPlanning(project));

    act(() => result.current.addExtractionField());
    act(() => result.current.addQualityCriterion());
    act(() => result.current.updateExtractionField(0, { label: "Desenho do estudo" }));
    act(() => result.current.updateQualityCriterion(0, "Risco de viés"));

    expect(result.current.data.dataExtractionSchema[0]).toMatchObject({
      key: "field",
      label: "Desenho do estudo",
    });
    expect(result.current.data.qualityAssessmentSchema[0]).toMatchObject({
      key: "criterion",
      label: "Risco de viés",
    });
  });
});

it("preserves an unknown project's framework and component values while disabling catalog actions", async () => {
  const value = { ...project, framework: "LEGACY", picoc: { custom: "Texto local" } };
  const { result } = renderHook(() => useProjectPlanning(value));
  await waitFor(() => expect(result.current.catalogError?.message).toContain("LEGACY"));
  expect(result.current.framework).toBe("LEGACY");
  expect(result.current.data.picoc).toEqual({ custom: "Texto local" });
  expect(result.current.catalogReady).toBe(false);
  await act(async () => result.current.handleSave());
  expect(mocks.updateProject).not.toHaveBeenCalled();
});
