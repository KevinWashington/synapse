import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArticleEvidenceEditor from "./ArticleEvidenceEditor";

const article = {
  id: 10,
  reviewOutcome: "included",
  extractionData: {},
  qualityAssessmentAnswers: {},
};

const project = {
  dataExtractionSchema: [{ key: "sample", label: "Amostra", type: "text" }],
  qualityAssessmentSchema: [],
};

function renderEditor(onSave = vi.fn().mockResolvedValue({})) {
  render(
    <>
      <ArticleEvidenceEditor
        article={article}
        formId="extraction-form"
        project={project}
        onSave={onSave}
        showFooterActions={false}
      />
      <button type="submit" form="extraction-form" value="draft">Salvar rascunho</button>
      <button type="submit" form="extraction-form" value="complete">Marcar como concluído</button>
    </>
  );
  fireEvent.change(screen.getByPlaceholderText("Digite amostra..."), {
    target: { value: "120 participantes" },
  });
  return onSave;
}

function requestCompletion() {
  const submitter = screen.getByRole("button", { name: "Marcar como concluído" });
  const event = new Event("submit", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "submitter", { value: submitter });
  fireEvent(document.getElementById("extraction-form"), event);
}

describe("ArticleEvidenceEditor completion", () => {
  it("reports dirty state and clears it only after a successful draft save", async () => {
    const onSave = vi.fn().mockResolvedValue({});
    const onDirtyChange = vi.fn();
    render(
      <ArticleEvidenceEditor
        article={article}
        formId="dirty-extraction-form"
        project={project}
        onDirtyChange={onDirtyChange}
        onSave={onSave}
        showFooterActions={false}
      />
    );

    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    fireEvent.change(screen.getByPlaceholderText("Digite amostra..."), {
      target: { value: "120 participantes" },
    });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.value = "draft";
    submit.setAttribute("form", "dirty-extraction-form");
    document.body.appendChild(submit);
    submit.click();

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    submit.remove();
  });

  it("saves a draft immediately without confirmation", async () => {
    const onSave = renderEditor();

    screen.getByRole("button", { name: "Salvar rascunho" }).click();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      extractionData: { sample: "120 participantes" },
      qualityAssessmentAnswers: {},
      markExtractionComplete: false,
    }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancels completion without saving or losing entered values", () => {
    const onSave = renderEditor();

    requestCompletion();
    expect(screen.getByRole("dialog", { name: "Concluir extração?" })).toBeInTheDocument();
    screen.getByRole("button", { name: "Cancelar" }).click();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Digite amostra...")).toHaveValue("120 participantes");
  });

  it("submits the current values as complete only after confirmation", async () => {
    const onSave = renderEditor();

    requestCompletion();
    screen.getByRole("button", { name: "Confirmar conclusão" }).click();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      extractionData: { sample: "120 participantes" },
      qualityAssessmentAnswers: {},
      markExtractionComplete: true,
    }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
