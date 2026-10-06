import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectService } from "@/features/projects/services/projectService";
import ProjectOverview from "./ProjectOverview";

const overview = {
  prismaStats: { identified: 1093, screening: 110, eligible: 3, included: 0 },
  reviewerAgreement: { rate: 100, agreed: 4, reviewed: 4 },
  sources: [{ sourceCategory: "database", sourceName: "Scopus", total: 1093 }],
  evolution: [],
  recentActivities: [],
  studyTypes: [],
  planningSummary: {
    framework: "PICOC",
    searchStringCount: 1,
    inclusionCriteriaCount: 2,
    exclusionCriteriaCount: 2,
    extractionFieldCount: 3,
  },
};

describe("ProjectOverview layout", () => {
  beforeEach(() => {
    vi.spyOn(projectService, "getProjectOverview").mockResolvedValue(overview);
  });

  it("uses balanced desktop columns for sources, evolution, and recent activity", async () => {
    render(
      <ProjectOverview
        onGoToScreening={vi.fn()}
        onImportArticles={vi.fn()}
        onOpenArticle={vi.fn()}
        onOpenPlanning={vi.fn()}
        onViewFlow={vi.fn()}
        project={{ id: 7, prismaStats: overview.prismaStats }}
      />
    );

    expect(await screen.findByText("Fontes de dados")).toBeInTheDocument();
    expect(screen.getByTestId("overview-supporting-grid")).toHaveClass("xl:grid-cols-3");
    expect(screen.getByTestId("overview-data-sources")).toHaveClass("min-h-[280px]");
    expect(screen.getByTestId("overview-evolution")).toHaveClass("min-h-[280px]");
    expect(screen.getByTestId("overview-activities")).toHaveClass("min-h-[280px]");
  });
});
