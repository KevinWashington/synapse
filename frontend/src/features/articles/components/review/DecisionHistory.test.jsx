import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DecisionHistory from "./DecisionHistory";

const collaborativeArticle = {
  hasActiveReviewAssignments: true,
  reviewState: "waiting_for_reviewer",
  myReviewAssignment: { reviewerUserId: 7, status: "submitted" },
  reviewDecisions: [
    { reviewerUserId: 7, decision: "included", reasonText: "Minha justificativa", submittedAt: "2026-10-09T12:00:00Z" },
    { reviewerUserId: 9, decision: "excluded", reasonText: "JUSTIFICATIVA PRIVADA DO PAR", status: "submitted" },
  ],
  screeningDecision: "included",
  screeningReasonText: "Justificativa consolidada",
};

describe("DecisionHistory", () => {
  it("shows only the current reviewer's submitted justification while collaboration is incomplete", () => {
    render(<DecisionHistory article={collaborativeArticle} phase="screening" />);

    expect(screen.getByText("Sua decisão")).toBeInTheDocument();
    expect(screen.getByText("Minha justificativa")).toBeInTheDocument();
    expect(screen.queryByText("JUSTIFICATIVA PRIVADA DO PAR")).not.toBeInTheDocument();
    expect(screen.queryByText("Decisão consolidada")).not.toBeInTheDocument();
  });

  it("separates the current reviewer's submission from the consolidated decision", () => {
    render(<DecisionHistory article={{ ...collaborativeArticle, reviewState: "consolidated" }} phase="screening" />);

    expect(screen.getByText("Sua decisão")).toBeInTheDocument();
    expect(screen.getByText("Decisão consolidada")).toBeInTheDocument();
    expect(screen.getByText("Justificativa consolidada")).toBeInTheDocument();
  });

  it("makes an empty submitted justification explicit", () => {
    const article = {
      ...collaborativeArticle,
      reviewDecisions: [{ reviewerUserId: 7, decision: "included", reasonText: null }],
    };
    render(<DecisionHistory article={article} phase="screening" />);

    expect(screen.getByText("Nenhuma justificativa informada")).toBeInTheDocument();
  });

  it("renders an individual review once without duplicating personal and canonical blocks", () => {
    render(<DecisionHistory article={{
      hasActiveReviewAssignments: false,
      eligibilityDecision: "excluded",
      eligibilityReasonText: "População incompatível",
      eligibilityReviewedAt: "2026-10-09T12:00:00Z",
    }} phase="eligibility" />);

    expect(screen.getByText("Decisão registrada")).toBeInTheDocument();
    expect(screen.getByText("População incompatível")).toBeInTheDocument();
    expect(screen.queryByText("Sua decisão")).not.toBeInTheDocument();
    expect(screen.queryByText("Decisão consolidada")).not.toBeInTheDocument();
  });
});
