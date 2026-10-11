import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRemoteResource } from "./useRemoteResource";
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
describe("useRemoteResource", () => {
  it("hides the old key immediately and ignores out of order responses", async () => {
    const first = deferred(); const second = deferred();
    const load = vi.fn((key) => key === "a" ? first.promise : second.promise);
    const { result, rerender } = renderHook(({ resourceKey }) => useRemoteResource({ key: resourceKey, load: () => load(resourceKey) }), { initialProps: { resourceKey: "a" } });
    rerender({ resourceKey: "b" }); expect(result.current.data).toBeNull();
    await act(async () => second.resolve(["b"])); await act(async () => first.resolve(["a"]));
    expect(result.current.data).toEqual(["b"]);
  });
  it("retains same-key data on reload error and distinguishes a legitimate empty list", async () => {
    const load = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([1]);
    const { result } = renderHook(() => useRemoteResource({ key: "a", load }));
    await waitFor(() => expect(result.current.data).toEqual([]));
    await act(async () => result.current.reload());
    expect(result.current.data).toEqual([]); expect(result.current.error.message).toBe("offline");
    await act(async () => result.current.reload());
    expect(result.current.data).toEqual([1]); expect(result.current.error).toBeNull();
  });
  it("discards a pending result after disabling or unmount", async () => {
    const pending = deferred(); const load = vi.fn(() => pending.promise);
    const { result, rerender, unmount } = renderHook(({ enabled }) => useRemoteResource({ key: "a", enabled, load }), { initialProps: { enabled: true } });
    rerender({ enabled: false }); await act(async () => pending.resolve([1]));
    expect(result.current.data).toBeNull(); expect(result.current.loading).toBe(false); unmount();
  });
});

it("clears already loaded data when switching keys and ignores a pending result after unmount", async () => {
  const pending = deferred(); const load = vi.fn().mockResolvedValueOnce(["a"]).mockReturnValueOnce(pending.promise);
  const { result, rerender, unmount } = renderHook(({ resourceKey }) => useRemoteResource({ key: resourceKey, load }), { initialProps: { resourceKey: "a" } });
  await waitFor(() => expect(result.current.data).toEqual(["a"]));
  rerender({ resourceKey: "b" });
  expect(result.current.data).toBeNull();
  unmount();
  await act(async () => pending.resolve(["b"]));
  expect(result.current.data).toBeNull();
});

it("does not let a pending GET overwrite an authoritative mutation snapshot", async () => {
  const pending = deferred(); const load = vi.fn().mockResolvedValueOnce({ title: "Before" }).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useRemoteResource({ key: "a", load }));
  await waitFor(() => expect(result.current.data?.title).toBe("Before"));
  let reload;
  act(() => { reload = result.current.reload(); });
  act(() => result.current.setData({ title: "Saved" }));
  await act(async () => { pending.resolve({ title: "Old GET" }); await reload; });
  expect(result.current.data.title).toBe("Saved");
});
