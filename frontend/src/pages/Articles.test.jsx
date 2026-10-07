import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as ArticlesPage from "./Articles";

const articles = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1,
  title: `Artigo ${index + 1}`,
  authors: "Autora Teste",
  year: 2024,
  journal: "Journal de Teste",
  sourceName: "Scopus",
  status: "pendente",
  currentPhase: "screening",
  reviewOutcome: "active",
  hasPdf: index === 0,
}));

describe("article library list", () => {
  it("renders a compact page with the real total and working pagination", () => {
    const ArticleLibraryList = ArticlesPage.ArticleLibraryList;
    const onPageChange = vi.fn();
    render(ArticleLibraryList ? (
      <ArticleLibraryList
        articles={articles}
        loading={false}
        onOpenArticle={vi.fn()}
        onPageChange={onPageChange}
        page={1}
        pageSize={20}
        total={45}
      />
    ) : <div />);

    expect(screen.getAllByTestId("library-article-card")).toHaveLength(20);
    expect(screen.getByText("Mostrando 1–20 de 45 artigos")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(screen.getAllByText("Scopus")).toHaveLength(20);

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
