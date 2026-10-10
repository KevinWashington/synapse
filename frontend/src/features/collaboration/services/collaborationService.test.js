import { afterEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@/services/api";
import { collaborationService } from "./collaborationService";

afterEach(() => vi.restoreAllMocks());
describe("collaboration endpoint contracts", () => {
  it.each([
    ["getTeam", [], "get", "/members"],
    ["createInvitation", [{ email: "reader@example.com", role: "reviewer" }], "post", "/invitations"],
    ["updateInvitation", [3, { role: "coordinator" }], "patch", "/invitations/3"],
    ["cancelInvitation", [3], "delete", "/invitations/3"],
    ["updateMember", [4, { participatesInReview: false }], "patch", "/members/4"],
    ["removeMember", [4], "delete", "/members/4"],
    ["transferOwnership", [{ userId: 4 }], "post", "/transfer-ownership"],
    ["previewAssignments", [{ phase: "screening" }], "post", "/assignments/preview"],
    ["distributeAssignments", [{ phase: "eligibility" }], "post", "/assignments/distribute"],
    ["previewAdaptation", [{ phase: "screening" }], "post", "/assignments/adapt/preview"],
    ["adaptAssignments", [{ phase: "screening", fingerprint: "snapshot" }], "post", "/assignments/adapt"],
    ["getMyAssignments", [], "get", "/assignments/me"],
    ["getAssignments", [], "get", "/assignments"],
    ["reassignAssignment", [6, { reviewerUserId: 9 }], "patch", "/assignments/6"],
    ["getConflicts", [], "get", "/conflicts"],
    ["resolveConflict", [7, { decision: "included", reason: "Evidence" }], "post", "/conflicts/7/resolve"],
    ["reopenReview", [8, { phase: "screening", reason: "Correction" }], "post", "/artigos/8/reopen-review"],
  ])("%s uses the backend route and payload", async (method, args, verb, suffix) => {
    const request = vi.spyOn(apiService, verb).mockResolvedValue({ success: true });
    await expect(collaborationService[method](2, ...args)).resolves.toEqual({ success: true });
    const payload = args.find((value) => typeof value === "object");
    const expected = [`/api/projetos/2${suffix}`];
    if (payload) expected.push(payload);
    else if (verb === "post" || verb === "patch") expected.push({});
    expect(request).toHaveBeenCalledWith(...expected);
  });
  it("passes the optional assignment phase query", async () => {
    const request = vi.spyOn(apiService, "get").mockResolvedValue([]);
    await collaborationService.getMyAssignments(2, "eligibility");
    expect(request).toHaveBeenCalledWith("/api/projetos/2/assignments/me", { phase: "eligibility" });
  });
  it("preserves project not-found errors", async () => {
    const error = Object.assign(new Error("Projeto não encontrado."), { status: 404 });
    vi.spyOn(apiService, "get").mockRejectedValue(error);
    await expect(collaborationService.getTeam(2)).rejects.toBe(error);
  });
});
