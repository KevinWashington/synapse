import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PageTitleProvider } from "@/context/pageTitleContext";
import Projects from "./Projects";

const projects = [
  {
    id: 1,
    title: "Zeta",
    objetivo: "Projeto mais recente",
    status: "em-progresso",
    updatedAt: "2026-10-07T12:00:00Z",
    prismaStats: { identified: 10, screening: 4, eligible: 2, included: 1 },
  },
  {
    id: 2,
    title: "Alfa",
    objetivo: "Projeto mais antigo",
    status: "ideia",
    updatedAt: "2026-10-01T12:00:00Z",
    prismaStats: { identified: 8, screening: 3, eligible: 1, included: 0 },
  },
];

const projectPageState = {
  editData: {},
  editLoading: false,
  editOpen: false,
  error: null,
  handleDeleteProject: vi.fn(),
  handleEditProject: vi.fn(),
  handleProjectClick: vi.fn(),
  handleSaveEdit: vi.fn(),
  loadProjects: vi.fn(),
  loading: false,
  projects,
  searchTerm: "",
  setEditData: vi.fn(),
  setEditOpen: vi.fn(),
  setSearchTerm: vi.fn(),
  setShowNewProjectModal: vi.fn(),
  showNewProjectModal: false,
};

vi.mock("@features/projects/public/components", () => ({
  EditProjectPanel: () => null,
  NewProjectModal: () => null,
  useProjectsPage: () => projectPageState,
}));
vi.mock("@features/projects/public/hooks", () => ({
  EditProjectPanel: () => null,
  NewProjectModal: () => null,
  useProjectsPage: () => projectPageState,
}));

describe("Projects", () => {
  it("exposes an accessible project search control", () => {
    render(
      <MemoryRouter>
        <PageTitleProvider>
          <Projects />
        </PageTitleProvider>
      </MemoryRouter>
    );

    const search = screen.getByRole("searchbox", { name: "Buscar projetos" });
    fireEvent.change(search, { target: { value: "saúde" } });

    expect(search).toHaveAttribute("placeholder", "Buscar projetos...");
    expect(projectPageState.setSearchTerm).toHaveBeenCalledWith("saúde");
  });

  it("sorts projects through the shared select", async () => {
    render(
      <MemoryRouter>
        <PageTitleProvider>
          <Projects />
        </PageTitleProvider>
      </MemoryRouter>
    );

    const sortingControl = screen.getByRole("combobox", { name: "Ordenar projetos" });
    expect(sortingControl.tagName).toBe("BUTTON");
    expect(sortingControl).toHaveAttribute("data-state", "closed");

    fireEvent.keyDown(sortingControl, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Título" }));

    const projectHeadings = within(screen.getByRole("table")).getAllByRole("heading", { level: 3 });
    expect(projectHeadings.map((heading) => heading.textContent)).toEqual(["Alfa", "Zeta"]);
  });
});
