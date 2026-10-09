import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@/services/api";
import { useProjectCollaboration } from "./useProjectCollaboration";

const project = { id: 2, capabilities: ["resolve_conflicts", "review_assigned"] };
let requests;

beforeEach(() => {
  requests = [];
  vi.spyOn(apiService, "get").mockImplementation(async (url) => {
    requests.push(url);
    if (url.endsWith("/members")) return { members: [{ userId: 1 }], invitations: [{ id: 3 }] };
    if (url.endsWith("/assignments/me")) return [{ id: 7 }];
    if (url.endsWith("/assignments")) return [{ id: 10, status: "needs_reassignment" }];
    if (url.endsWith("/conflicts")) return [{ id: 8 }];
    return { capabilities: ["resolve_conflicts"] };
  });
  for (const verb of ["post", "patch", "delete"]) vi.spyOn(apiService, verb).mockResolvedValue({ success: true });
});
afterEach(() => vi.restoreAllMocks());

async function mount(value = project) {
  const hook = renderHook(({ value: current }) => useProjectCollaboration(current), { initialProps: { value } });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe("project collaboration state", () => {
  it("loads only project-scoped collaboration collections", async () => {
    const { result } = await mount();
    expect(result.current).toMatchObject({ members: [{ userId: 1 }], invitations: [{ id: 3 }], assignments: [{ id: 7 }], conflicts: [{ id: 8 }], error: null });
    expect(requests).not.toContain("/api/projetos/2/notifications");
  });
  it("loads administrative assignments for distribution managers", async () => {
    const { result } = await mount({ id: 2, capabilities: ["manage_distribution"] });
    expect(result.current.assignments).toEqual([{ id: 10, status: "needs_reassignment" }]);
    expect(requests).toContain("/api/projetos/2/assignments");
  });
  it("refreshes only assignments after a distribution", async () => {
    const { result } = await mount();
    requests.length = 0;
    await act(async () => { await result.current.distributeAssignments({ phase: "screening" }); });
    expect(requests).toEqual(["/api/projetos/2/assignments/me"]);
  });
  it("does not fetch privileged collections without their capability", async () => {
    const { result } = await mount({ id: 2, capabilities: ["read_project"] });
    expect(requests).toEqual(["/api/projetos/2/members"]);
    expect(result.current.assignments).toEqual([]);
    expect(result.current.conflicts).toEqual([]);
  });
});
