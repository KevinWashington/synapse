import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArticleReadingPane from "./ArticleReadingPane";
import IdentificationTool from "./IdentificationTool";
import IncludedExtractionTool from "./IncludedExtractionTool";

vi.mock("../PdfViewer", () => ({
  default: ({ article, pdfData }) => (
    <div data-testid="embedded-pdf">{article.title} · {pdfData?.byteLength || 0} bytes</div>
  ),
}));

const article = {
  id: 7,
  title: "Inclusão digital para pessoas idosas",
  authors: "Autora Teste",
  year: 2025,
  journal: "Journal",
  abstract: "Resumo do estudo.",
  hasPdf: true,
  extractionData: { population: "Pessoas 60+" },
};

describe("ArticleReadingPane", () => {
  it.each([
    ["screening", "Resumo"],
    ["eligibility", "Texto completo"],
    ["included", "Dados do estudo"],
  ])("labels %s content as %s exactly once", (activeStage, label) => {
    render(
      <ArticleReadingPane
        activeStage={activeStage}
        article={article}
        project={{ dataExtractionSchema: [{ key: "population", label: "População" }] }}
        position={{ current: 1, total: 20 }}
        onNext={vi.fn()}
        onOpenArticle={vi.fn()}
        onPrevious={vi.fn()}
        onUploadPdf={vi.fn()}
      />
    );

    expect(screen.getAllByText(label)).toHaveLength(1);
  });

  it("shows the current reviewer's saved screening justification", () => {
    render(
      <ArticleReadingPane
        activeStage="screening"
        article={{
          ...article,
          hasActiveReviewAssignments: true,
          reviewState: "waiting_for_reviewer",
          myReviewAssignment: { reviewerUserId: 7, status: "submitted" },
          reviewDecisions: [{ reviewerUserId: 7, decision: "included", reasonText: "Minha justificativa" }],
        }}
        project={{}}
        position={{ current: 1, total: 1 }}
        onNext={vi.fn()}
        onOpenArticle={vi.fn()}
        onPrevious={vi.fn()}
        onUploadPdf={vi.fn()}
      />
    );

    expect(screen.getByText("Sua decisão")).toBeInTheDocument();
    expect(screen.getByText("Minha justificativa")).toBeInTheDocument();
  });

  it("uses the full central width instead of constraining the whole reading pane", () => {
    render(
      <ArticleReadingPane
        activeStage="screening"
        article={article}
        project={{}}
        position={{ current: 1, total: 1 }}
        onNext={vi.fn()}
        onOpenArticle={vi.fn()}
        onPrevious={vi.fn()}
        onUploadPdf={vi.fn()}
      />
    );

    const content = screen.getByTestId("article-reading-content");
    expect(content).toHaveClass("w-full");
    expect(content).not.toHaveClass("max-w-[760px]");
  });

  it("embeds the PDF as the primary eligibility content", () => {
    render(
      <ArticleReadingPane
        activeStage="eligibility"
        article={article}
        pdfData={new ArrayBuffer(16)}
        project={{ id: 3 }}
        position={{ current: 1, total: 1 }}
        onNext={vi.fn()}
        onOpenArticle={vi.fn()}
        onPrevious={vi.fn()}
        onUploadPdf={vi.fn()}
      />
    );

    expect(screen.getByTestId("embedded-pdf")).toHaveTextContent("16 bytes");
    expect(screen.getByRole("button", { name: "Abrir em modo de foco" })).toBeInTheDocument();
  });

  it("uses summary and upload as the eligibility fallback when there is no PDF", () => {
    render(
      <ArticleReadingPane
        activeStage="eligibility"
        article={{ ...article, hasPdf: false }}
        project={{ id: 3 }}
        position={{ current: 1, total: 1 }}
        onNext={vi.fn()}
        onOpenArticle={vi.fn()}
        onPrevious={vi.fn()}
        onUploadPdf={vi.fn()}
      />
    );

    expect(screen.queryByTestId("embedded-pdf")).not.toBeInTheDocument();
    expect(screen.getByText("Resumo do estudo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar PDF" })).toBeInTheDocument();
  });
});

