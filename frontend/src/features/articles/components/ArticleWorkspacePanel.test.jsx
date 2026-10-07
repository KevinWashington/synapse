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
  it.each(["screening", "eligibility"])(
    "hides extraction tools during %s",
    (activeFlow) => {
      render(<ArticleWorkspacePanel {...defaultProps} activeFlow={activeFlow} />);

      expect(screen.getByRole("button", { name: "Notas" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Assistente IA" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Extracao" })).not.toBeInTheDocument();
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
