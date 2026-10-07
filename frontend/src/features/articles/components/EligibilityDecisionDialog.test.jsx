import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EligibilityDecisionDialog from "./EligibilityDecisionDialog";

const checklist = ["A população corresponde à pergunta de pesquisa?"];
const researchQuestions = ["Qual é o efeito da intervenção?"];

function renderDialog(overrides = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <EligibilityDecisionDialog
      article={{ id: 1, title: "Estudo", hasPdf: true }}
      checklist={checklist}
      initialDecision="included"
      researchQuestions={researchQuestions}
      isOpen
      isSaving={false}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { onSubmit };
}

describe("EligibilityDecisionDialog decision-specific content", () => {
  it("shows checklist, AI assistance, research questions, and optional justification for inclusion", () => {
    renderDialog();

    expect(screen.getByText("Checklist assistido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assistir com IA" })).toBeInTheDocument();
    expect(screen.getByText("RQs respondidas")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Justificativa" })).not.toBeRequired();
  });

  it("shows checklist and AI assistance, but not research questions, for exclusion", () => {
    renderDialog({ initialDecision: "excluded" });

    expect(screen.getByText("Checklist assistido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assistir com IA" })).toBeInTheDocument();
    expect(screen.queryByText("RQs respondidas")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Justificativa da exclusão" })).toBeRequired();
  });

  it("shows only the focused reason UI for unavailable full text", () => {
    renderDialog({ initialDecision: "full_text_unavailable" });

    expect(screen.getByRole("button", { name: "Texto completo indisponível" })).toBeInTheDocument();
    expect(screen.queryByText("Checklist assistido")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assistir com IA" })).not.toBeInTheDocument();
    expect(screen.queryByText("RQs respondidas")).not.toBeInTheDocument();
    expect(screen.getByText(/não foi possível acessar o texto completo/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Motivo da indisponibilidade" })).toHaveAttribute(
      "placeholder",
      "Descreva por que o texto completo não está disponível."
    );
    expect(screen.getByRole("textbox", { name: "Motivo da indisponibilidade" })).toBeRequired();
  });

  it("submits unavailable full text without stale checklist answers or research questions", async () => {
    const { onSubmit } = renderDialog({
      article: {
        id: 1,
        title: "Estudo",
        hasPdf: true,
        eligibilityChecklistAnswers: {
          "item-1": "Status: Atende\nEvidencia: população elegível",
        },
        answeringRQs: [1],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Texto completo indisponível" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo da indisponibilidade" }), {
      target: { value: "O periódico não oferece acesso ao artigo." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar decisão" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        decision: "full_text_unavailable",
        reasonText: "O periódico não oferece acesso ao artigo.",
        checklistAnswers: {},
        answeringRQs: [],
      })
    );
  });

  it("clears irrelevant validation errors when the decision changes without submitting", () => {
    const { onSubmit } = renderDialog({
      article: { id: 1, title: "Estudo", hasPdf: false },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar decisão" }));
    expect(screen.getByText("Envie o PDF antes de incluir o artigo no corpus final.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(screen.queryByText("Envie o PDF antes de incluir o artigo no corpus final.")).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
