import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectOverviewSection from "./ProjectOverviewSection";

const projects = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, title: `Projeto ${i + 1}`, status: "em-progresso", objetivo: "Objetivo da revisão", articleCount: 12, updatedAt: "2026-10-10T12:00:00Z" }));
const tabs = [{ key: "active", label: "Ativos", count: 8 }, { key: "completed", label: "Concluídos", count: 0 }];

describe("dashboard projects", () => {
  it("makes projects after the sixth accessible and opens a project through a keyboard-accessible control", () => {
    const onOpenProject = vi.fn();
    render(<ProjectOverviewSection activeTab="active" filteredProjects={projects} tabs={tabs} onTabChange={vi.fn()} onOpenProject={onOpenProject} loadedProjectCount={8} projectTotal={30} />);
    expect(screen.getByRole("heading", { name: "Continue sua revisão" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir Projeto 8" }));
    expect(onOpenProject).toHaveBeenCalledWith(8);
    fireEvent.click(screen.getByRole("button", { name: "Ver todos os projetos" }));
    expect(onOpenProject).toHaveBeenLastCalledWith();
  });

  it("explains an empty filter without claiming the account has no projects", () => {
    render(<ProjectOverviewSection activeTab="completed" filteredProjects={[]} tabs={tabs} onTabChange={vi.fn()} onOpenProject={vi.fn()} loadedProjectCount={8} projectTotal={30} />);
    expect(screen.getByText("Nenhum projeto neste filtro.")).toBeVisible();
    expect(screen.queryByText("Comece criando seu primeiro projeto.")).not.toBeInTheDocument();
  });
});
