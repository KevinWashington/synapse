import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectPrismaFlow from "./ProjectPrismaFlow";

const api = vi.hoisted(() => ({ summary: vi.fn(), report: vi.fn(), export: vi.fn() }));
vi.mock("@/features/articles/services/articleService", () => ({ articleService: {
  getSelectionSummary: api.summary, getSelectionReport: api.report, exportSelectionReport: api.export,
} }));
const report = { counts: { identified: 100, duplicatesRemoved: 10, screeningPool: 90, excludedScreening: 60, fullTextUnavailable: 2, excludedEligibility: 20, included: 8 },
  bySource: [{ sourceName: "Scopus", total: 100 }], exclusionReasons: { eligibility: [{ reason: "População fora do escopo", count: 20 }] } };
const edit = vi.fn();
function setup() { return render(<ProjectPrismaFlow project={{ id: 7, title: "Revisão" }} onEditFlow={edit} />); }
describe("ProjectPrismaFlow workspace", () => {
  beforeEach(() => { vi.clearAllMocks(); api.summary.mockResolvedValue({}); api.report.mockResolvedValue(report); });
  it("shows the diagram and offers a truthful action to review its source records", async () => {
    setup();
    expect(await screen.findByRole("region", { name: "Diagrama PRISMA" })).toBeVisible();
    expect(screen.getByText(/População fora do escopo/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Revisar registros" }));
    expect(edit).toHaveBeenCalledOnce();
  });
  it("exposes summary and sources without constraining the diagram", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Resumo e fontes" }));
    expect(screen.getByRole("region", { name: "Resumo do fluxo" })).toBeVisible();
    expect(screen.getByText("Scopus")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Diagrama PRISMA" })).not.toBeInTheDocument();
  });
  it("does not misrepresent a failed load as a zero-result diagram and allows retry", async () => {
    api.report.mockRejectedValueOnce(new Error("Sem conexão"));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão");
    expect(screen.queryByRole("region", { name: "Diagrama PRISMA" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("region", { name: "Diagrama PRISMA" })).toBeVisible();
  });
});
