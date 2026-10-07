import { render, screen } from "@testing-library/react";
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
