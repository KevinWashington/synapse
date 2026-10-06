import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ArticleDetailPanel,
  StageListPanel,
} from "./ProjectArticles";
import * as ProjectArticlesComponents from "./ProjectArticles";

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
      articlePage={1}
      articlePageSize={100}
      articleTotal={1093}
      articles={[article]}
      duplicateIds={new Set()}
      filterOptions={[{ key: "all", label: "Todos", count: 1 }]}
      isLoading={false}
      onArticleSelect={vi.fn()}
      onFilterChange={vi.fn()}
      onOpenArticle={vi.fn()}
      onPageChange={vi.fn()}
      onPromoteAllUnique={vi.fn()}
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
  it("shows the server total separately from the loaded page", () => {
    renderList();

    expect(screen.getByText("1.093 na fila")).toBeInTheDocument();
    expect(screen.getByText("1 exibido de 1.093")).toBeInTheDocument();
  });

  it("makes bulk unique promotion primary and keeps visible selection secondary", () => {
    renderList();

    expect(screen.getByRole("button", { name: "Enviar todos os únicos para triagem" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Enviar 0 para triagem" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Selecionar todos os artigos visiveis" })).toBeInTheDocument();
  });

  it("navigates pages without pretending the first 100 are the whole queue", () => {
    const onPageChange = vi.fn();
    renderList({ onPageChange });

    screen.getByRole("button", { name: "Próxima página" }).click();

    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByText("Página 1 de 11")).toBeInTheDocument();
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

describe("duplicate review", () => {
  const candidates = [
    {
      groupKey: "doi:duplicado",
      reasonCode: "same_doi",
      reasonText: "DOI idêntico detectado automaticamente.",
      candidateIds: [11, 12],
      articles: [
        { ...article, id: 11, title: "Estudo na Scopus", doi: "10.1/teste", sourceName: "Scopus" },
        { ...article, id: 12, title: "Estudo na Web of Science", doi: "10.1/teste", sourceName: "Web of Science" },
      ],
    },
  ];

  function renderDuplicateReview(overrides = {}) {
    const DuplicateReviewPanel = ProjectArticlesComponents.DuplicateReviewPanel;
    render(DuplicateReviewPanel ? (
      <DuplicateReviewPanel
        candidates={candidates}
        onApply={vi.fn()}
        onSelectCanonical={vi.fn()}
        selectedDuplicateMap={{ "doi:duplicado": 11 }}
        {...overrides}
      />
    ) : <div />);
  }

  it("shows every candidate and explains that one record must be kept", () => {
    renderDuplicateReview();

    expect(screen.getByRole("heading", { name: "Revisar duplicatas" })).toBeInTheDocument();
    expect(screen.getByText("Estudo na Scopus")).toBeInTheDocument();
    expect(screen.getByText("Estudo na Web of Science")).toBeInTheDocument();
    expect(screen.getByText(/Escolha o registro que será mantido/)).toBeInTheDocument();
  });

  it("selects the canonical record and applies the review", () => {
    const onApply = vi.fn();
    const onSelectCanonical = vi.fn();
    renderDuplicateReview({ onApply, onSelectCanonical });

    screen.getByRole("radio", { name: "Manter Estudo na Web of Science" }).click();
    screen.getByRole("button", { name: "Confirmar revisão de duplicatas" }).click();

    expect(onSelectCanonical).toHaveBeenCalledWith("doi:duplicado", 12);
    expect(onApply).toHaveBeenCalledOnce();
  });
});
