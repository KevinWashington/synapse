import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageTitleProvider } from "@/context/pageTitleContext";
import ProjectDetails from "./ProjectDetails";

const mocks = vi.hoisted(() => ({
  setActiveTab: vi.fn(),
}));

vi.mock("@/features/projects", () => ({
  EditProjectPanel: () => null,
  ProjectDetailsHeader: ({ onTabChange }) => (
    <nav>
      <button type="button" onClick={() => onTabChange("artigos")}>Artigos</button>
    </nav>
  ),
  ProjectOverview: () => <div>Visão geral</div>,
  useProjectDetailsPage: () => ({
    activeTab: "planejamento",
    editData: {},
    editLoading: false,
    editOpen: false,
    error: null,
    graphRefreshToken: 0,
    handleEditProject: vi.fn(),
    handleGraphNeedsRefresh: vi.fn(),
    handleProjectUpdated: vi.fn(),
    handleSaveEdit: vi.fn(),
    loading: false,
    navigate: vi.fn(),
    project: { id: 7, title: "Revisão de saúde", objetivo: "Objetivo" },
    setActiveTab: mocks.setActiveTab,
    setEditData: vi.fn(),
    setEditOpen: vi.fn(),
  }),
}));

vi.mock("@features/projects/components/ProjectPlanning", () => ({
  default: ({ onDirtyChange }) => (
    <div>
      <span>Formulário de planejamento</span>
      <button type="button" onClick={() => onDirtyChange(true)}>Alterar planejamento</button>
    </div>
  ),
}));

vi.mock("@features/articles/components/ProjectArticles", () => ({ default: () => null }));
vi.mock("@features/articles/components/ProjectPrismaFlow", () => ({ default: () => null }));
vi.mock("@features/projects/components/ProjectAnalytics", () => ({ default: () => null }));
vi.mock("@features/articles/components/SynthesisReportPanel", () => ({ default: () => null }));
vi.mock("@features/articles/services/articleService", () => ({
  articleService: { getProjectSynthesisReport: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <PageTitleProvider>
        <ProjectDetails />
      </PageTitleProvider>
    </MemoryRouter>
  );
}

async function makePlanningDirty() {
  fireEvent.click(await screen.findByRole("button", { name: "Alterar planejamento" }));
}

describe("ProjectDetails unsaved Planning navigation", () => {
  beforeEach(() => mocks.setActiveTab.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("asks before leaving dirty Planning", async () => {
    renderPage();
    await makePlanningDirty();

    fireEvent.click(screen.getByRole("button", { name: "Artigos" }));

    expect(await screen.findByRole("heading", { name: "Sair sem salvar?" })).toBeInTheDocument();
    expect(mocks.setActiveTab).not.toHaveBeenCalled();
  });

  it("cancel keeps the Planning tab and edits", async () => {
    renderPage();
    await makePlanningDirty();
    fireEvent.click(screen.getByRole("button", { name: "Artigos" }));

    fireEvent.click(await screen.findByRole("button", { name: "Continuar editando" }));

    expect(screen.getByText("Formulário de planejamento")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sair sem salvar?" })).not.toBeInTheDocument();
    expect(mocks.setActiveTab).not.toHaveBeenCalled();
  });

  it("confirm opens the requested tab", async () => {
    renderPage();
    await makePlanningDirty();
    fireEvent.click(screen.getByRole("button", { name: "Artigos" }));

    fireEvent.click(await screen.findByRole("button", { name: "Sair sem salvar" }));

    expect(mocks.setActiveTab).toHaveBeenCalledWith("artigos");
  });

  it("registers beforeunload only while dirty", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderPage();

    expect(addEventListener).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    await makePlanningDirty();
    await waitFor(() =>
      expect(addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function))
    );

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});
