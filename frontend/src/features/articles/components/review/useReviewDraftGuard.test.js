import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReviewDraftGuard } from "./useReviewDraftGuard";

describe("useReviewDraftGuard", () => {
  it("runs clean navigation immediately", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useReviewDraftGuard({ isDirty: false }));

    act(() => result.current.guard(action));

    expect(action).toHaveBeenCalledOnce();
    expect(result.current.isConfirmOpen).toBe(false);
  });

  it("waits for confirmation before dirty navigation", () => {
    const action = vi.fn();
    const confirmDiscard = vi.fn();
    const { result } = renderHook(() => useReviewDraftGuard({ isDirty: true, confirmDiscard }));

    act(() => result.current.guard(action));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.isConfirmOpen).toBe(true);

    act(() => result.current.confirm());
    expect(confirmDiscard).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
    expect(result.current.isConfirmOpen).toBe(false);

    act(() => result.current.confirm());
    expect(action).toHaveBeenCalledOnce();
  });

  it("cancels dirty navigation without running the pending action", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useReviewDraftGuard({ isDirty: true }));

    act(() => result.current.guard(action));
    act(() => result.current.cancel());

    expect(action).not.toHaveBeenCalled();
    expect(result.current.isConfirmOpen).toBe(false);
  });
});
