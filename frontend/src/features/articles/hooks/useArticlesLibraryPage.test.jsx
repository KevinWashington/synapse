import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useArticlesLibraryPage from "./useArticlesLibraryPage";

const mocks = vi.hoisted(() => ({
  getAllProjects: vi.fn(),
  getArticlesByProject: vi.fn(),
}));

vi.mock("@features/projects/services/projectService", () => ({
  projectService: { getAllProjects: mocks.getAllProjects },
}));

vi.mock("@features/articles/services/articleService", () => ({
  articleService: { getArticlesByProject: mocks.getArticlesByProject },
}));

function deferred() {
  let resolve;
  const promise = new Promise((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe("useArticlesLibraryPage", () => {
  beforeEach(() => {
    mocks.getAllProjects.mockReset();
    mocks.getArticlesByProject.mockReset();
  });

  it("ignores a stale response after the user changes projects", async () => {
    const firstProjectRequest = deferred();
    const secondProjectRequest = deferred();
    mocks.getAllProjects.mockResolvedValue({
      projects: [
        { id: 1, title: "Projeto antigo" },
        { id: 2, title: "Projeto atual" },
      ],
    });
    mocks.getArticlesByProject.mockImplementation((projectId) => (
      String(projectId) === "1" ? firstProjectRequest.promise : secondProjectRequest.promise
    ));

    const { result } = renderHook(() => useArticlesLibraryPage());

    await waitFor(() => expect(mocks.getArticlesByProject).toHaveBeenCalledWith("1", {
      limit: 20,
      page: 1,
    }));

    act(() => result.current.setSelectedProjectId("2"));
    await waitFor(() => expect(mocks.getArticlesByProject).toHaveBeenCalledWith("2", {
      limit: 20,
      page: 1,
    }));

    await act(async () => {
      secondProjectRequest.resolve({ articles: [{ id: 20, title: "Artigo atual" }], total: 25 });
      await secondProjectRequest.promise;
    });
    await waitFor(() => expect(result.current.articleTotal).toBe(25));

    await act(async () => {
      firstProjectRequest.resolve({ articles: [{ id: 10, title: "Artigo antigo" }], total: 3 });
      await firstProjectRequest.promise;
    });

    expect(result.current.selectedProjectId).toBe("2");
    expect(result.current.articleTotal).toBe(25);
    expect(result.current.articles[0].title).toBe("Artigo atual");
  });
});
