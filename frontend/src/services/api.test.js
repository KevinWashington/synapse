import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiService } from "./api";

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

  it("normalizes the standard error envelope and exposes its stable code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: {
      code: "SYNTHESIS_VERSION_CONFLICT", message: "Atualizada", context: { expectedVersion: 2 }, traceId: "abc",
    } }), { status: 409, headers: { "content-type": "application/json" } })));

    await expect(apiService.get("/api/teste")).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      code: "SYNTHESIS_VERSION_CONFLICT",
      data: { code: "SYNTHESIS_VERSION_CONFLICT", message: "Atualizada", context: { expectedVersion: 2 }, traceId: "abc" },
    });
  });

  it.each([
    ["legado como texto", 400, { detail: "Falha antiga" }, { code: "HTTP_400", message: "Falha antiga" }],
    ["legado como objeto", 400, { detail: { error: "Campo inválido", message: "Campo inválido", details: ["Título obrigatório"] } }, { code: "HTTP_400", message: "Campo inválido", details: ["Título obrigatório"] }],
    ["validação em lista", 422, { detail: [{ loc: ["body", "title"], msg: "Obrigatório", type: "missing" }] }, { code: "VALIDATION_ERROR", message: "Confira os campos informados.", context: { fields: [{ loc: ["body", "title"], msg: "Obrigatório", type: "missing" }] } }],
  ])("normalizes %s errors", async (_label, status, body, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status, headers: { "content-type": "application/json" },
    })));

    await expect(apiService.get("/api/teste")).rejects.toMatchObject({ status, data: expected });
  });

  it("uses a stable network error code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket closed")));

    await expect(apiService.get("/api/teste")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
      data: { code: "NETWORK_ERROR", message: "Erro de conexao com o servidor" },
    });
  });

  it("returns binary downloads without parsing their body", async () => {
    const download = new Response(new Uint8Array([1, 2]), { headers: { "content-type": "application/pdf" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(download));

    await expect(apiService.get("/api/arquivo")).resolves.toBe(download);
  });

  it("dispatches the DeepSeek key event from the normalized error code", async () => {
    const listener = vi.fn();
    window.addEventListener("synapse:deepseek-key-required", listener);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "DEEPSEEK_KEY_REQUIRED" }), {
      status: 400, headers: { "content-type": "application/json" },
    })));

    await expect(apiService.get("/api/teste")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("synapse:deepseek-key-required", listener);
  });
});
