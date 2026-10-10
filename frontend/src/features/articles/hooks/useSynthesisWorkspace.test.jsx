import { describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSynthesisWorkspace } from "./useSynthesisWorkspace";

vi.mock("../services/synthesisService", () => ({ synthesisService: {
  getOverview: vi.fn().mockResolvedValue({ includedCount: 2 }),
  getRQs: vi.fn().mockResolvedValue({ items: [], total: 0 }),
} }));

describe("useSynthesisWorkspace", () => {
  it("loads only overview and RQ index for the active project", async () => {
    const { result } = renderHook(() => useSynthesisWorkspace({ projectId: 8, canEdit: true }));
    await waitFor(() => expect(result.current.resources.overview.data.includedCount).toBe(2));
    expect(result.current.resources.rqs.data.total).toBe(0);
  });
  it("preserves dirty edits and reports dirty state", async () => {
    const dirty = vi.fn();
    const { result } = renderHook(() => useSynthesisWorkspace({ projectId: 8, canEdit: true, onDirtyChange: dirty }));
    act(() => result.current.actions.setDraft({ narrative: "Local text" }));
    expect(result.current.draft.content.narrative).toBe("Local text");
    expect(dirty).toHaveBeenCalledWith(true);
  });
});
