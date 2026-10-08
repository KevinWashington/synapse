import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useArticleDetailsPage from "./useArticleDetailsPage";

const mocks = vi.hoisted(() => ({
  getArticleById: vi.fn(),
  getArticlesByProject: vi.fn(),
  getProjectById: vi.fn(),
  submitScreeningDecision: vi.fn(),
  getMyAssignments: vi.fn(),
}));

vi.mock("@features/articles/services/articleService", () => ({
  articleService: {
    getArticleById: mocks.getArticleById,
    getArticlesByProject: mocks.getArticlesByProject,
    getPdfData: vi.fn(),
    submitScreeningDecision: mocks.submitScreeningDecision,
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
});
