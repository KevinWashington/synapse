import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { homeService } from "../services/homeService";
import { statsService } from "@services/statsService";
import { inboxService } from "@features/inbox/public/services";
import useDashboardData from "./useDashboardData";
vi.mock("../services/homeService", () => ({ homeService: { getSummary: vi.fn(), getTasks: vi.fn(), getActivity: vi.fn() } }));
vi.mock("@services/statsService", () => ({ statsService: { getUserStats: vi.fn() } }));
vi.mock("@features/inbox/public/services", () => ({ inboxService: { getInbox: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  homeService.getSummary.mockResolvedValue({ screeningPending: 23, eligibilityPending: 7 });
  homeService.getTasks.mockImplementation(async ({ phase, page }) => ({ items: [{ title: `${phase} ${page}` }], total: 23, page, pageSize: 4 }));
  homeService.getActivity.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 4 });
  statsService.getUserStats.mockResolvedValue({ totalProjects: 30, totalArticles: 100, dailyReviews: [{ date: "2026-10-10", count: 4 }] });
  inboxService.getInbox.mockResolvedValue({ pendingInvitationCount: 2 });
});
it("loads personal counts and paginates", async () => {
  const { result } = renderHook(() => useDashboardData(1));
  await waitFor(() => expect(result.current.tasks.loading).toBe(false));
  expect(result.current.summary.data.screeningPending).toBe(23);
  expect(result.current.inbox.data.pendingInvitationCount).toBe(2);
  act(() => result.current.setTaskPage(2));
  await waitFor(() => expect(result.current.tasks.data?.items[0].title).toBe("screening 2"));
  act(() => result.current.setPhase("eligibility"));
  await waitFor(() => expect(result.current.tasks.data?.items[0].title).toBe("eligibility 1"));
});
it("retries resources independently", async () => {
  homeService.getTasks.mockRejectedValueOnce(new Error("Offline"));
  const { result } = renderHook(() => useDashboardData(1));
  await waitFor(() => expect(result.current.tasks.error).toBeTruthy());
  await act(async () => result.current.tasks.reload());
  expect(result.current.tasks.error).toBeNull();
  expect(homeService.getSummary).toHaveBeenCalledTimes(1);
  expect(homeService.getActivity).toHaveBeenCalledTimes(1);
});
it("clamps pages after totals shrink", async () => {
  const { result } = renderHook(() => useDashboardData(1));
  await waitFor(() => expect(result.current.tasks.loading).toBe(false));
  act(() => result.current.setTaskPage(4));
  await waitFor(() => expect(result.current.tasks.data?.page).toBe(4));
  homeService.getTasks.mockImplementation(async ({ page }) => ({ items: [], total: 1, page, pageSize: 4 }));
  await act(async () => result.current.tasks.reload());
  await waitFor(() => expect(result.current.taskPage).toBe(1));
});
it("ignores old phase responses", async () => {
  let resolve;
  homeService.getTasks.mockImplementation(({ phase }) => phase === "screening" ? new Promise((done) => { resolve = done; }) : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 4 }));
  const { result } = renderHook(() => useDashboardData(1));
  act(() => result.current.setPhase("eligibility"));
  await waitFor(() => expect(result.current.tasks.loading).toBe(false));
  await act(async () => resolve({ items: [{ title: "Old" }], total: 1 }));
  expect(result.current.tasks.data.items).toEqual([]);
});
