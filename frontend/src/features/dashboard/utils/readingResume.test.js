import { beforeEach, expect, it, vi } from "vitest";
import { clearReadingResume, readReadingResume, saveReadingResume, readingUrl } from "./readingResume";
beforeEach(() => localStorage.clear());
const ref = { projectId: 7, articleId: 9, phase: "screening", workspace: "notas" };
it("stores only a per-user reference without content", () => {
  saveReadingResume(1, { ...ref, title: "Private" });
  expect(readReadingResume(2)).toBeNull();
  expect(readReadingResume(1)).toMatchObject(ref);
  expect(Object.keys(readReadingResume(1)).sort()).toEqual(["articleId", "phase", "projectId", "savedAt", "workspace"]);
  clearReadingResume(1);
  expect(readReadingResume(1)).toBeNull();
});
it("ignores corrupt or invalid storage", () => {
  for (const value of ["broken", "null", JSON.stringify({ ...ref, articleId: "../private" }), JSON.stringify({ ...ref, phase: "bad" })]) {
    localStorage.setItem("synapse:last-reading:v1:1", value);
    expect(readReadingResume(1)).toBeNull();
  }
});
it("tolerates disabled storage", () => {
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Disabled"); });
  expect(() => saveReadingResume(1, ref)).not.toThrow();
  spy.mockRestore();
});
it("navigates to current workflow", () => {
  expect(readingUrl({ id: 9, projectId: 7, currentPhase: "eligibility", reviewOutcome: "included" }, "chat")).toBe("/projetos/7/artigos/9?flow=included&workspace=extracao");
});
