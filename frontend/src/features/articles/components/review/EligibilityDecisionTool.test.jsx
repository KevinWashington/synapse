import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EligibilityDecisionTool from "./EligibilityDecisionTool";

const checklist = ["População elegível"];
const article = { id: 21, title: "Estudo completo", hasPdf: true };

function renderTool(overrides = {}) {
  const props = {
    article,
    checklist,
    researchQuestions: ["Qual é o efeito?"],
    isSaving: false,
    onAdvance: vi.fn(),
    onSkip: vi.fn(),
    onAssist: vi.fn(),
    onDirtyChange: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  render(<EligibilityDecisionTool {...props} />);
  return props;
}

describe("EligibilityDecisionTool", () => {
  it("explains the questions in an expandable reference and keeps the selection separate", async () => {
    const { onSubmit } = renderTool();
    expect(screen.getByRole("heading", { name: "Decisão de elegibilidade" })).toBeVisible();
    expect(screen.getByText("Perguntas respondidas pelo estudo")).toBeVisible();
    fireEvent.click(screen.getByText("Consultar perguntas", { exact: true }));
    expect(screen.getByText("Qual é o efeito?", { exact: true })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "RQ 1" }));
    expect(screen.getByRole("button", { name: "RQ 1" })).toHaveAttribute("aria-pressed", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("skips without submitting", () => {
    const props = renderTool();
    fireEvent.click(screen.getByRole("button", { name: "Pular estudo" }));
    expect(props.onSkip).toHaveBeenCalledOnce();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("blocks skip while saving", () => {
    const props = renderTool({ isSaving: true });
    fireEvent.click(screen.getByRole("button", { name: "Pular estudo" }));
    expect(props.onSkip).not.toHaveBeenCalled();
  });
  it("does not mark persisted reason and RQs as a new draft", async () => {
    const onDirtyChange = vi.fn();
    renderTool({
      article: { ...article, eligibilityReasonText: "Registrado", answeringRQs: [1] },
      onDirtyChange,
    });

    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    fireEvent.change(screen.getByRole("textbox", { name: "Justificativa" }), {
      target: { value: "Alterado" },
    });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });

  it("blocks inclusion when the PDF is missing", async () => {
    const { onSubmit } = renderTool({ article: { ...article, hasPdf: false } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar e próximo" }));

    expect(await screen.findByText("Envie o PDF antes de incluir o artigo no corpus final.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Justificativa" })).toHaveAttribute("aria-invalid", "false");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ["Excluir", "A justificativa da exclusão é obrigatória."],
    ["Texto completo indisponível", "O motivo da indisponibilidade é obrigatório."],
  ])("requires a reason for %s", async (decisionLabel, message) => {
    const { onSubmit } = renderTool();
    fireEvent.click(screen.getByRole("button", { name: decisionLabel }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar e próximo" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits checklist evidence and RQs only for inclusion", async () => {
    const { onSubmit } = renderTool();
    fireEvent.click(screen.getByRole("button", { name: "Sim" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Evidência: População elegível" }), {
      target: { value: "Página 3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "RQ 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar e próximo" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(21, {
      decision: "included",
      reasonText: null,
      checklistAnswers: { "item-1": "Status: Atende\nEvidencia: Página 3" },
      answeringRQs: [1],
    }));
  });

  it("keeps checklist evidence after a rejected submit", async () => {
    renderTool({ onSubmit: vi.fn().mockRejectedValue(new Error("offline")) });
    fireEvent.click(screen.getByRole("button", { name: "Não" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Evidência: População elegível" }), {
      target: { value: "Critério não atendido" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Justificativa da exclusão" }), {
      target: { value: "População incompatível" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar e próximo" }));

    expect(await screen.findByText("Não foi possível salvar. Revise a conexão e tente novamente.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Evidência: População elegível" })).toHaveValue("Critério não atendido");
  });

  it("applies AI evidence as a labeled draft without submitting", async () => {
    const onAssist = vi.fn().mockResolvedValue({
      items: [{ key: "item-1", status: "met", evidence: "Participantes com 60+" }],
      reasonText: "Critérios atendidos",
    });
    const { onSubmit } = renderTool({ onAssist });

    fireEvent.click(screen.getByRole("button", { name: "Assistir com IA" }));

    expect(await screen.findByText("Rascunho gerado pela IA — revise antes de salvar.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Evidência: População elegível" })).toHaveValue("Participantes com 60+");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps manual controls after AI assistance fails", async () => {
    renderTool({ onAssist: vi.fn().mockRejectedValue(new Error("offline")) });

    fireEvent.click(screen.getByRole("button", { name: "Assistir com IA" }));

    expect(await screen.findByText("A assistência da IA não está disponível. Continue a avaliação manualmente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sim" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Salvar e próximo" })).toBeEnabled();
  });

  it("keeps every eligibility control read-only after this reviewer submitted", () => {
    renderTool({
      article: {
        ...article,
        hasActiveReviewAssignments: true,
        myReviewAssignment: { reviewerUserId: 1, status: "submitted" },
        reviewState: "waiting_for_reviewer",
      },
    });

    expect(screen.getByRole("button", { name: "RQ 1" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Justificativa" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar e próximo" })).toBeDisabled();
    expect(screen.getByText("Sua decisão e justificativa aparecem no painel do artigo.")).toBeInTheDocument();
  });
});
