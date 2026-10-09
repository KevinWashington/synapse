import { describe, expect, it } from "vitest";
import {
  getExtractionProgress,
  getQueueStatus,
  hasExtractionValue,
} from "./reviewWorkspace";

describe("hasExtractionValue", () => {
  it.each([
    [0, true],
    [false, true],
    ["  ", false],
    [[], false],
    [["resultado"], true],
    [null, false],
    [undefined, false],
  ])("classifies %j as %s", (value, expected) => {
    expect(hasExtractionValue(value)).toBe(expected);
  });
});

describe("getExtractionProgress", () => {
  const schema = [{ key: "sample" }, { key: "year" }, { key: "peerReviewed" }];

  it("reports extraction that has not started", () => {
    expect(getExtractionProgress({ extractionData: {} }, schema)).toEqual({
      completed: 0,
      total: 3,
      state: "not_started",
      label: "Não iniciada",
    });
  });

  it("counts meaningful falsy values as completed", () => {
    expect(getExtractionProgress({ extractionData: { year: 0, peerReviewed: false } }, schema)).toEqual({
      completed: 2,
      total: 3,
      state: "in_progress",
      label: "Em andamento 2/3",
    });
  });

  it("prioritizes the persisted completion marker", () => {
    expect(getExtractionProgress({ extractionData: {}, extractionCompletedAt: "2026-10-09T12:00:00Z" }, schema)).toEqual({
      completed: 0,
      total: 3,
      state: "completed",
      label: "Concluída",
    });
  });

  it("uses a useful label when there is data but no configured schema", () => {
    expect(getExtractionProgress({ extractionData: { notes: "extraído" } }, [])).toEqual({
      completed: 1,
      total: 0,
      state: "in_progress",
      label: "Em andamento",
    });
  });
});

describe("getQueueStatus", () => {
  it.each([
    [{ myReviewAssignment: { status: "pending" }, reviewState: "waiting_for_reviewer" }, "Minha vez"],
    [{ myReviewAssignment: { status: "submitted" }, reviewState: "waiting_for_reviewer" }, "Aguardando pares"],
    [{ myReviewAssignment: null, reviewState: "waiting_for_reviewer" }, "Em revisão"],
    [{ myReviewAssignment: { status: "submitted" }, reviewState: "conflict" }, "Discordância"],
    [{ myReviewAssignment: { status: "submitted" }, reviewState: "consolidated" }, "Consolidado"],
    [{ myReviewAssignment: { status: "needs_reassignment" }, reviewState: "waiting_for_reviewer" }, "Redistribuir"],
  ])("shortens collaborative state to %s", (reviewFields, label) => {
    const article = { hasActiveReviewAssignments: true, ...reviewFields };
    expect(getQueueStatus(article, "eligibility", new Set(), [])).toMatchObject({ label });
  });

  it("shows extraction state instead of the included outcome", () => {
    const article = {
      reviewOutcome: "included",
      extractionData: { sample: "120" },
      hasActiveReviewAssignments: true,
      reviewState: "consolidated",
    };
    expect(getQueueStatus(article, "included", new Set(), [{ key: "sample" }, { key: "result" }])).toMatchObject({
      label: "Em andamento 1/2",
    });
  });
});
