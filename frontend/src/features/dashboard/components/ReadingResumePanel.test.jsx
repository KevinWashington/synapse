import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import ReadingResumePanel from "./ReadingResumePanel";
it("has an explicit first-session state without a fake resume link", () => {
  render(<MemoryRouter><ReadingResumePanel resume={{ article: null, loading: false }} /></MemoryRouter>);
  expect(screen.getByText(/neste dispositivo/)).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("links to the current workflow, not the stored phase", () => {
  render(<MemoryRouter><ReadingResumePanel resume={{ article: { id: 9, projectId: 7, title: "Study", reviewOutcome: "included" }, project: { title: "Review" }, workspace: "notas" }} /></MemoryRouter>);
  expect(screen.getByRole("link").getAttribute("href")).toContain("flow=included&workspace=extracao");
});
