import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useArticleDetailsPage from "./useArticleDetailsPage";

const mocks = vi.hoisted(() => ({
  getArticleById: vi.fn(),
  getArticlesByProject: vi.fn(),
  getProjectById: vi.fn(),
}));

vi.mock("@features/articles/services/articleService", () => ({
  articleService: {
    getArticleById: mocks.getArticleById,
    getArticlesByProject: mocks.getArticlesByProject,
    getPdfData: vi.fn(),
  },
}));

vi.mock("@features/projects/services/projectService", () => ({
  projectService: { getProjectById: mocks.getProjectById },
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function wrapperAt(entry) {
  return function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/projetos/:projectId/artigos/:articleId" element={children} />
        </Routes>
      </MemoryRouter>
    );
  };
}

describe("useArticleDetailsPage stage queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getArticleById.mockResolvedValue({ id: 11, title: "Artigo", hasPdf: false });
    mocks.getArticlesByProject.mockResolvedValue({ articles: [], total: 0 });
    mocks.getProjectById.mockResolvedValue({ id: 7, title: "Projeto" });
  });

  it.each(["screening", "eligibility"])(
    "loads only active records in the %s detail queue",
    async (flow) => {
      renderHook(() => useArticleDetailsPage(), {
        wrapper: wrapperAt(`/projetos/7/artigos/11?flow=${flow}`),
      });

      await waitFor(() => {
        expect(mocks.getArticlesByProject).toHaveBeenCalledWith("7", {
          limit: 1000,
          phase: flow,
          outcome: "active",
        });
      });
    }
  );
});
