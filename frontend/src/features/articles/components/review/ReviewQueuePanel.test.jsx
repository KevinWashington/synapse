import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReviewQueuePanel, { getFilterOptions } from "./ReviewQueuePanel";

const article = {
  id: 1,
  title: "Estudo controlado",
  authors: "Autora Teste",
  year: 2024,
  journal: "Journal",
  sourceName: "Scopus",
  sourceCategory: "database",
  currentPhase: "screening",
  reviewOutcome: "active",
  screeningDecision: "pending",
};

function renderQueue(overrides = {}) {
  render(
    <ReviewQueuePanel
      activeFilter="all"
      activeStage="identification"
      articlePage={1}
      articlePageSize={20}
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

describe("ReviewQueuePanel", () => {
  it("keeps the server total and pagination independent from the loaded page", () => {
    renderQueue();

    expect(screen.getByText("1.093 na fila")).toBeInTheDocument();
    expect(screen.getByText("1 exibido de 1.093")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 55")).toBeInTheDocument();
  });

  it("marks the selected article in the queue", () => {
    renderQueue({ activeStage: "screening" });

    expect(screen.getByTestId("stage-article-row")).toHaveAttribute("data-selected", "true");
  });

  it("renders bulk selection only during Identification", () => {
    const { rerender } = render(
      <ReviewQueuePanel
        activeFilter="all"
        activeStage="identification"
        articlePage={1}
        articlePageSize={20}
        articleTotal={1}
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
      />
    );

    expect(screen.getByRole("checkbox", { name: "Selecionar todos os artigos visiveis" })).toBeInTheDocument();

    rerender(
      <ReviewQueuePanel
        activeFilter="all"
        activeStage="screening"
        articlePage={1}
        articlePageSize={20}
        articleTotal={1}
        articles={[article]}
        duplicateIds={new Set()}
        filterOptions={[{ key: "all", label: "Na fila", count: 1 }]}
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
        summary={{ screening: { total: 1 } }}
      />
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps article metadata readable on narrow rows", () => {
    renderQueue({ activeStage: "screening" });

    const row = screen.getByTestId("stage-article-row");
    expect(row).toHaveClass("min-w-0");
    expect(row.querySelector(".max-w-44")).not.toBeInTheDocument();
  });

  it("places a short collaborative status below the article metadata", () => {
    renderQueue({
      activeStage: "eligibility",
      articles: [{
        ...article,
        currentPhase: "eligibility",
        hasActiveReviewAssignments: true,
        reviewState: "waiting_for_reviewer",
        myReviewAssignment: { status: "pending" },
      }],
    });

    const articleButton = screen.getByText("Estudo controlado").closest("button");
    expect(within(articleButton).getByText("Minha vez")).toBeInTheDocument();
  });

  it("shows extraction progress in the included queue", () => {
    renderQueue({
      activeStage: "included",
      articles: [{ ...article, extractionData: { sample: "120" }, reviewOutcome: "included" }],
      extractionSchema: [{ key: "sample" }, { key: "result" }],
    });

    expect(screen.getByText("Em andamento 1/2")).toBeInTheDocument();
  });

  it.each(["screening", "eligibility"])(
    "offers the assigned queue without inventing a page-derived total for %s",
    (stage) => {
      expect(getFilterOptions(stage, new Set(), [article], 124)).toEqual([
        { key: "all", label: "Na fila", count: 124 },
        { key: "assigned", label: "Atribuídos a mim" },
      ]);
    }
  );
});
