import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useFrameworkCatalog } from "./useFrameworkCatalog";
import { getFrameworkInfo, getComponentsForFramework } from "@/lib/frameworkConfig";
const { getFrameworks } = vi.hoisted(() => ({ getFrameworks: vi.fn() }));
vi.mock("../services/projectService", () => ({ projectService: { getFrameworks } }));
beforeEach(() => vi.clearAllMocks());
it("loads semantic framework metadata from the API", async () => {
  getFrameworks.mockResolvedValue([{ name: "NEW", description: "Server label", components: [{ key: "custom", required: true }] }]);
  const { result } = renderHook(() => useFrameworkCatalog());
  await waitFor(() => expect(result.current.frameworks).toHaveLength(1));
  expect(getFrameworkInfo("NEW", result.current.frameworks).description).toBe("Server label");
  expect(getComponentsForFramework("NEW", result.current.frameworks)).toEqual([{ key: "custom", required: true }]);
});
it("exposes failure and retries without substituting a framework", async () => {
  getFrameworks.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([{ name: "PICO", components: [] }]);
  const { result } = renderHook(() => useFrameworkCatalog());
  await waitFor(() => expect(result.current.error?.message).toBe("offline"));
  expect(result.current.frameworks).toEqual([]);
  expect(getFrameworkInfo("OLD", result.current.frameworks).name).toBe("OLD");
  expect(getComponentsForFramework("OLD", result.current.frameworks)).toEqual([]);
  await act(async () => result.current.reload());
  expect(result.current.frameworks[0].name).toBe("PICO");
});
