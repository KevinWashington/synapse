import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Menu from "./Menu";
import { Button } from "./ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

vi.mock("@/features/projects/services/projectService", () => ({
  projectService: {
    getAllProjects: vi.fn().mockResolvedValue({ projects: [] }),
  },
}));

describe("Menu", () => {
  it.each(["/", "/dashboard"])("marks Início as current at %s", (initialEntry) => {
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Menu />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Projetos" })).not.toHaveAttribute("aria-current");
  });

  it("does not mark Início as current on another route", () => {
    render(
      <MemoryRouter initialEntries={["/projetos"]}>
        <Menu />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Projetos" })).toHaveAttribute("aria-current", "page");
  });

  it("links the logo and mobile Início destination to home", () => {
    render(
      <MemoryRouter initialEntries={["/artigos"]}>
        <Menu />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Synapse" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
  });

  it("does not expose a redundant trash destination", () => {
    render(
      <MemoryRouter initialEntries={["/artigos"]}>
        <Menu />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Lixeira" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Biblioteca" })).toHaveAttribute("href", "/artigos");
  });

  it("marks enabled navigation actions as interactive", () => {
    render(
      <MemoryRouter>
        <Menu />
        <Button>Ação disponível</Button>
        <Button disabled>Ação indisponível</Button>
        <Select defaultValue="recent">
          <SelectTrigger aria-label="Ordenar projetos">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
          </SelectContent>
        </Select>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Projetos" })).toHaveClass("cursor-pointer");
    expect(screen.getByRole("button", { name: "Ação disponível" })).toHaveClass("cursor-pointer");
    expect(screen.getByRole("button", { name: "Ação indisponível" })).toHaveClass(
      "disabled:cursor-not-allowed"
    );
    expect(screen.getByRole("combobox", { name: "Ordenar projetos" })).toHaveClass("cursor-pointer");
  });
});
