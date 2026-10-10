import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageTitleProvider } from "@/context/pageTitleContext";
import ProjectDetails from "./ProjectDetails";
import { apiService } from "@/services/api";

const mocks = vi.hoisted(() => ({
  setActiveTab: vi.fn(),
  navigate: vi.fn(),
  activeTab: "planejamento",
  projectId: 7,
  capabilities: [],
}));

vi.mock("@/features/projects", () => ({
  EditProjectPanel: () => null,
  ProjectDetailsHeader: ({ onTabChange, notifications }) => (
    <nav>
      <button type="button" onClick={() => onTabChange("artigos")}>
        Artigos
      </button>
      <button type="button" onClick={() => onTabChange("equipe")}>
        Equipe
      </button>
      {notifications}
    </nav>
  ),
  ProjectOverview: () => <div>Visão geral</div>,
  useProjectDetailsPage: () => ({
    activeTab: mocks.activeTab,
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
    navigate: mocks.navigate,
    project: {
      id: mocks.projectId,
      title: "Revisão de saúde",
      objetivo: "Objetivo",
      capabilities: mocks.capabilities,
    },
    setActiveTab: mocks.setActiveTab,
    setEditData: vi.fn(),
    setEditOpen: vi.fn(),
  }),
}));

vi.mock("@features/projects/components/ProjectPlanning", () => ({
  default: ({ onDirtyChange }) => (
    <div>
      <span>Formulário de planejamento</span>
      <button type="button" onClick={() => onDirtyChange(true)}>
        Alterar planejamento
      </button>
    </div>
  ),
}));

vi.mock("@features/articles/components/ProjectArticles", () => ({
  default: () => null,
}));
vi.mock("@features/articles/components/ProjectPrismaFlow", () => ({
  default: () => null,
}));
vi.mock("@features/projects/components/ProjectAnalytics", () => ({
  default: () => null,
}));
vi.mock("@features/articles/components/SynthesisWorkspacePanel", () => ({
  default: ({ onDirtyChange }) => (
    <div>
      <span>Workspace de síntese</span>
      <button type="button" onClick={() => onDirtyChange(true)}>Editar síntese</button>
    </div>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <PageTitleProvider>
        <ProjectDetails />
      </PageTitleProvider>
    </MemoryRouter>,
  );
}

async function makePlanningDirty() {
  fireEvent.click(
    await screen.findByRole("button", { name: "Alterar planejamento" }),
  );
}

describe("ProjectDetails unsaved Planning navigation", () => {
  beforeEach(() => {
    mocks.setActiveTab.mockReset();
    mocks.navigate.mockReset();
    mocks.activeTab = "planejamento";
    mocks.projectId = 7;
    mocks.capabilities = [];
    vi.spyOn(apiService, "get").mockImplementation(async (url) =>
      url.endsWith("/members")
        ? {
            members: [
              {
                id: null,
                userId: 1,
                name: "Ana",
                email: "ana@example.com",
                role: "owner",
                status: "active",
                participatesInReview: true,
              },
            ],
            invitations: [],
          }
        : [
            {
              id: 5,
              title: "Artigo atribuído",
              body: "Revise o artigo",
              entityType: "article",
              entityId: 9,
              readAt: null,
            },
          ],
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens the paged synthesis workspace without fetching the legacy whole report", async () => {
    mocks.activeTab = "sintese";
    renderPage();
    expect(await screen.findByText("Workspace de síntese")).toBeInTheDocument();
    expect(vi.mocked(apiService.get).mock.calls.map(([url]) => url)).not.toContain(
      "/api/projetos/7/artigos/synthesis-report",
    );
  });

  it("protects a dirty synthesis when leaving the project tab", async () => {
    mocks.activeTab = "sintese";
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Editar síntese" }));
    fireEvent.click(screen.getByRole("button", { name: "Artigos" }));
    expect(await screen.findByRole("heading", { name: "Sair sem salvar?" })).toBeInTheDocument();
    expect(mocks.setActiveTab).not.toHaveBeenCalled();
  });

  it("asks before leaving dirty Planning", async () => {
    renderPage();
    await makePlanningDirty();

    fireEvent.click(screen.getByRole("button", { name: "Artigos" }));

    expect(
      await screen.findByRole("heading", { name: "Sair sem salvar?" }),
    ).toBeInTheDocument();
    expect(mocks.setActiveTab).not.toHaveBeenCalled();
  });

  it("cancel keeps the Planning tab and edits", async () => {
    renderPage();
    await makePlanningDirty();
    fireEvent.click(screen.getByRole("button", { name: "Artigos" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Continuar editando" }),
    );

    expect(screen.getByText("Formulário de planejamento")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sair sem salvar?" }),
    ).not.toBeInTheDocument();
    expect(mocks.setActiveTab).not.toHaveBeenCalled();
  });

  it("confirm opens the requested tab", async () => {
    renderPage();
    await makePlanningDirty();
    fireEvent.click(screen.getByRole("button", { name: "Artigos" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Sair sem salvar" }),
    );

    expect(mocks.setActiveTab).toHaveBeenCalledWith("artigos");
  });

  it("registers beforeunload only while dirty", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderPage();

    expect(addEventListener).not.toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
    await makePlanningDirty();
    await waitFor(() =>
      expect(addEventListener).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function),
      ),
    );

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });

  it("keeps the planning guard on Equipe navigation", async () => {
    renderPage();
    await makePlanningDirty();
    fireEvent.click(screen.getByRole("button", { name: "Equipe" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.setActiveTab).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sair sem salvar" }));
    expect(mocks.setActiveTab).toHaveBeenCalledWith("equipe");
  });
  it("loads the project team without the retired project notification feed", async () => {
    mocks.activeTab = "equipe";
    renderPage();
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(vi.mocked(apiService.get).mock.calls.map(([url]) => url)).toEqual([
      "/api/projetos/7/members",
    ]);
  });
  it("discards an open team editor when the project changes", async () => {
    mocks.activeTab = "equipe";
    mocks.capabilities = ["manage_members"];
    const { rerender } = renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Convidar pessoa" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    mocks.projectId = 8;
    rerender(
      <MemoryRouter>
        <PageTitleProvider>
          <ProjectDetails />
        </PageTitleProvider>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
