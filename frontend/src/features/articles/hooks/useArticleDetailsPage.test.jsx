import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useArticleDetailsPage from "./useArticleDetailsPage";

const mocks = vi.hoisted(() => ({
  getArticleById: vi.fn(),
  getArticlesByProject: vi.fn(),
  getSelectionSummary: vi.fn(),
  getProjectById: vi.fn(),
  submitScreeningDecision: vi.fn(),
  updateArticleEvidence: vi.fn(),
  getMyAssignments: vi.fn(),
  updateArticleNotes: vi.fn(),
  getPdfData: vi.fn(),
}));

vi.mock("@features/articles/services/articleService", () => ({
  articleService: {
    getArticleById: mocks.getArticleById,
    getArticlesByProject: mocks.getArticlesByProject,
    getSelectionSummary: mocks.getSelectionSummary,
    getPdfData: mocks.getPdfData,
    submitScreeningDecision: mocks.submitScreeningDecision,
    updateArticleEvidence: mocks.updateArticleEvidence,
    updateArticleNotes: mocks.updateArticleNotes,
  },
}));

vi.mock("@features/collaboration/services/collaborationService", () => ({
  collaborationService: { getMyAssignments: mocks.getMyAssignments },
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
  it("keeps personal task navigation in the assigned-only queue", async () => {
    mocks.getArticleById.mockResolvedValue({ id: 11, hasPdf: false });
    mocks.getProjectById.mockResolvedValue({ id: 7 });
    mocks.getArticlesByProject.mockResolvedValue({ articles: [{ id: 11 }], total: 1 });
    mocks.getSelectionSummary.mockResolvedValue({});
    const { result } = renderHook(() => useArticleDetailsPage(), { wrapper: wrapperAt("/projetos/7/artigos/11?flow=screening&assignedToMe=1") });
    await waitFor(() => expect(result.current.articleListLoading).toBe(false));
    expect(mocks.getArticlesByProject).toHaveBeenCalledWith("7", expect.objectContaining({ assignedToMe: true, phase: "screening" }));
    act(() => result.current.navigate("/projetos/7/artigos/12?flow=screening&workspace=notas"));
    await waitFor(() => expect(result.current.articleId).toBe("12"));
    expect(result.current.assignedToMe).toBe(true);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getArticleById.mockResolvedValue({ id: 11, title: "Artigo", hasPdf: false });
    mocks.getArticlesByProject.mockResolvedValue({ articles: [], total: 0 });
    mocks.getSelectionSummary.mockResolvedValue({ included: 0, pendingExtraction: 0 });
    mocks.getProjectById.mockResolvedValue({ id: 7, title: "Projeto" });
  });

  it("ignores an older article response after navigation", async () => {
    let finishFirst;
    mocks.getArticleById.mockImplementation((_project, id) => id === "11"
      ? new Promise((resolve) => { finishFirst = resolve; })
      : Promise.resolve({ id: 12, title: "Novo estudo", hasPdf: false }));
    const { result } = renderHook(() => ({ ...useArticleDetailsPage(), go: useNavigate() }), {
      wrapper: wrapperAt("/projetos/7/artigos/11?flow=identification"),
    });
    act(() => result.current.go("/projetos/7/artigos/12?flow=identification"));
    await waitFor(() => expect(result.current.article?.id).toBe(12));
    await act(async () => finishFirst({ id: 11, title: "Resposta atrasada", hasPdf: false }));
    expect(result.current.article.id).toBe(12);
    expect(result.current.loading).toBe(false);
  });

  it("exposes a navigation failure instead of remaining stuck loading the previous article", async () => {
    mocks.getArticleById.mockResolvedValueOnce({ id: 11, hasPdf: false })
      .mockRejectedValueOnce(new Error("Falha ao carregar novo estudo"));
    const { result } = renderHook(() => ({ ...useArticleDetailsPage(), go: useNavigate() }), {
      wrapper: wrapperAt("/projetos/7/artigos/11?flow=identification"),
    });
    await waitFor(() => expect(result.current.article?.id).toBe(11));
    act(() => result.current.go("/projetos/7/artigos/12?flow=identification"));
    await waitFor(() => expect(result.current.error).toBe("Falha ao carregar novo estudo"));
    expect(result.current.loading).toBe(false);
  });

  it("never exposes the previous article's PDF while the new PDF is loading", async () => {
    const firstPdf = new ArrayBuffer(8);
    const secondPdf = new ArrayBuffer(16);
    let finishSecond;
    mocks.getArticleById.mockImplementation(async (_project, id) => ({ id: Number(id), title: `Estudo ${id}`, hasPdf: true }));
    mocks.getPdfData.mockResolvedValueOnce(firstPdf).mockImplementation(() => new Promise((resolve) => { finishSecond = resolve; }));
    const { result } = renderHook(() => ({ ...useArticleDetailsPage(), go: useNavigate() }), {
      wrapper: wrapperAt("/projetos/7/artigos/11?flow=eligibility"),
    });
    await waitFor(() => expect(result.current.pdfData).toBe(firstPdf));
    act(() => result.current.go("/projetos/7/artigos/12?flow=eligibility"));
    await waitFor(() => expect(result.current.article?.id).toBe(12));
    expect(result.current.pdfData).toBeNull();
    await act(async () => finishSecond(secondPdf));
    expect(result.current.pdfData).toBe(secondPdf);
  });

  it("propagates a failed note save so the editor cannot report success", async () => {
    mocks.updateArticleNotes.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useArticleDetailsPage(), {
      wrapper: wrapperAt("/projetos/7/artigos/11?flow=screening"),
    });
    await waitFor(() => expect(result.current.article?.id).toBe(11));
    await expect(result.current.handleSaveNotes("Rascunho")).rejects.toThrow("offline");
    expect(result.current.article.notas).toBeUndefined();
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

  it("reloads caller metadata, the article queue and inherited own assignments after a decision", async () => {
    const pending = { id: 11, currentPhase: "screening", hasPdf: false, hasActiveReviewAssignments: true,
      myReviewAssignment: { reviewerUserId: 1, status: "pending" }, reviewState: "waiting_for_reviewer" };
    const inherited = { ...pending, currentPhase: "eligibility", myReviewAssignment: { reviewerUserId: 1, phase: "eligibility", status: "pending" } };
    mocks.getArticleById.mockResolvedValueOnce(pending).mockResolvedValue(inherited);
    mocks.submitScreeningDecision.mockResolvedValue({ ...pending, reviewState: "consolidated" });
    mocks.getMyAssignments.mockResolvedValue([inherited.myReviewAssignment]);
    const { result } = renderHook(() => useArticleDetailsPage(), {
      wrapper: wrapperAt("/projetos/7/artigos/11?flow=screening"),
    });
    await waitFor(() => expect(result.current.article).toEqual(pending));
    const listCalls = mocks.getArticlesByProject.mock.calls.length;
    await act(async () => result.current.handleScreeningDecision({ decision: "included" }));
    expect(result.current.article).toEqual(inherited);
    expect(result.current.myAssignments).toEqual([inherited.myReviewAssignment]);
    expect(mocks.getMyAssignments).toHaveBeenCalledWith("7");
    expect(mocks.getArticlesByProject.mock.calls.length).toBeGreaterThan(listCalls);
  });

  it("preserves the server stage total when the loaded detail list is capped", async () => {
    mocks.getArticlesByProject.mockResolvedValue({
      articles: [{ id: 11, title: "Artigo" }],
      total: 1093,
    });

    const { result } = renderHook(() => useArticleDetailsPage(), {
      wrapper: wrapperAt("/projetos/7/artigos/11?flow=screening"),
    });

    await waitFor(() => expect(result.current.articleList).toHaveLength(1));
    expect(result.current.articleListTotal).toBe(1093);
  });

  it("refreshes the corpus extraction progress after completing evidence", async () => {
    const incomplete = { id: 11, title: "Artigo", hasPdf: false, extractionCompletedAt: null };
    const completed = { ...incomplete, extractionCompletedAt: "2026-10-08T12:00:00Z" };
    mocks.getArticleById.mockResolvedValue(incomplete);
    mocks.getArticlesByProject.mockResolvedValue({ articles: [incomplete], total: 10 });
    mocks.getSelectionSummary
      .mockResolvedValueOnce({ included: 10, pendingExtraction: 5 })
      .mockResolvedValueOnce({ included: 10, pendingExtraction: 4 });
    mocks.updateArticleEvidence.mockResolvedValue(completed);

    const { result } = renderHook(() => useArticleDetailsPage(), {
      wrapper: wrapperAt("/projetos/7/artigos/11?flow=included&workspace=extracao"),
    });
    await waitFor(() => expect(result.current.selectionSummary?.pendingExtraction).toBe(5));

    await act(async () => result.current.handleSaveEvidence({ markCompleted: true }));

    await waitFor(() => expect(result.current.selectionSummary?.pendingExtraction).toBe(4));
    expect(mocks.getSelectionSummary).toHaveBeenCalledTimes(2);
  });
});
