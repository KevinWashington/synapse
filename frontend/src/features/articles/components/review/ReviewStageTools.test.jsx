import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArticleReadingPane from "./ArticleReadingPane";
import IdentificationTool from "./IdentificationTool";
import IncludedExtractionTool from "./IncludedExtractionTool";

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
});
