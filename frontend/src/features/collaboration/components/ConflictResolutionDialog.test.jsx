import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConflictResolutionDialog from "./ConflictResolutionDialog";

describe("conflict arbitration", () => {
  it("requires a nonblank reason and shows submitted decisions", async () => {
    const onResolve = vi.fn().mockResolvedValue({});
    render(
      <ConflictResolutionDialog
        conflict={{
          id: 8,
          articleId: 7,
          phase: "screening",
          status: "open",
          decisions: [
            {
              id: 1,
              reviewerUserId: 1,
              decision: "included",
              reasonText: "Pertinente",
              checklistAnswers: {},
              answeringRQs: [],
              status: "submitted",
              submittedAt: "2026-10-07",
            },
            {
              id: 2,
              reviewerUserId: 2,
              decision: "excluded",
              reasonText: "Fora do escopo",
              checklistAnswers: {},
              answeringRQs: [],
              status: "submitted",
              submittedAt: "2026-10-07",
            },
          ],
        }}
        onOpenChange={vi.fn()}
        onResolve={onResolve}
      />,
    );
    expect(screen.getByText("Fora do escopo")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Justificativa da arbitragem"), {
      target: { value: "   " },
    });
    expect(
      screen.getByRole("button", { name: "Resolver discordância" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Justificativa da arbitragem"), {
      target: { value: "  Atende ao protocolo  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Resolver discordância" }),
    );
    await waitFor(() =>
      expect(onResolve).toHaveBeenCalledWith(8, {
        decision: "included",
        reason: "Atende ao protocolo",
      }),
    );
  });
  it("shows resolved arbitration without offering another resolution", () => {
    render(
      <ConflictResolutionDialog
        conflict={{
          id: 8,
          articleId: 7,
          phase: "screening",
          status: "resolved",
          decisions: [],
          resolutionReason: "Concluído",
          resolvedDecision: "included",
        }}
        onOpenChange={vi.fn()}
        onResolve={vi.fn()}
      />,
    );
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resolver discordância" }),
    ).not.toBeInTheDocument();
  });
});
