import { describe, expect, it } from "vitest";
import {
  PLANNING_TABS,
  findFirstIncompleteSection,
  getPlanningSectionState,
} from "./planningSections";

const frameworkComponents = [
  { key: "population", required: true },
  { key: "intervention", required: true },
  { key: "context", required: false },
];

function completeData(overrides = {}) {
  return {
    picoc: { population: "Pessoas idosas", intervention: "Inclusão digital" },
    researchQuestions: ["Quais intervenções funcionam?"],
    searchStrings: ["older adults AND digital inclusion"],
    criteriosInclusao: ["População com 60 anos ou mais"],
    criteriosExclusao: [],
    eligibilityChecklist: ["População corresponde ao protocolo"],
    screeningGuidance: "Avaliar título e resumo conforme o protocolo.",
    dataExtractionSchema: [{ key: "population", label: "População" }],
    qualityAssessmentSchema: [{ key: "bias", label: "Risco de viés" }],
    ...overrides,
  };
}

describe("planning section metadata", () => {
  it("groups the seven planning sections into the approved tabs", () => {
    const state = getPlanningSectionState({
      data: completeData(),
      framework: "PICOC",
      frameworkComponents,
    });

    expect(PLANNING_TABS.map((tab) => tab.key)).toEqual(["foundation", "selection", "data"]);
    expect(state.sections.map(({ key, tab }) => [key, tab])).toEqual([
      ["framework", "foundation"],
      ["research-questions", "foundation"],
      ["search-strategy", "selection"],
      ["eligibility-criteria", "selection"],
      ["screening-guidance", "selection"],
      ["extraction-schema", "data"],
      ["quality-criteria", "data"],
    ]);
    expect(state.sections.every((section) => (
      section.label
      && section.description
      && Array.isArray(section.keywords)
      && typeof section.complete === "boolean"
      && typeof section.summary === "string"
    ))).toBe(true);
  });

  it("calculates completion and tab totals from the seven domain checks", () => {
    const state = getPlanningSectionState({
      data: completeData({ screeningGuidance: "" }),
      framework: "PICOC",
      frameworkComponents,
    });

    expect(state.completed).toBe(6);
    expect(state.total).toBe(7);
    expect(state.percent).toBe(86);
    expect(state.tabs).toEqual([
      { key: "foundation", label: "Fundação", completed: 2, total: 2 },
      { key: "selection", label: "Seleção", completed: 2, total: 3 },
      { key: "data", label: "Dados", completed: 2, total: 2 },
    ]);
  });

  it("returns stable empty summaries for sparse project data", () => {
    const state = getPlanningSectionState({
      data: {},
      framework: "PICOC",
      frameworkComponents,
    });

    expect(state.sections.map(({ summary }) => summary)).toEqual([
      "0 de 2 campos obrigatórios",
      "0 perguntas",
      "0 strings",
      "0 critérios · 0 itens no checklist",
      "Não iniciado",
      "0 campos",
      "0 critérios",
    ]);
    expect(state.completed).toBe(0);
    expect(state.percent).toBe(0);
  });

  it("finds the framework first when a required framework field is blank", () => {
    const state = getPlanningSectionState({
      data: completeData({
        picoc: { population: "Pessoas idosas", intervention: "" },
        researchQuestions: [],
      }),
      framework: "PICOC",
      frameworkComponents,
    });

    expect(findFirstIncompleteSection(state.sections)).toMatchObject({
      key: "framework",
      tab: "foundation",
      complete: false,
    });
  });

  it("falls back to the first section when every section is complete", () => {
    const state = getPlanningSectionState({
      data: completeData(),
      framework: "PICOC",
      frameworkComponents,
    });

    expect(findFirstIncompleteSection(state.sections)?.key).toBe("framework");
  });
});
