import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectArticles } from "./useProjectArticles";

const mocks = vi.hoisted(() => ({
  getArticlesByProject: vi.fn(),
  getDuplicateCandidates: vi.fn(),
  getSelectionReport: vi.fn(),
  getSelectionSummary: vi.fn(),
  promoteAllUniqueToScreening: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@features/articles/services/articleService", () => ({
  articleService: {
    getArticlesByProject: mocks.getArticlesByProject,
    getDuplicateCandidates: mocks.getDuplicateCandidates,
    getSelectionReport: mocks.getSelectionReport,
    getSelectionSummary: mocks.getSelectionSummary,
    promoteAllUniqueToScreening: mocks.promoteAllUniqueToScreening,
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: mocks.toastError, success: vi.fn(), warning: vi.fn() },
}));

function wrapperAt(entry) {
  return function Wrapper({ children }) {
    return <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>;
  };
}

describe("useProjectArticles work queues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getArticlesByProject.mockResolvedValue({ articles: [], total: 0 });
    mocks.getDuplicateCandidates.mockResolvedValue([]);
    mocks.getSelectionReport.mockResolvedValue({});
    mocks.getSelectionSummary.mockResolvedValue({});
    mocks.promoteAllUniqueToScreening.mockResolvedValue({ movedCount: 0 });
  });

  it.each(["screening", "eligibility"])(
    "requests only active %s articles with server pagination",
    async (flow) => {
      renderHook(() => useProjectArticles({ id: 7 }), {
        wrapper: wrapperAt(`/projetos/7?tab=artigos&flow=${flow}`),
      });

      await waitFor(() => {
        expect(mocks.getArticlesByProject).toHaveBeenCalledWith(7, {
          phase: flow,
          outcome: "active",
          search: undefined,
          page: 1,
          limit: 20,
        });
      });
    }
  );

  it("moves back to the last valid page when a decision empties the current page", async () => {
    mocks.getArticlesByProject.mockImplementation((_projectId, filters) => {
      if (filters.page === 3) return Promise.resolve({ articles: [], total: 21 });
      if (filters.page === 2) {
        return Promise.resolve({
          articles: [{ id: 21, title: "Último artigo", currentPhase: "screening" }],
          total: 21,
        });
      }
      return Promise.resolve({
        articles: Array.from({ length: 20 }, (_, index) => ({
          id: index + 1,
          title: `Artigo ${index + 1}`,
          currentPhase: "screening",
        })),
        total: 41,
      });
    });

    const { result } = renderHook(() => useProjectArticles({ id: 7 }), {
      wrapper: wrapperAt("/projetos/7?tab=artigos&flow=screening"),
    });

    await waitFor(() => expect(result.current.articlePage).toBe(1));
    act(() => result.current.changeArticlePage(3));

    await waitFor(() => {
      expect(result.current.articlePage).toBe(2);
      expect(result.current.articles).toHaveLength(1);
      expect(result.current.articles[0].title).toBe("Último artigo");
    });
  });

  it("keeps the identification queue and reports an unavailable server on connection failure", async () => {
    const visibleArticle = { id: 1, title: "Artigo preservado", currentPhase: "identification" };
    mocks.getArticlesByProject.mockResolvedValue({ articles: [visibleArticle], total: 1 });
    mocks.promoteAllUniqueToScreening.mockRejectedValue({
      status: 0,
      message: "Failed to fetch",
    });

    const { result } = renderHook(() => useProjectArticles({ id: 7 }), {
      wrapper: wrapperAt("/projetos/7?tab=artigos&flow=identification"),
    });

    await waitFor(() => expect(result.current.articles).toEqual([visibleArticle]));
    await act(async () => result.current.promoteAllUniqueToScreening());

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Servidor indisponível. Verifique se o backend está em execução e tente novamente."
    );
    expect(result.current.articles).toEqual([visibleArticle]);
  });

  it("preserves the backend message for non-connection promotion errors", async () => {
    mocks.promoteAllUniqueToScreening.mockRejectedValue({
      status: 500,
      message: "Falha no banco",
    });

    const { result } = renderHook(() => useProjectArticles({ id: 7 }), {
      wrapper: wrapperAt("/projetos/7?tab=artigos&flow=identification"),
    });

    await waitFor(() => expect(result.current.isLoadingArticles).toBe(false));
    await act(async () => result.current.promoteAllUniqueToScreening());

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Erro ao enviar registros únicos para triagem: Falha no banco"
    );
  });
});
