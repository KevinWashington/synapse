import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectArticles } from "./useProjectArticles";

const mocks = vi.hoisted(() => ({
  getArticlesByProject: vi.fn(),
  getDuplicateCandidates: vi.fn(),
  getSelectionReport: vi.fn(),
  getSelectionSummary: vi.fn(),
  promoteAllUniqueToScreening: vi.fn(),
  submitScreeningDecision: vi.fn(),
  batchEvaluateScreening: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@features/articles/services/articleService", () => ({
  articleService: {
    getArticlesByProject: mocks.getArticlesByProject,
    getDuplicateCandidates: mocks.getDuplicateCandidates,
    getSelectionReport: mocks.getSelectionReport,
    getSelectionSummary: mocks.getSelectionSummary,
    promoteAllUniqueToScreening: mocks.promoteAllUniqueToScreening,
    submitScreeningDecision: mocks.submitScreeningDecision,
    batchEvaluateScreening: mocks.batchEvaluateScreening,
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

  it("resets pagination and uses the server total when assigned filtering changes", async () => {
    mocks.getArticlesByProject.mockImplementation((_id, filters) => Promise.resolve({
      articles: [{ id: 11, currentPhase: "screening" }], total: filters.assignedToMe ? 41 : 120,
    }));
    const { result } = renderHook(() => useProjectArticles({ id: 7 }), {
      wrapper: wrapperAt("/projetos/7?tab=artigos&flow=screening"),
    });
    await waitFor(() => expect(result.current.articleTotal).toBe(120));
    act(() => result.current.changeArticlePage(3));
    await waitFor(() => expect(result.current.articlePage).toBe(3));
    act(() => result.current.setAssignedToMe(true));
    await waitFor(() => expect(result.current.articleTotal).toBe(41));
    expect(result.current.articlePage).toBe(1);
    expect(mocks.getArticlesByProject).toHaveBeenLastCalledWith(7, {
      phase: "screening", outcome: "active", search: undefined, page: 1, limit: 20, assignedToMe: true,
    });
  });

  it("refreshes collaboration assignments after screening creates eligibility work", async () => {
    const refreshAssignments = vi.fn().mockResolvedValue(undefined);
    mocks.submitScreeningDecision.mockResolvedValue({ reviewState: "consolidated", currentPhase: "eligibility" });
    const { result } = renderHook(() => useProjectArticles({ id: 7 }, undefined, { refreshAssignments }), {
      wrapper: wrapperAt("/projetos/7?tab=artigos&flow=screening"),
    });
    await waitFor(() => expect(result.current.isLoadingArticles).toBe(false));
    act(() => result.current.setScreeningArticle({ id: 11 }));
    await act(async () => result.current.submitScreeningDecision({ decision: "included" }));
    expect(refreshAssignments).toHaveBeenCalledOnce();
  });

  it("ignores a late unfiltered page after switching to assigned articles", async () => {
    let resolveUnfiltered;
    const oldPage = new Promise((resolve) => { resolveUnfiltered = resolve; });
    mocks.getArticlesByProject.mockImplementation((_id, filters) => filters.assignedToMe
      ? Promise.resolve({ articles: [{ id: 11, currentPhase: "screening" }], total: 41 }) : oldPage);
    const { result } = renderHook(() => useProjectArticles({ id: 7 }), {
      wrapper: wrapperAt("/projetos/7?tab=artigos&flow=screening"),
    });
    await waitFor(() => expect(mocks.getArticlesByProject).toHaveBeenCalledOnce());
    act(() => result.current.setAssignedToMe(true));
    await waitFor(() => expect(result.current.articleTotal).toBe(41));
    await act(async () => resolveUnfiltered({ articles: [{ id: 99, currentPhase: "screening" }], total: 120 }));
    expect(result.current.articleTotal).toBe(41);
    expect(result.current.articles.map((item) => item.id)).toEqual([11]);
  });

  it.each([
    ["batch", "phase"], ["batch", "assigned"], ["decision", "phase"], ["decision", "assigned"],
  ])("refreshes the current context when a deferred %s completes after a %s change", async (mutation, change) => {
    let complete;
    const pending = new Promise((resolve) => { complete = resolve; });
    mocks.batchEvaluateScreening.mockReturnValue(pending);
    mocks.submitScreeningDecision.mockReturnValue(pending);
    mocks.getArticlesByProject.mockImplementation((_id, filters) => Promise.resolve({
      articles: [{ id: filters.assignedToMe ? 22 : 11, currentPhase: filters.phase }], total: 100,
    }));
    const { result } = renderHook(() => useProjectArticles({ id: 7 }), {
      wrapper: wrapperAt("/projetos/7?tab=artigos&flow=screening"),
    });
    await waitFor(() => expect(result.current.articles).toHaveLength(1));
    act(() => result.current.setScreeningArticle({ id: 11 }));
    let finishing;
    act(() => { finishing = mutation === "batch" ? result.current.runBatchEvaluate()
      : result.current.submitScreeningDecision({ decision: "included" }); });
    act(() => {
      if (change === "phase") result.current.setActiveFlowTab("eligibility");
      else result.current.setAssignedToMe(true);
    });
    act(() => result.current.setSearchTerm("current search"));
    act(() => result.current.changeArticlePage(3));
    await waitFor(() => expect(result.current.articlePage).toBe(3));
    await act(async () => { complete({ summary: {} }); await finishing; });
    expect(mocks.getArticlesByProject).toHaveBeenLastCalledWith(7, {
      phase: change === "phase" ? "eligibility" : "screening", outcome: "active", search: "current search",
      page: 3, limit: 20, ...(change === "assigned" ? { assignedToMe: true } : {}),
    });
    expect(result.current.articles[0]).toEqual({ id: change === "assigned" ? 22 : 11,
      currentPhase: change === "phase" ? "eligibility" : "screening" });
  });

  it("clears the assigned filter when browser navigation changes the review phase", async () => {
    const { result } = renderHook(() => {
      const [, setParams] = useSearchParams();
      return { ...useProjectArticles({ id: 7 }), setParams };
    }, { wrapper: wrapperAt("/projetos/7?tab=artigos&flow=screening") });
    await waitFor(() => expect(result.current.isLoadingArticles).toBe(false));
    act(() => result.current.setAssignedToMe(true));
    act(() => result.current.setParams({ tab: "artigos", flow: "eligibility" }));
    await waitFor(() => expect(result.current.activeFlowTab).toBe("eligibility"));
    expect(result.current.assignedToMe).toBe(false);
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
