import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectService } from "@/features/projects/services/projectService";
import ProjectOverview from "./ProjectOverview";

const overview = {
  prismaStats: { identified: 1093, screening: 110, eligible: 3, included: 0 },
  reviewerAgreement: { rate: 80, agreed: 8, reviewed: 10 },
  sources: Array.from({ length: 12 }, (_, index) => ({ sourceCategory: "database", sourceName: `Base ${index + 1}`, total: 20 })),
  evolution: [],
  recentActivities: [{ id: "decision-42", articleId: 42, label: "Decisão registrada", description: "Estudo sobre acesso digital", type: "eligibility", timestamp: "2026-10-10T12:00:00Z" }],
  studyTypes: [],
  planningSummary: {
    framework: "PICOC",
    searchStringCount: 1,
    inclusionCriteriaCount: 2,
    exclusionCriteriaCount: 2,
    extractionFieldCount: 3,
  },
};

const actions = { onGoToScreening: vi.fn(), onImportArticles: vi.fn(), onOpenArticle: vi.fn(), onOpenPlanning: vi.fn(), onViewFlow: vi.fn() };
function setup() { return render(<ProjectOverview {...actions} project={{ id: 7, prismaStats: overview.prismaStats }} />); }

describe("ProjectOverview workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(projectService, "getProjectOverview").mockResolvedValue(overview);
  });

  it("groups the indicators with the heading in a text-only summary", async () => {
    setup();
    await screen.findByRole("heading", { name: "Visão geral da revisão" });
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("term", { name: "Artigos identificados" })).toBeVisible();
    expect(within(header).getByText("1.093")).toBeVisible();
    expect(header.querySelector("dl svg")).toBeNull();
  });

  it("offers a direct next action and describes agreement with AI accurately", async () => {
    setup();
    await screen.findByRole("heading", { name: "Visão geral da revisão" });
    fireEvent.click(screen.getByRole("button", { name: "Revisar artigos" }));
    expect(actions.onGoToScreening).toHaveBeenCalledOnce();
    expect(screen.getByText("Concordância com a IA")).toBeInTheDocument();
    expect(screen.queryByText(/concordância entre revisores/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver fluxo PRISMA" }));
    expect(actions.onViewFlow).toHaveBeenCalledOnce();
  });

  it("makes every source accessible and opens studies from recent activities", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Fontes e atividades" }));
    expect(screen.getByText("Base 12")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Estudo sobre acesso digital/ }));
    expect(actions.onOpenArticle).toHaveBeenCalledWith(42);
    expect(screen.queryByText("Ver todas")).not.toBeInTheDocument();
  });

  it("keeps protocol details behind an explicit section and opens planning", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Protocolo e estudos" }));
    expect(screen.getByText("PICOC")).toBeVisible();
    const panel = screen.getByRole("region", { name: "Resumo do planejamento" });
    fireEvent.click(within(panel).getByRole("button", { name: "Ver planejamento" }));
    expect(actions.onOpenPlanning).toHaveBeenCalledOnce();
  });

  it("prioritizes import for an empty review", async () => {
    vi.mocked(projectService.getProjectOverview).mockResolvedValue({ ...overview, prismaStats: { identified: 0, screening: 0, eligible: 0, included: 0 } });
    setup();
    await screen.findByRole("heading", { name: "Visão geral da revisão" });
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Importar artigos" }));
    expect(actions.onImportArticles).toHaveBeenCalledOnce();
  });
});
