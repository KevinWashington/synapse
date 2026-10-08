import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArticleWorkspacePanel from "./ArticleWorkspacePanel";

const defaultProps = {
  article: { id: 1, title: "Estudo", notas: "" },
  project: {},
  onAddNote: vi.fn(),
  onSaveEvidence: vi.fn(),
  onSaveNotes: vi.fn(),
  pdfData: null,
  rightTab: "notas",
  setRightTab: vi.fn(),
  isSavingEvidence: false,
};

describe("ArticleWorkspacePanel stage tools", () => {
  it("lets unassigned reviewers read notes without editing them", () => {
    render(<ArticleWorkspacePanel {...defaultProps} activeFlow="screening"
      article={{ ...defaultProps.article, notas: "Existing notes", hasActiveReviewAssignments: true, myReviewAssignment: null, canWriteReview: false }} />);
    expect(screen.getByDisplayValue("Existing notes")).toHaveAttribute("readonly");
    expect(screen.getByText("Este artigo não foi atribuído a você.")).toBeInTheDocument();
  });

  it("disables extraction controls for an unassigned reviewer while showing saved data", () => {
    render(<ArticleWorkspacePanel {...defaultProps} activeFlow="included" rightTab="extracao"
      project={{ dataExtractionSchema: [{ key: "method", label: "Method", type: "text" }] }}
      article={{ ...defaultProps.article, reviewOutcome: "included", extractionData: { method: "Saved method" }, hasActiveReviewAssignments: true, myReviewAssignment: null, canWriteReview: false }} />);
    expect(screen.getByDisplayValue("Saved method")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Salvar/ })).toBeDisabled();
  });

  it("allows owner/coordinator ancillary writes without an assignment", () => {
    render(<ArticleWorkspacePanel {...defaultProps} activeFlow="screening"
      article={{ ...defaultProps.article, hasActiveReviewAssignments: true, myReviewAssignment: null, canWriteReview: true }} />);
    expect(screen.getByPlaceholderText("Digite suas notas aqui...")).not.toHaveAttribute("readonly");
  });
  it.each(["screening", "eligibility"])(
    "hides extraction tools during %s",
    (activeFlow) => {
      render(<ArticleWorkspacePanel {...defaultProps} activeFlow={activeFlow} />);

      expect(screen.getByRole("button", { name: "Notas" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Assistente IA" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Extração" })).not.toBeInTheDocument();
    }
  );

  it("returns an invalid eligibility extraction tab to notes", async () => {
    const setRightTab = vi.fn();
    render(
      <ArticleWorkspacePanel
        {...defaultProps}
        activeFlow="eligibility"
        rightTab="extracao"
        setRightTab={setRightTab}
      />
    );

    await waitFor(() => expect(setRightTab).toHaveBeenCalledWith("notas"));
  });

  it("opens the AI assistant from the stage tab", () => {
    const setRightTab = vi.fn();
    render(
      <ArticleWorkspacePanel
        {...defaultProps}
        activeFlow="screening"
        setRightTab={setRightTab}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Assistente IA" }));
    expect(setRightTab).toHaveBeenCalledWith("chat");
  });
});
