import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SynthesisReportPanel from "./SynthesisReportPanel";

const report = {
  projectId: 7,
  extractionColumns: [{ key: "resultado", label: "Resultado principal" }],
  extractionRows: [
    { articleId: 1, title: "Estudo A", rqs: [1], qualityRating: "high", values: { resultado: "Efeito positivo" } },
    { articleId: 2, title: "Estudo B", rqs: [1, 2], qualityRating: "unrated", values: {} },
    { articleId: 3, title: "Estudo C", rqs: [], qualityRating: "medium", values: {} },
  ],
  rqCount: 4,
  qualitySummary: { ratedArticles: 2, unratedArticles: 1, averageScore: 80, byRating: [], byCriterion: [] },
};

describe("SynthesisReportPanel", () => {
  it("presents the review synthesis with Portuguese labels and summary metrics", () => {
    render(
      <SynthesisReportPanel
        data={report}
        isLoading={false}
        onRefresh={vi.fn()}
        onOpenArticle={vi.fn()}
      />,
    );

    expect(screen.getByText("Síntese da revisão")).toBeInTheDocument();
    expect(screen.getByText("Estudos incluídos")).toBeInTheDocument();
    expect(screen.getByText("Com dados extraídos")).toBeInTheDocument();
    expect(screen.getByText("Perguntas cobertas")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Matriz de extração" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Visualizações" })).toBeInTheDocument();
  });
});
