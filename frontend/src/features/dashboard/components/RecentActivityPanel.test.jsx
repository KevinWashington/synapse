import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import RecentActivityPanel from "./RecentActivityPanel";
it("labels actual events and opens the article's current phase", () => {
  render(<MemoryRouter><RecentActivityPanel page={1} setPage={vi.fn()} resource={{ data: { total: 1, items: [{ id: "screening:9", articleId: 9, projectId: 7, projectTitle: "Review", title: "Study", type: "screening", phase: "eligibility", timestamp: "2026-10-10T12:00:00Z" }] } }} /></MemoryRouter>);
  expect(screen.getByText("Triagem registrada")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Study" }).getAttribute("href")).toContain("flow=eligibility");
});