describe("IdentificationTool", () => {
  it("shows duplicate resolution and confirms unique promotion", async () => {
    const onRunDedup = vi.fn();
    const onPromoteAllUnique = vi.fn();
    render(
      <IdentificationTool
        articleTotal={963}
        duplicateCandidates={[{ groupKey: "doi:1", candidateIds: [1, 2] }]}
        summary={{ identification: { total: 1093 } }}
        canManageArticles
        onRunDedup={onRunDedup}
        onPromoteAllUnique={onPromoteAllUnique}
        onExport={vi.fn()}
      />
    );

    expect(screen.getByText("2 possíveis duplicatas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Detectar duplicatas" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar únicos para triagem" }));
    expect(onRunDedup).toHaveBeenCalledOnce();
    expect(onPromoteAllUnique).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar envio" }));
    expect(onPromoteAllUnique).toHaveBeenCalledOnce();
  });
});

describe("IncludedExtractionTool", () => {
  it("uses corpus pendingExtraction instead of the loaded page", () => {
    render(
      <IncludedExtractionTool
        article={article}
        project={{ dataExtractionSchema: [{ key: "population", label: "População" }] }}
        summary={{ included: 124, pendingExtraction: 103 }}
        onExport={vi.fn()}
        onOpenExtraction={vi.fn()}
        onViewFlow={vi.fn()}
      />
    );

    expect(screen.getByText("103 pendentes de extração")).toBeInTheDocument();
    expect(screen.getByText("124 estudos incluídos")).toBeInTheDocument();
  });

  it("edits and saves extraction without leaving the workspace", async () => {
    const onSave = vi.fn().mockResolvedValue({});
    const extractionProject = {
      dataExtractionSchema: [
        { key: "population", label: "População", type: "text" },
        { key: "result", label: "Resultado", type: "text" },
      ],
      qualityAssessmentSchema: [],
    };
    render(
      <>
        <ArticleReadingPane
          activeStage="included"
          article={{ ...article, reviewOutcome: "included" }}
          extractionFormId="workspace-extraction-form"
          onDirtyChange={vi.fn()}
          onNext={vi.fn()}
          onOpenArticle={vi.fn()}
          onPrevious={vi.fn()}
          onSaveEvidence={onSave}
          onUploadPdf={vi.fn()}
          position={{ current: 1, total: 1 }}
          project={extractionProject}
        />
        <IncludedExtractionTool
          article={{ ...article, reviewOutcome: "included" }}
          extractionFormId="workspace-extraction-form"
          onExport={vi.fn()}
          onOpenExtraction={vi.fn()}
          onViewFlow={vi.fn()}
          project={extractionProject}
          summary={{ included: 1, pendingExtraction: 1 }}
        />
      </>
    );

    expect(screen.getByText("1 de 2 campos preenchidos")).toBeInTheDocument();
    expect(screen.getByText("Pendente: Resultado")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Digite resultado..."), {
      target: { value: "Melhora significativa" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    expect(onSave).toHaveBeenCalledWith({
      extractionData: { population: "Pessoas 60+", result: "Melhora significativa" },
      qualityAssessmentAnswers: {},
      markExtractionComplete: false,
    });
  });

  it("keeps missing-schema guidance and read-only extraction usable", () => {
    render(
      <ArticleReadingPane
        activeStage="included"
        article={{
          ...article,
          reviewOutcome: "included",
          hasActiveReviewAssignments: true,
          myReviewAssignment: null,
          canWriteReview: false,
        }}
        extractionFormId="read-only-extraction"
        onDirtyChange={vi.fn()}
        onNext={vi.fn()}
        onOpenArticle={vi.fn()}
        onPrevious={vi.fn()}
        onSaveEvidence={vi.fn()}
        onUploadPdf={vi.fn()}
        position={{ current: 1, total: 1 }}
        project={{ dataExtractionSchema: [], qualityAssessmentSchema: [] }}
      />
    );

    expect(screen.getByText("Nenhum esquema de extração configurado")).toBeInTheDocument();
  });
});
