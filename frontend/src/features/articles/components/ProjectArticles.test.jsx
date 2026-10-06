import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ArticleDetailPanel,
  StageListPanel,
} from "./ProjectArticles";

const article = {
  id: 1,
  title: "Estudo controlado",
  authors: "Autora Teste",
  year: 2024,
  journal: "Journal",
  sourceName: "Scopus",
  sourceCategory: "database",
  currentPhase: "eligibility",
  reviewOutcome: "active",
  eligibilityDecision: "pending",
  fullTextStatus: "pending_upload",
  hasPdf: false,
};

function renderList(overrides = {}) {
  render(
    <StageListPanel
      activeFilter="all"
      activeStage="identification"
      articles={[article]}
      duplicateIds={new Set()}
      filterOptions={[{ key: "all", label: "Todos", count: 1 }]}
      isLoading={false}
      onArticleSelect={vi.fn()}
      onFilterChange={vi.fn()}
      onOpenArticle={vi.fn()}
      onPromoteSelected={vi.fn()}
      onToggleAllIdentification={vi.fn()}
      onToggleIdentification={vi.fn()}
      searchTerm=""
      selectedArticle={article}
      selectedIdentificationIds={[]}
      setSearchTerm={vi.fn()}
      summary={{ identification: { total: 1 } }}
      {...overrides}
    />
  );
}

describe("ProjectArticles work queue", () => {
  it("disables promotion without selection and exposes select all", () => {
    renderList();

    expect(screen.getByRole("button", { name: "Enviar 0 para triagem" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Selecionar todos os artigos visiveis" })).toBeInTheDocument();
  });

  it("does not render selection checkboxes outside identification", () => {
    renderList({
      activeStage: "screening",
      filterOptions: [{ key: "all", label: "Todos", count: 1 }],
      summary: { screening: { total: 1 } },
    });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("blocks inclusion until a PDF exists and offers a truthful skip action", () => {
    render(
      <ArticleDetailPanel
        activeStage="eligibility"
        article={article}
        currentIndex={0}
        onClose={vi.fn()}
        onNext={vi.fn()}
        onOpenArticle={vi.fn()}
        onOpenEligibility={vi.fn()}
        onOpenScreening={vi.fn()}
        onOpenUploadPdf={vi.fn()}
        onPrevious={vi.fn()}
        onSkip={vi.fn()}
        project={{ dataExtractionSchema: [] }}
        total={1}
      />
    );

    expect(screen.getByRole("button", { name: "Incluir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pular por agora" })).toBeInTheDocument();
    expect(screen.getByText(/Envie o PDF para liberar a decisao de inclusao/)).toBeInTheDocument();
  });
});

