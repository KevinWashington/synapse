import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DistributionPanel from "./DistributionPanel";
import { collaboration } from "./testFixtures";

describe("controlled distribution", () => {
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
    render(<DistributionPanel collaboration={state} />);
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
});
