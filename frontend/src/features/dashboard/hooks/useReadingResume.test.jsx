import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { homeService } from "../services/homeService";
import { saveReadingResume, readReadingResume } from "../utils/readingResume";
import { useReadingResume } from "./useReadingResume";
vi.mock("../services/homeService", () => ({ homeService: { getReading: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  saveReadingResume(1, { projectId: 7, articleId: 9, phase: "screening", workspace: "notas" });
});
it("exposes server-validated metadata", async () => {
  homeService.getReading.mockResolvedValue({ article: { id: 9, title: "Study" }, project: { id: 7, title: "Review" } });
  const { result } = renderHook(() => useReadingResume(1));
  expect(result.current.article).toBeNull();
  await waitFor(() => expect(result.current.article?.title).toBe("Study"));
  expect(result.current.project.title).toBe("Review");
});
it.each([403, 404])("clears denied reference (%s)", async (status) => {
  homeService.getReading.mockRejectedValue({ status });
  const { result } = renderHook(() => useReadingResume(1));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(readReadingResume(1)).toBeNull();
  expect(result.current.article).toBeNull();
});
it("retains reference on transient failure and retries", async () => {
  homeService.getReading.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({ article: { id: 9, title: "Recovered" }, project: { id: 7, title: "Review" } });
  const { result } = renderHook(() => useReadingResume(1));
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(readReadingResume(1)).not.toBeNull();
  expect(result.current.article).toBeNull();
  await act(async () => result.current.retry());
  expect(result.current.article.title).toBe("Recovered");
});
it("ignores another user's late response", async () => {
  let resolve;
  homeService.getReading.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result, rerender } = renderHook(({ userId }) => useReadingResume(userId), { initialProps: { userId: 1 } });
  rerender({ userId: 2 });
  await act(async () => resolve({ article: { id: 9, title: "Private" }, project: { id: 7, title: "Review" } }));
  expect(result.current.article).toBeNull();
});
