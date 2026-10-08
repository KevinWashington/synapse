import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@/services/api";
import { articleService } from "./articleService";

describe("articleService bulk identification flow", () => {
  beforeEach(() => {
    vi.spyOn(apiService, "post").mockResolvedValue({
      projectId: 7,
      movedCount: 1080,
      unresolvedDuplicateGroups: 6,
      unresolvedDuplicateRecords: 13,
    });
  });

  it("promotes all unique records through the server-side project endpoint", async () => {
    const response = await articleService.promoteAllUniqueToScreening(7);

    expect(apiService.post).toHaveBeenCalledWith(
      "/api/projetos/7/artigos/promote-unique-to-screening",
      {}
    );
    expect(response.movedCount).toBe(1080);
    expect(response.unresolvedDuplicateRecords).toBe(13);
  });
});

it("sends the assigned queue filter to the server with pagination", async () => {
  vi.spyOn(apiService, "get").mockResolvedValue({ articles: [], total: 41 });
  const result = await articleService.getArticlesByProject(7, {
    phase: "screening", assignedToMe: true, page: 2, limit: 20,
  });
  expect(apiService.get).toHaveBeenCalledWith("/api/projetos/7/artigos", {
    phase: "screening", assignedToMe: "true", page: 2, limit: 20,
  });
  expect(result.total).toBe(41);
});
