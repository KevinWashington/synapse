import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PageTitleProvider } from "@/context/pageTitleContext";
import * as ArticlesPage from "./Articles";

const libraryState = {
  articlePage: 1,
  articlePageSize: 20,
  articleTotal: 45,
  articles: [],
  filterStatus: "todos",
  loading: false,
  openDetail: vi.fn(),
  panelOpen: false,
  projects: [{ id: 7, title: "Revisão de saúde" }],
  searchTerm: "",
  selectedArticle: null,
  selectedProjectId: "7",
  setArticlePage: vi.fn(),
  setFilterStatus: vi.fn(),
  setPanelOpen: vi.fn(),
  setSearchTerm: vi.fn(),
  setSelectedProjectId: vi.fn(),
};

vi.mock("@features/articles/public/components", () => ({
  ArticleLibraryDetailPanel: () => null,
  useArticlesLibraryPage: () => libraryState,
}));
vi.mock("@features/articles/public/hooks", () => ({
  ArticleLibraryDetailPanel: () => null,
  useArticlesLibraryPage: () => libraryState,
}));

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

  it("renders the library hierarchy without an enclosing list card", () => {
    libraryState.articles = articles;
    render(
      <MemoryRouter>
        <PageTitleProvider>
          <ArticlesPage.default />
        </PageTitleProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Biblioteca de artigos" })).toBeInTheDocument();
    expect(screen.getByTestId("library-list-surface")).not.toHaveClass("rounded-[var(--syn-radius-card)]");
    expect(screen.getByTestId("library-list-surface")).not.toHaveClass("h-[calc(100dvh-15rem)]");
    expect(screen.getByTestId("library-list-scroll")).toHaveClass("max-h-[620px]", "overflow-y-auto");
    expect(screen.getByRole("button", { name: "Abrir Artigo 1" })).toHaveClass("cursor-pointer");
  });

  it("exposes an accessible article search control", () => {
    render(
      <MemoryRouter>
        <PageTitleProvider>
          <ArticlesPage.default />
        </PageTitleProvider>
      </MemoryRouter>
    );

    const search = screen.getByRole("searchbox", { name: "Pesquisar artigos" });
    fireEvent.change(search, { target: { value: "evidência" } });

    expect(search).toHaveAttribute("placeholder", "Pesquisar artigos...");
    expect(libraryState.setSearchTerm).toHaveBeenCalledWith("evidência");
  });

  it("keeps excluded articles reachable from the status filter", async () => {
    render(
      <MemoryRouter>
        <PageTitleProvider>
          <ArticlesPage.default />
        </PageTitleProvider>
      </MemoryRouter>
    );

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Status dos artigos" }), {
      key: "ArrowDown",
    });
    fireEvent.click(await screen.findByRole("option", { name: "Excluído" }));
    expect(libraryState.setFilterStatus).toHaveBeenCalledWith("excluido");
  });

  it("disables pagination for empty and single-page results", () => {
    const { rerender } = render(
      <ArticlesPage.ArticleLibraryList
        articles={[]}
        loading={false}
        onOpenArticle={vi.fn()}
        onPageChange={vi.fn()}
        page={1}
        pageSize={20}
        total={0}
      />
    );

    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();

    rerender(
      <ArticlesPage.ArticleLibraryList
        articles={articles.slice(0, 1)}
        loading={false}
        onOpenArticle={vi.fn()}
        onPageChange={vi.fn()}
        page={1}
        pageSize={20}
        total={1}
      />
    );

    expect(screen.getByText("Página 1 de 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
  });
});
