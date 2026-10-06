import { describe, expect, it } from "vitest";
import {
  resolveSelectedArticle,
  toggleVisibleSelection,
} from "./reviewFlow";

describe("review flow state", () => {
  it("resolves the selected article from the latest server collection", () => {
    const refreshed = { id: 7, screeningDecision: "excluded" };

    expect(resolveSelectedArticle([refreshed], 7)).toBe(refreshed);
  });

  it("selects and clears all visible identification records", () => {
    expect(toggleVisibleSelection([1], [1, 2])).toEqual([1, 2]);
    expect(toggleVisibleSelection([1, 2, 9], [1, 2])).toEqual([9]);
  });
});

