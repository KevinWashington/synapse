import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdaptiveReviewWorkspace from "./AdaptiveReviewWorkspace";
import ReviewStageNavigator from "./ReviewStageNavigator";

describe("ReviewStageNavigator", () => {
  it("shows the four PRISMA stages with server totals and marks the active step", () => {
    render(
      <ReviewStageNavigator
        activeStage="screening"
        onStageChange={vi.fn()}
        summary={{
          identification: { total: 1093 },
          screening: { total: 130 },
          eligibility: { total: 10 },
          included: 3,
        }}
      />
    );

    expect(screen.getByRole("button", { name: /Identificação.*1\.093 artigos/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Triagem.*130 artigos/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: /Elegibilidade.*10 artigos/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Inclusão.*3 artigos/ })).toBeInTheDocument();
  });

  it("reports the selected stage through its public callback", () => {
    const onStageChange = vi.fn();
    render(
      <ReviewStageNavigator
        activeStage="identification"
        onStageChange={onStageChange}
        summary={{}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Elegibilidade/ }));

    expect(onStageChange).toHaveBeenCalledWith("eligibility");
  });
});

describe("AdaptiveReviewWorkspace", () => {
  it("exposes queue, article, and decision as named regions", () => {
    render(
      <AdaptiveReviewWorkspace
        queue={<p>Queue content</p>}
        content={<p>Article content</p>}
        tool={<p>Decision content</p>}
      />
    );

    expect(screen.getByRole("region", { name: "Fila" })).toHaveTextContent("Queue content");
    expect(screen.getByRole("region", { name: "Artigo" })).toHaveTextContent("Article content");
    expect(screen.getByRole("region", { name: "Decisão" })).toHaveTextContent("Decision content");
  });

  it("switches the mobile region without unmounting draft-bearing content", () => {
    render(
      <AdaptiveReviewWorkspace
        queue={<input aria-label="Busca da fila" defaultValue="idosos" />}
        content={<p>Article content</p>}
        tool={<textarea aria-label="Justificativa" defaultValue="rascunho" />}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Decisão" }));

    expect(screen.getByRole("tab", { name: "Decisão" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Decisão" })).toHaveAttribute("data-active-region", "true");
    expect(screen.getByRole("textbox", { name: "Busca da fila" })).toHaveValue("idosos");
    expect(screen.getByRole("textbox", { name: "Justificativa" })).toHaveValue("rascunho");
  });
});
