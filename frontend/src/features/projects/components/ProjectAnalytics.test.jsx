import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectAnalytics from "./ProjectAnalytics";
import { articleService } from "@/features/articles/services/articleService";
import { synthesisService } from "@/features/articles/services/synthesisService";
import { projectService } from "@/features/projects/services/projectService";

vi.mock("@/features/articles/services/articleService", () => ({ articleService: { getArticlesByProject: vi.fn(), getProjectGraph: vi.fn(), exportSelectionReport: vi.fn() } }));
vi.mock("@/features/articles/services/synthesisService", () => ({ synthesisService: { getChartCatalog: vi.fn(), getChart: vi.fn() } }));
vi.mock("@/features/projects/services/projectService", () => ({ projectService: { getProjectOverview: vi.fn() } }));

describe("analytics workspace", () => {
  beforeEach(() => {
    articleService.getArticlesByProject.mockResolvedValue({ articles: [], total: 0, limit: 500 });
    articleService.getProjectGraph.mockResolvedValue({ nodes: [], links: [] });
    projectService.getProjectOverview.mockResolvedValue({});
    synthesisService.getChartCatalog.mockResolvedValue([]);
  });
  it("separates general charts, question visualizations and article relationships in one workspace", async () => {
    render(<ProjectAnalytics project={{ id: 2 }} />);
    const navigation = await screen.findByRole("navigation", { name: "Seções de gráficos" });
    expect(screen.getByRole("heading", { name: "Publicações por ano" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Período" })).toBeVisible();
    fireEvent.click(within(navigation).getByRole("button", { name: "Perguntas de pesquisa" }));
    expect(screen.queryByRole("heading", { name: "Publicações por ano" })).not.toBeInTheDocument();
    expect(screen.getByText(/Cadastre perguntas e campos/)).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Período" })).not.toBeInTheDocument();
    fireEvent.click(within(navigation).getByRole("button", { name: "Relações entre artigos" }));
    expect(await screen.findByText(/Adicione artigos ao projeto/)).toBeVisible();
    fireEvent.click(within(navigation).getByRole("button", { name: "Panorama" }));
    expect(screen.getByRole("heading", { name: "Publicações por ano" })).toBeVisible();
  });
  it("keeps report export available as an explicit action", async () => {
    articleService.exportSelectionReport.mockResolvedValue();
    render(<ProjectAnalytics project={{ id: 2 }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Exportar relatório" }));
    expect(articleService.exportSelectionReport).toHaveBeenCalledWith(2, "csv");
  });
});
