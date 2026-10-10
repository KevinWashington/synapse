import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ArticleWorkspacePanel from "./ArticleWorkspacePanel";

vi.mock("@services/chatService", () => ({
  chatService: { sendChatMessage: async () => ({ content: "Trecho de evidência" }) },
}));

function InteractivePanel(props) {
  const [rightTab, setRightTab] = useState("notas");
  return <ArticleWorkspacePanel {...defaultProps} {...props} rightTab={rightTab} setRightTab={setRightTab} />;
}

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
  it("only initializes the assistant when its tab is opened", () => {
    render(<InteractivePanel activeFlow="screening" />);
    expect(screen.queryByPlaceholderText("Pergunte sobre o artigo...")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Assistente IA" }));
    expect(screen.getByPlaceholderText("Pergunte sobre o artigo...")).toBeVisible();
  });

  it("does not offer to modify notes to a read-only reviewer", async () => {
    render(<InteractivePanel activeFlow="screening" article={{ ...defaultProps.article, canWriteReview: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Assistente IA" }));
    fireEvent.change(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { target: { value: "Qual é a evidência?" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { key: "Enter" });
    await screen.findByText("Trecho de evidência");
    expect(screen.queryByTitle("Adicionar às notas")).not.toBeInTheDocument();
  });

  it("preserves conversation and input when switching support tabs", async () => {
    render(<InteractivePanel activeFlow="screening" />);
    fireEvent.click(screen.getByRole("button", { name: "Assistente IA" }));
    fireEvent.change(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { target: { value: "Qual é a evidência?" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { key: "Enter" });
    await screen.findByText("Trecho de evidência");
    fireEvent.change(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { target: { value: "Pergunta pendente" } });
    fireEvent.click(screen.getByRole("button", { name: "Notas" }));
    fireEvent.click(screen.getByRole("button", { name: "Assistente IA" }));
    expect(screen.getByText("Trecho de evidência")).toBeVisible();
    expect(screen.getByPlaceholderText("Pergunte sobre o artigo...")).toHaveValue("Pergunta pendente");
  });

  it("appends AI evidence to the current unsaved note and persists both", async () => {
    const saved = [];
    render(<InteractivePanel activeFlow="screening" onSaveNotes={async (value) => saved.push(value)} />);
    fireEvent.change(screen.getByPlaceholderText("Digite suas notas aqui..."), { target: { value: "Minha observação" } });
    fireEvent.click(screen.getByRole("button", { name: "Assistente IA" }));
    fireEvent.change(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { target: { value: "Qual é a evidência?" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Pergunte sobre o artigo..."), { key: "Enter" });
    await screen.findByText("Trecho de evidência");
    fireEvent.click(screen.getByTitle("Adicionar às notas"));
    await act(async () => {});
    expect(screen.getByPlaceholderText("Digite suas notas aqui...")).toHaveValue("Minha observação\n\nTrecho de evidência");
    expect(saved.at(-1)).toBe("Minha observação\n\nTrecho de evidência");
  });

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
