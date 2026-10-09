import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceArticle } from "./useWorkspaceArticle";

const mocks = vi.hoisted(() => ({
  getArticleById: vi.fn(),
  getPdfData: vi.fn(),
}));

vi.mock("@features/articles/services/articleService", () => ({
  articleService: {
    getArticleById: mocks.getArticleById,
    getPdfData: mocks.getPdfData,
  },
}));

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

describe("useWorkspaceArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and merges eligibility detail and PDF data", async () => {
    const buffer = new ArrayBuffer(8);
    mocks.getArticleById.mockResolvedValue({ id: 4, abstract: "Detalhe", hasPdf: true });
    mocks.getPdfData.mockResolvedValue(buffer);

    const { result } = renderHook(() => useWorkspaceArticle({
      projectId: 2,
      article: { id: 4, title: "Lista", hasPdf: true },
      activeStage: "eligibility",
    }));

    await waitFor(() => expect(result.current.pdfData).toBe(buffer));
    expect(result.current.article).toMatchObject({ id: 4, title: "Lista", abstract: "Detalhe", hasPdf: true });
    expect(mocks.getArticleById).toHaveBeenCalledWith(2, 4);
    expect(mocks.getPdfData).toHaveBeenCalledWith(2, 4);
  });

  it("clears the old PDF and ignores a stale response after selection changes", async () => {
    const firstPdf = new ArrayBuffer(4);
    const staleDetail = deferred();
    mocks.getArticleById
      .mockResolvedValueOnce({ id: 1, hasPdf: true })
      .mockImplementationOnce(() => staleDetail.promise)
      .mockResolvedValueOnce({ id: 3, hasPdf: true });
    mocks.getPdfData
      .mockResolvedValueOnce(firstPdf)
      .mockResolvedValueOnce(new ArrayBuffer(12));

    const { result, rerender } = renderHook(
      ({ article }) => useWorkspaceArticle({ projectId: 2, article, activeStage: "eligibility" }),
      { initialProps: { article: { id: 1, title: "Primeiro", hasPdf: true } } }
    );
    await waitFor(() => expect(result.current.pdfData).toBe(firstPdf));

    rerender({ article: { id: 2, title: "Segundo", hasPdf: true } });
    await waitFor(() => expect(result.current.pdfData).toBeNull());
    rerender({ article: { id: 3, title: "Terceiro", hasPdf: true } });
    await waitFor(() => expect(result.current.article.id).toBe(3));

    await act(async () => staleDetail.resolve({ id: 2, title: "Resposta atrasada", hasPdf: true }));
    expect(result.current.article.id).toBe(3);
    expect(result.current.article.title).toBe("Terceiro");
  });

  it("does not fetch detail or PDF during screening", async () => {
    const article = { id: 5, title: "Resumo", hasPdf: true };
    const { result } = renderHook(() => useWorkspaceArticle({ projectId: 2, article, activeStage: "screening" }));

    expect(result.current.article).toBe(article);
    expect(result.current.pdfData).toBeNull();
    expect(mocks.getArticleById).not.toHaveBeenCalled();
    expect(mocks.getPdfData).not.toHaveBeenCalled();
  });
});
