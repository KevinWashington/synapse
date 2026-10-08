import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
}));

vi.mock("@features/articles/services/articleService", () => ({
  articleService: {
    getArticleById: mocks.getArticleById,
    getArticlesByProject: mocks.getArticlesByProject,
    getSelectionSummary: mocks.getSelectionSummary,
    getPdfData: vi.fn(),
    submitScreeningDecision: mocks.submitScreeningDecision,
    updateArticleEvidence: mocks.updateArticleEvidence,
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getArticleById.mockResolvedValue({ id: 11, title: "Artigo", hasPdf: false });
    mocks.getArticlesByProject.mockResolvedValue({ articles: [], total: 0 });
    mocks.getSelectionSummary.mockResolvedValue({ included: 0, pendingExtraction: 0 });
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
