import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScreeningDecisionTool from "./ScreeningDecisionTool";

const article = {
  id: 11,
  title: "Estudo de inclusão digital",
  aiEvaluation: "A população corresponde aos critérios.",
};

function renderTool(overrides = {}) {
  const props = {
    article,
    isSaving: false,
    onAdvance: vi.fn(),
    onDirtyChange: vi.fn(),
    onSkip: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  render(<ScreeningDecisionTool {...props} />);
  return props;
}

describe("ScreeningDecisionTool", () => {
  it("keeps AI secondary and exposes guidance without relying on placeholders", () => {
    renderTool();
    expect(screen.getByRole("heading", { name: "Decisão de triagem" })).toBeVisible();
    expect(screen.getByText("Obrigatória ao excluir; opcional ao incluir.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copiar para justificativa" })).not.toBeVisible();
    fireEvent.click(screen.getByText("Sugestão da IA", { exact: true }));
    expect(screen.getByRole("button", { name: "Copiar para justificativa" })).toBeVisible();
  });

  it("does not skip an article while its decision is being saved", () => {
    const { onSkip } = renderTool({ isSaving: true });
    expect(screen.getByRole("button", { name: "Pular estudo" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("complementary", { name: "Decisão de triagem" }), { key: "p" });
    expect(onSkip).not.toHaveBeenCalled();
  });
  it("requires a justification before excluding", async () => {
    const { onSubmit } = renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar e próximo" }));

    expect(await screen.findByText("A justificativa é obrigatória para exclusão.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("allows inclusion without a note and advances only after a successful save", async () => {
    const { onAdvance, onSubmit } = renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Incluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar e próximo" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(11, {
      decision: "included",
      reasonText: null,
    }));
    expect(onAdvance).toHaveBeenCalledOnce();
  });

  it("copies the labeled AI suggestion as an editable draft without submitting", () => {
    const { onSubmit } = renderTool();

    expect(screen.getByText("Sugestão da IA")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sugestão da IA", { exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Copiar para justificativa" }));

    expect(screen.getByRole("textbox", { name: "Justificativa" })).toHaveValue(article.aiEvaluation);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the draft after a failed save", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("offline"));
    renderTool({ onSubmit });
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Justificativa" }), {
      target: { value: "Fora da população definida." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar e próximo" }));

    expect(await screen.findByText("Não foi possível salvar. Revise a conexão e tente novamente.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Justificativa" })).toHaveValue("Fora da população definida.");
    expect(screen.getByRole("textbox", { name: "Justificativa" })).toHaveAttribute("aria-invalid", "false");
  });

  it("disables decisions for an unassigned collaborative article", () => {
    renderTool({
      article: {
        ...article,
        hasActiveReviewAssignments: true,
        myReviewAssignment: null,
        reviewState: "waiting_for_reviewer",
      },
    });

    expect(screen.getByText("Este artigo não foi atribuído a você.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Incluir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeDisabled();
  });

  it("points submitted reviewers to the visible decision history", () => {
    renderTool({
      article: {
        ...article,
        hasActiveReviewAssignments: true,
        myReviewAssignment: { reviewerUserId: 1, status: "submitted" },
        reviewState: "waiting_for_reviewer",
      },
    });

    expect(screen.getByText("Sua decisão e justificativa aparecem no painel do artigo.")).toBeInTheDocument();
  });

  it.each([
    ["i", "Incluir"],
    ["e", "Excluir"],
  ])("uses %s as the %s shortcut", (key, buttonName) => {
    renderTool();

    fireEvent.keyDown(screen.getByRole("complementary", { name: "Decisão de triagem" }), { key });

    expect(screen.getByRole("button", { name: buttonName })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses P to skip but ignores shortcuts while typing", () => {
    const { onSkip } = renderTool();
    const panel = screen.getByRole("complementary", { name: "Decisão de triagem" });

    fireEvent.keyDown(panel, { key: "p" });
    expect(onSkip).toHaveBeenCalledOnce();

    const field = screen.getByRole("textbox", { name: "Justificativa" });
    fireEvent.keyDown(field, { key: "p" });
    fireEvent.keyDown(field, { key: "e" });
    expect(onSkip).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Excluir" })).toHaveAttribute("aria-pressed", "false");
  });
});
