import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@/services/api";
import { useProjectCollaboration } from "./useProjectCollaboration";

const project = { id: 2, role: "owner", capabilities: ["resolve_conflicts", "review_assigned"] };
let requests;
beforeEach(() => {
  requests = [];
  vi.spyOn(apiService, "get").mockImplementation(async (url) => {
    requests.push(url);
    if (url.endsWith("/members")) return { members: [{ userId: 1 }], invitations: [{ id: 3 }] };
    if (url.endsWith("/notifications")) return [{ id: 5, readAt: null }, { id: 6, readAt: "2026-10-07" }];
    if (url.endsWith("/assignments/me")) return [{ id: 7 }];
    if (url.endsWith("/assignments")) return [{ id: 10, status: "needs_reassignment" }];
    if (url.endsWith("/conflicts")) return [{ id: 8 }];
    return { id: 2, role: "coordinator", capabilities: ["resolve_conflicts"] };
  });
  for (const verb of ["post", "patch", "delete"]) vi.spyOn(apiService, verb).mockResolvedValue({ success: true });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
async function mount(value = project) {
  const hook = renderHook(({ value }) => useProjectCollaboration(value), { initialProps: { value } });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}
describe("project collaboration state", () => {
  it("loads administrative slots even when the coordinator does not review", async () => {
    const { result } = await mount({ id: 2, capabilities: ["manage_distribution"] });
    expect(result.current.assignments).toEqual([{ id: 10, status: "needs_reassignment" }]);
    expect(requests).toContain("/api/projetos/2/assignments");
    expect(requests).not.toContain("/api/projetos/2/assignments/me");
  });
  it("loads collections and derives unread count and access", async () => {
    const { result } = await mount();
    expect(result.current).toMatchObject({ members: [{ userId: 1 }], invitations: [{ id: 3 }], assignments: [{ id: 7 }], conflicts: [{ id: 8 }], unreadCount: 1, capabilities: project.capabilities, error: null });
  });
  it("does not fetch collections without their permissions", async () => {
    const { result } = await mount({ id: 2, capabilities: ["read_project"] });
    expect(requests).toEqual(["/api/projetos/2/members", "/api/projetos/2/notifications"]);
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.assignments).toEqual([]);
  });
  it("stays idle without a project", async () => {
    const { result } = await mount(null);
    expect(requests).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });
  it.each([
    ["createInvitation", [{ email: "a@example.com" }], ["members"]],
    ["updateInvitation", [3, { role: "reviewer" }], ["members"]],
    ["cancelInvitation", [3], ["members"]],
    ["updateMember", [4, { role: "reviewer" }], ["members"]],
    ["removeMember", [4], ["members", "assignments/me"]],
    ["transferOwnership", [{ userId: 4 }], ["members", "access"]],
    ["previewAssignments", [{ phase: "screening" }], []],
    ["distributeAssignments", [{ phase: "screening" }], ["assignments/me", "notifications"]],
    ["reassignAssignment", [7, { reviewerUserId: 9 }], ["assignments/me"]],
    ["markNotificationRead", [5], ["notifications"]],
    ["markAllNotificationsRead", [], ["notifications"]],
    ["resolveConflict", [8, { decision: "included", reason: "Evidence" }], ["assignments/me", "conflicts", "notifications"]],
    ["reopenReview", [9, { phase: "screening", reason: "Correction" }], ["assignments/me", "conflicts", "notifications"]],
  ])("%s refreshes only affected collections", async (method, args, collections) => {
    const { result } = await mount();
    requests.length = 0;
    await act(async () => { await result.current[method](...args); });
    expect(requests.sort()).toEqual(collections.map((name) => name === "access" ? "/api/projetos/2" : `/api/projetos/2/${name}`).sort());
    if (method === "transferOwnership") expect(result.current.capabilities).toEqual(["resolve_conflicts"]);
  });
  it("polls notifications every 30 seconds and cleans up on change and unmount", async () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderHook(({ value }) => useProjectCollaboration(value), { initialProps: { value: project } });
    await act(async () => {});
    requests.length = 0;
    await act(async () => { await vi.advanceTimersByTimeAsync(29999); });
    expect(requests).toEqual([]);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(requests).toEqual(["/api/projetos/2/notifications"]);
    rerender({ value: { ...project, id: 3 } });
    await act(async () => {});
    requests.length = 0;
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(requests).toEqual(["/api/projetos/3/notifications"]);
    unmount();
    requests.length = 0;
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(requests).toEqual([]);
  });
  it("loads inherited eligibility assignments after included conflict arbitration", async () => {
    const { result } = await mount();
    const get = vi.mocked(apiService.get).getMockImplementation();
    vi.mocked(apiService.get).mockImplementation((url) => url.endsWith("/assignments/me")
      ? Promise.resolve([{ id: 7 }, { id: 9, phase: "eligibility", status: "pending" }])
      : get(url));
    await act(async () => { await result.current.resolveConflict(8, { decision: "included", reason: "Evidence" }); });
    expect(result.current.assignments).toEqual([{ id: 7 }, { id: 9, phase: "eligibility", status: "pending" }]);
  });
  it.each(["response", "error"])("ignores an older notification poll %s after a mark-read refresh", async (completion) => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useProjectCollaboration(project));
    await act(async () => {});
    let completePoll;
    let failPoll;
    vi.mocked(apiService.get).mockImplementationOnce(() => new Promise((resolve, reject) => {
      completePoll = resolve;
      failPoll = reject;
    }));
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(result.current.unreadCount).toBe(1);
    vi.mocked(apiService.get).mockResolvedValueOnce([{ id: 5, readAt: "2026-10-07" }, { id: 6, readAt: "2026-10-07" }]);
    await act(async () => { await result.current.markNotificationRead(5); });
    expect(result.current.unreadCount).toBe(0);
    await act(async () => {
      if (completion === "response") completePoll([{ id: 5, readAt: null }]);
      else failPoll(Object.assign(new Error("Stale request failed"), { status: 500 }));
    });
    expect(result.current.notifications).toEqual([{ id: 5, readAt: "2026-10-07" }, { id: 6, readAt: "2026-10-07" }]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.error).toBeNull();
  });
  it("shows the project 404 message and clears inaccessible state", async () => {
    vi.mocked(apiService.get).mockRejectedValue(Object.assign(new Error("Projeto não encontrado."), { status: 404 }));
    const { result } = await mount();
    expect(result.current.error).toBe("Projeto não encontrado.");
    expect(result.current.capabilities).toEqual([]);
    expect(result.current.members).toEqual([]);
  });
  it("ignores responses from a previous project", async () => {
    let complete;
    vi.mocked(apiService.get).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const { result, rerender } = renderHook(({ value }) => useProjectCollaboration(value), { initialProps: { value: project } });
    rerender({ value: { ...project, id: 3 } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => complete({ members: [{ userId: 99 }], invitations: [] }));
    expect(result.current.members).toEqual([{ userId: 1 }]);
  });
  it("surfaces mutation errors without refreshing collections", async () => {
    const { result } = await mount();
    const error = Object.assign(new Error("Permission denied"), { status: 403 });
    vi.mocked(apiService.patch).mockRejectedValueOnce(error);
    requests.length = 0;
    await act(async () => { await expect(result.current.updateMember(4, { role: "reviewer" })).rejects.toBe(error); });
    expect(result.current.error).toBe("Permission denied");
    expect(result.current.members).toEqual([{ userId: 1 }]);
    expect(requests).toEqual([]);
  });
  it("keeps project state when a mutation entity is not found", async () => {
    const { result } = await mount();
    const error = Object.assign(new Error("Record missing"), { status: 404, data: { code: "MEMBER_NOT_FOUND" } });
    vi.mocked(apiService.delete).mockRejectedValueOnce(error);
    await act(async () => { await expect(result.current.removeMember(4)).rejects.toBe(error); });
    expect(result.current.capabilities).toEqual(project.capabilities);
    expect(result.current.error).toBe("Record missing");
  });
  it("stops polling and clears state if access is lost", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useProjectCollaboration(project));
    await act(async () => {});
    vi.mocked(apiService.get).mockRejectedValueOnce(Object.assign(new Error("Projeto não encontrado."), { status: 404, data: { code: "PROJECT_NOT_FOUND" } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(result.current.capabilities).toEqual([]);
    expect(result.current.members).toEqual([]);
    expect(result.current.loading).toBe(false);
    requests.length = 0;
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(requests).toEqual([]);
  });
});
