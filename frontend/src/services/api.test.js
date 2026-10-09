import { afterEach, describe, expect, it, vi } from "vitest";
import { apiService } from "./api";

describe("ApiService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for a 204 response that advertises application/json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 204,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(apiService.delete("/api/projetos/1")).resolves.toBeNull();
  });
});
