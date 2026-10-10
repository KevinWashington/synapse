import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlanningAccordionSection from "./PlanningAccordionSection";
import PlanningEditorHeader from "./PlanningEditorHeader";
import PlanningSectionSearch from "./PlanningSectionSearch";
import PlanningTabs from "./PlanningTabs";

const tabs = [
  { key: "foundation", label: "Fundação", completed: 1, total: 2 },
  { key: "selection", label: "Seleção", completed: 2, total: 3 },
  { key: "data", label: "Dados", completed: 0, total: 2 },
];

const sections = [
  {
    key: "framework",
    tab: "foundation",
    label: "PICOC",
    description: "Defina a pergunta estruturada.",
    keywords: ["framework", "população"],
    complete: true,
    summary: "5 de 5 campos obrigatórios",
  },
  {
    key: "screening-guidance",
    tab: "selection",
    label: "Guia para triagem",
    description: "Oriente a avaliação.",
    keywords: ["screening", "título", "resumo"],
    complete: false,
    summary: "Não iniciado",
  },
  {
    key: "quality-criteria",
    tab: "data",
    label: "Critérios de qualidade",
    description: "Avalie a qualidade.",
    keywords: ["viés", "avaliacao"],
    complete: false,
    summary: "0 critérios",
  },
];

describe("compact planning shell", () => {
  it("shows compact progress and reports header actions", () => {
    const onExport = vi.fn();
    const onOpenSearch = vi.fn();
    render(
      <PlanningEditorHeader completed={4} onExport={onExport} onOpenSearch={onOpenSearch} percent={57} total={7} />
    );

    expect(screen.getByRole("heading", { name: "Configurar protocolo" })).toBeInTheDocument();
    expect(screen.getByText("4 de 7 seções completas")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "57");
    fireEvent.click(screen.getByRole("button", { name: "Buscar seção" }));
    fireEvent.click(screen.getByRole("button", { name: "Exportar planejamento" }));
    expect(onOpenSearch).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("contains header, tabs, and accordion actions at mobile width", () => {
    const { rerender } = render(
      <PlanningEditorHeader completed={1} onExport={vi.fn()} onOpenSearch={vi.fn()} percent={14} total={7} />
    );

    expect(screen.getByRole("button", { name: /Buscar se/ }).parentElement).toHaveClass("w-full", "sm:w-auto");

    rerender(
      <PlanningTabs
        activeTab="foundation"
        onTabChange={vi.fn()}
        panels={{ foundation: null, selection: null, data: null }}
        tabs={tabs}
      />
    );
    expect(screen.getByRole("tablist")).toHaveClass("min-w-0", "grid-cols-3");

    rerender(
      <PlanningAccordionSection
        actions={<button type="button">Gerar conteúdo</button>}
        expanded
        onExpandedChange={vi.fn()}
        section={sections[0]}
      >
        <p>Editor</p>
      </PlanningAccordionSection>
    );
    expect(screen.getByRole("button", { name: "Gerar conteúdo" }).parentElement).toHaveClass("w-full", "sm:w-auto");
  });

  it("keeps every tab panel mounted and exposes completion in tab labels", () => {
    const onTabChange = vi.fn();
    render(
      <PlanningTabs
        activeTab="foundation"
        onTabChange={onTabChange}
        panels={{
          foundation: <input aria-label="Rascunho da fundação" defaultValue="preservar" />,
          selection: <p>Selection panel</p>,
          data: <p>Data panel</p>,
        }}
        tabs={tabs}
      />
    );

    expect(screen.getByRole("tab", { name: /Fundação.*1 de 2/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: /Fundação/ })).not.toHaveAttribute("hidden");
    expect(document.querySelector("#planning-panel-selection")).toHaveAttribute("hidden");
    expect(screen.getByLabelText("Rascunho da fundação")).toHaveValue("preservar");
    fireEvent.click(screen.getByRole("tab", { name: /Dados.*0 de 2/ }));
    expect(onTabChange).toHaveBeenCalledWith("data");
  });

  it("controls accordion expansion while keeping its editor mounted", () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <PlanningAccordionSection expanded onExpandedChange={onExpandedChange} section={sections[0]}>
        <input aria-label="Campo PICOC" defaultValue="Pessoas idosas" />
      </PlanningAccordionSection>
    );

    const trigger = screen.getByRole("button", { name: /PICOC/ });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(trigger);
    expect(onExpandedChange).toHaveBeenCalledWith(false);

    rerender(
      <PlanningAccordionSection expanded={false} onExpandedChange={onExpandedChange} section={sections[0]}>
        <input aria-label="Campo PICOC" defaultValue="Pessoas idosas" />
      </PlanningAccordionSection>
    );
    expect(document.querySelector("#planning-section-panel-framework")).toHaveAttribute("hidden");
    expect(document.querySelector('input[aria-label="Campo PICOC"]')).toHaveValue("Pessoas idosas");
  });

  it("finds sections by normalized labels and aliases", () => {
    const onSectionSelect = vi.fn();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <PlanningSectionSearch onOpenChange={onOpenChange} onSectionSelect={onSectionSelect} open sections={sections} />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar seção" }), { target: { value: "populacao" } });
    fireEvent.click(screen.getByRole("button", { name: /PICOC/ }));
    expect(onSectionSelect).toHaveBeenCalledWith("framework");
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <PlanningSectionSearch onOpenChange={onOpenChange} onSectionSelect={onSectionSelect} open sections={sections} />
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar seção" }), { target: { value: "avaliacao" } });
    expect(screen.getByRole("button", { name: /Critérios de qualidade/ })).toBeInTheDocument();
  });
});
