import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api", () => ({ apiService: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), requestRaw: vi.fn() } }));

describe("synthesisService", () => {
  beforeEach(() => vi.clearAllMocks());
  it("omits empty parameters and serializes arrays for list requests", async () => {
    const { apiService } = await import("@/services/api");
    const { synthesisService } = await import("./synthesisService");
    await synthesisService.getMatrix(7, { search: "x", page: 2, columns: ["year", "title"], source: "" });
    expect(apiService.get).toHaveBeenCalledWith("/api/projetos/7/synthesis/matrix?search=x&page=2&columns=year&columns=title");
  });
  it("exposes the workspace endpoints", async () => {
    const { apiService } = await import("@/services/api");
    const { synthesisService } = await import("./synthesisService");
    await synthesisService.getRQDetail(4, 2);
    expect(apiService.get).toHaveBeenCalledWith("/api/projetos/4/synthesis/rqs/2");
  });
});
