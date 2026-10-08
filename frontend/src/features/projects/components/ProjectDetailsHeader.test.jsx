import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectDetailsHeader from "./ProjectDetailsHeader";

const project = {
  title: "Estratégias de inclusão digital",
  objetivo:
    "Uma descrição longa e estável que identifica o projeto em qualquer área da revisão sistemática.",
};

describe("ProjectDetailsHeader", () => {
  it("hides project editing without the capability and exposes the Equipe tab", () => {
    const onTabChange = vi.fn();
    render(
      <ProjectDetailsHeader
        activeTab="equipe"
        project={project}
        capabilities={[]}
        onTabChange={onTabChange}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Editar projeto" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Equipe" }));
    expect(onTabChange).toHaveBeenCalledWith("equipe");
  });
  it("shows project editing when the shared state grants it", () => {
    render(
      <ProjectDetailsHeader
        activeTab="overview"
        project={project}
        capabilities={["edit_project"]}
        onTabChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Editar projeto" }),
    ).toBeInTheDocument();
  });
  it.each(["overview", "planejamento", "artigos", "fluxo", "sintese", "grafo"])(
    "keeps the project identity unchanged on the %s tab",
    (activeTab) => {
      render(
        <ProjectDetailsHeader
          activeTab={activeTab}
          onEditProject={vi.fn()}
          onTabChange={vi.fn()}
          project={project}
        />,
      );

      expect(
        screen.getByRole("heading", { name: project.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(project.objetivo)).toBeInTheDocument();
    },
  );

  it("reserves a stable two-line objective area", () => {
    render(
      <ProjectDetailsHeader
        activeTab="overview"
        onEditProject={vi.fn()}
        onTabChange={vi.fn()}
        project={project}
      />,
    );

    expect(screen.getByTestId("project-objective")).toHaveClass(
      "line-clamp-2",
      "min-h-12",
    );
  });

  it("routes every project tab click through the supplied callback", () => {
    const onTabChange = vi.fn();
    render(
      <ProjectDetailsHeader
        activeTab="planejamento"
        onEditProject={vi.fn()}
        onTabChange={onTabChange}
        project={project}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Planejamento" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Artigos" })).not.toHaveAttribute(
      "aria-current",
    );

    fireEvent.click(screen.getByRole("button", { name: "Artigos" }));
    expect(onTabChange).toHaveBeenCalledWith("artigos");
  });
});
