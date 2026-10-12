import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SynthesisHeader from "./SynthesisHeader";

describe("SynthesisHeader", () => {
  it("presents synthesis indicators as a text-only summary and preserves actions", () => {
    const onRefresh = vi.fn();
    const onExport = vi.fn();
    render(<SynthesisHeader overview={{ includedCount: 4, extractedCount: 0, coveredRQCount: 2, researchQuestionCount: 5, qualityAssessedCount: 2 }} onRefresh={onRefresh} onExport={onExport} />);
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("term", { name: "Com dados extraídos" })).toBeVisible();
    expect(within(header).getByRole("definition", { name: "Com dados extraídos" })).toHaveTextContent("0");
    expect(within(header).getByRole("definition", { name: "RQs com evidência" })).toHaveTextContent("2/5");
    expect(header.querySelector("dl svg")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar síntese" }));
    expect(onRefresh).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Exportar", { exact: true }));
    fireEvent.click(screen.getAllByRole("button", { name: "Filtros atuais" })[0]);
    expect(onExport).toHaveBeenCalledWith("matrix.csv", "filtered");
  });

  it("keeps unavailable metrics distinct from zero and disables refresh while loading", () => {
    render(<SynthesisHeader overview={null} loading onRefresh={vi.fn()} onExport={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Atualizar síntese" })).toBeDisabled();
    expect(screen.getByRole("definition", { name: "Estudos incluídos" })).toHaveTextContent("—");
  });
});
