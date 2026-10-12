import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import PersonalWorkPanel from "./PersonalWorkPanel";
it("links personal tasks to an assigned-only queue", () => {
  render(<MemoryRouter><PersonalWorkPanel phase="screening" setPhase={vi.fn()} page={1} setPage={vi.fn()} resource={{ data: { items: [{ assignmentId: 1, articleId: 9, projectId: 7, title: "Study", projectTitle: "Review", phase: "screening", year: 2026, journal: "Journal" }], total: 1 } }} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: /Study/ }).getAttribute("href")).toContain("assignedToMe=1");
});
it("renders explicit empty and retry states", () => {
  const reload = vi.fn();
  const props = { phase: "screening", setPhase: vi.fn(), page: 1, setPage: vi.fn() };
  const { rerender } = render(<MemoryRouter><PersonalWorkPanel {...props} resource={{ data: { items: [], total: 0 } }} /></MemoryRouter>);
  expect(screen.getByText(/Nenhum artigo atribuído/)).toBeInTheDocument();
  rerender(<MemoryRouter><PersonalWorkPanel {...props} resource={{ error: new Error("Offline"), reload }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
  expect(reload).toHaveBeenCalledOnce();
});
