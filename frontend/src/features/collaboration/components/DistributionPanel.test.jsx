import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DistributionPanel from "./DistributionPanel";
import { collaboration } from "./testFixtures";

describe("controlled distribution", () => {
  it("previews adapting to a solo reviewer before explicitly applying it", async () => {
    const state = collaboration({ members: [collaboration().members[0]] });
    state.previewAdaptation = vi.fn().mockResolvedValue({ phase: "screening", reviewerCount: 1, reviewsPerArticle: 1,
      articleCount: 118, cancelledCount: 118, assignedCount: 0, consolidatedCount: 4, fingerprint: "snapshot" });
    state.adaptAssignments = vi.fn().mockResolvedValue({});
    render(<DistributionPanel collaboration={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Adaptar à equipe atual" }));
    expect(await screen.findByText(/118 artigos serão adaptados/)).toBeInTheDocument();
    expect(screen.getByText(/Revisão individual/)).toBeInTheDocument();
    expect(state.adaptAssignments).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar adaptação" }));
    await waitFor(() => expect(state.adaptAssignments).toHaveBeenCalledWith({ phase: "screening", fingerprint: "snapshot" }));
    expect(await screen.findByText("Distribuição adaptada à equipe atual.")).toBeInTheDocument();
  });
  it("shows only reassignment vacancies from the selected phase and limits long lists", () => {
    const state = collaboration({ assignments: [
      { id: 1, articleId: 20, phase: "eligibility", slot: 2, status: "needs_reassignment", reviewerUserId: 99 },
      ...Array.from({ length: 25 }, (_, i) => ({ id: i + 2, articleId: i + 100, phase: "screening", slot: 2, status: "needs_reassignment", reviewerUserId: 99 })),
    ] });
    render(<DistributionPanel collaboration={state} />);
    expect(screen.queryByText(/Artigo 20 ·/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Reatribuir artigo/ })).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "Próximas pendências" }));
    expect(screen.getAllByRole("button", { name: /^Reatribuir artigo/ })).toHaveLength(5);
  });
  it("previews counts and load before an explicit confirmation", async () => {
    const state = collaboration();
    state.previewAssignments.mockResolvedValue({
      phase: "screening",
      articleCount: 3,
      reviewerCount: 2,
      loads: { 1: 3, 2: 3 },
      assignments: [{ articleId: 7 }],
    });
    render(<DistributionPanel collaboration={state} />);
    expect(
      screen.queryByRole("button", { name: "Confirmar distribuição" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Pré-visualizar distribuição" }),
    );
    expect(
      await screen.findByText("3 artigos · 2 revisores"),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana: 3 atribuições")).toBeInTheDocument();
    expect(state.distributeAssignments).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar distribuição" }),
    );
    await waitFor(() =>
      expect(state.distributeAssignments).toHaveBeenCalledWith({
        phase: "screening",
      }),
    );
  });
  it("explains why no distribution is possible without eligible reviewers", () => {
    render(
      <DistributionPanel collaboration={collaboration({ members: [] })} />,
    );
    expect(screen.getByText(/Nenhum revisor disponível/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pré-visualizar distribuição" }),
    ).toBeDisabled();
  });
  it("warns about unavailable reviewers and explicitly reassigns a slot", async () => {
    const state = collaboration({
      assignments: [
        {
          id: 9,
          articleId: 7,
          phase: "screening",
          slot: 1,
          reviewerUserId: 99,
          status: "needs_reassignment",
        },
      ],
    });
    state.previewAssignments.mockResolvedValue({
      phase: "screening",
      articleCount: 1,
      reviewerCount: 2,
      loads: { 1: 1, 2: 1 },
      assignments: [{ articleId: 7 }],
    });
    render(<DistributionPanel collaboration={state} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Pré-visualizar distribuição" }),
    );
    expect(
      await screen.findByRole("button", { name: "Confirmar distribuição" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/precisa de reatribuição/)).toBeInTheDocument();
    fireEvent.keyDown(
      screen.getByRole("combobox", {
        name: "Novo revisor do artigo 7, vaga 1",
      }),
      { key: "ArrowDown" },
    );
    fireEvent.click(await screen.findByRole("option", { name: "Bruno" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Reatribuir artigo 7, vaga 1" }),
    );
    await waitFor(() =>
      expect(state.reassignAssignment).toHaveBeenCalledWith(9, {
        reviewerUserId: 2,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Confirmar distribuição" }),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Pré-visualizar distribuição" }),
    );
    expect(
      await screen.findByRole("button", { name: "Confirmar distribuição" }),
    ).toBeInTheDocument();
  });
  it("blocks distribution immediately while a reassignment is pending", async () => {
    let finishReassignment;
    const state = collaboration({
      assignments: [
        {
          id: 9,
          articleId: 7,
          phase: "screening",
          slot: 1,
          reviewerUserId: 99,
          status: "needs_reassignment",
        },
      ],
    });
    state.reassignAssignment.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishReassignment = resolve;
        }),
    );
    state.previewAssignments.mockResolvedValue({
      phase: "screening",
      articleCount: 1,
      reviewerCount: 2,
      loads: { 1: 1, 2: 1 },
      assignments: [{ articleId: 7 }],
    });
    render(<DistributionPanel collaboration={state} />);
    const previewButton = screen.getByRole("button", {
      name: "Pré-visualizar distribuição",
    });
    fireEvent.click(previewButton);
    const oldConfirm = await screen.findByRole("button", {
      name: "Confirmar distribuição",
    });
    fireEvent.keyDown(
      screen.getByRole("combobox", {
        name: "Novo revisor do artigo 7, vaga 1",
      }),
      { key: "ArrowDown" },
    );
    fireEvent.click(await screen.findByRole("option", { name: "Bruno" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Reatribuir artigo 7, vaga 1" }),
    );

    try {
      expect(
        screen.queryByRole("button", { name: "Confirmar distribuição" }),
      ).not.toBeInTheDocument();
      expect(previewButton).toBeDisabled();
      fireEvent.click(oldConfirm);
      fireEvent.click(previewButton);
      expect(state.distributeAssignments).not.toHaveBeenCalled();
      expect(state.previewAssignments).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        finishReassignment({});
      });
    }

    expect(previewButton).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Confirmar distribuição" }),
    ).not.toBeInTheDocument();
    fireEvent.click(previewButton);
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmar distribuição" }),
    );
    await waitFor(() =>
      expect(state.distributeAssignments).toHaveBeenCalledOnce(),
    );
  });
  it("invalidates preview when reviewers change", async () => {
    const state = collaboration();
    state.previewAssignments.mockResolvedValue({
      phase: "screening",
      articleCount: 1,
      reviewerCount: 2,
      loads: { 1: 1, 2: 1 },
      assignments: [{ articleId: 7 }],
    });
    const { rerender } = render(<DistributionPanel collaboration={state} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Pré-visualizar distribuição" }),
    );
    expect(
      await screen.findByRole("button", { name: "Confirmar distribuição" }),
    ).toBeInTheDocument();
    rerender(
      <DistributionPanel
        collaboration={{ ...state, members: state.members.slice(0, 1) }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Confirmar distribuição" }),
    ).not.toBeInTheDocument();
  });
  it("invalidates preview when assignment load changes without a team change", async () => {
    const state = collaboration();
    state.previewAssignments.mockResolvedValue({
      phase: "screening",
      articleCount: 1,
      reviewerCount: 2,
      loads: { 1: 1, 2: 1 },
      assignments: [{ articleId: 7 }],
    });
    const { rerender } = render(<DistributionPanel collaboration={state} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Pré-visualizar distribuição" }),
    );
    expect(
      await screen.findByRole("button", { name: "Confirmar distribuição" }),
    ).toBeInTheDocument();
    rerender(
      <DistributionPanel
        collaboration={{
          ...state,
          assignments: [
            {
              id: 12,
              reviewerUserId: 2,
              articleId: 10,
              phase: "screening",
              slot: 1,
              status: "pending",
            },
          ],
        }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Confirmar distribuição" }),
    ).not.toBeInTheDocument();
  });
});
