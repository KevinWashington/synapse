import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSynthesisWorkspace } from "./useSynthesisWorkspace";
import { synthesisService } from "../services/synthesisService";
import { ApiError } from "@/services/api";

vi.mock("../services/synthesisService", () => ({ synthesisService: {
  getOverview: vi.fn().mockResolvedValue({ includedCount: 2 }),
  getRQs: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getRQDetail: vi.fn().mockResolvedValue({ rqNumber: 1, question: "Question", questionFingerprint: "abc", draft: null }),
  getEvidence: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  save: vi.fn(),
} }));

describe("useSynthesisWorkspace", () => {
  beforeEach(() => synthesisService.getRQs.mockResolvedValue({ items: [], total: 0 }));
  it("preserves local edits when refreshing the current question", async () => {
    synthesisService.getRQs.mockResolvedValue({ items: [{ rqNumber: 1, question: "Question" }], total: 1 });
    const { result } = renderHook(() => useSynthesisWorkspace({ projectId: 8, canEdit: true }));
    await waitFor(() => expect(result.current.resources.detail.data?.rqNumber).toBe(1));
    act(() => result.current.actions.setDraft({ narrative: "Unsaved finding" }));
    await act(async () => result.current.actions.refresh());
    expect(result.current.draft.content.narrative).toBe("Unsaved finding");
    expect(result.current.draft.dirty).toBe(true);
  });
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

  it("preserves the dirty draft and exposes canonical conflict data", async () => {
    synthesisService.getRQs.mockResolvedValue({ items: [{ rqNumber: 1, question: "Question" }], total: 1 });
    synthesisService.save.mockRejectedValue(new ApiError("Versão desatualizada", 409, {
      code: "SYNTHESIS_VERSION_CONFLICT",
      message: "A síntese foi atualizada por outra pessoa.",
      context: { currentVersion: 3 },
    }));
    const { result } = renderHook(() => useSynthesisWorkspace({ projectId: 8, canEdit: true }));
    await waitFor(() => expect(result.current.resources.detail.data?.rqNumber).toBe(1));
    act(() => result.current.actions.setDraft({ narrative: "Texto local ainda não salvo" }));

    await act(async () => result.current.actions.save());

    expect(result.current.draft.dirty).toBe(true);
    expect(result.current.draft.content.narrative).toBe("Texto local ainda não salvo");
    expect(result.current.draft.conflict).toMatchObject({ code: "SYNTHESIS_VERSION_CONFLICT", message: "A síntese foi atualizada por outra pessoa." });
  });
});
