import { afterEach, expect, it, vi } from "vitest";
import { apiService } from "@/services/api";
import { projectService } from "./projectService";
afterEach(() => vi.restoreAllMocks());
it("extracts server access without inventing permissions for legacy payloads", async () => {
  vi.spyOn(apiService, "get").mockResolvedValueOnce({ id: 2, role: "reviewer", capabilities: ["read_project", "review_assigned"], participatesInReview: true }).mockResolvedValueOnce({ id: 3 });
  await expect(projectService.getProjectAccess(2)).resolves.toEqual({ role: "reviewer", capabilities: ["read_project", "review_assigned"], participatesInReview: true });
  await expect(projectService.getProjectAccess(3)).resolves.toEqual({ role: null, capabilities: [], participatesInReview: false });
});
