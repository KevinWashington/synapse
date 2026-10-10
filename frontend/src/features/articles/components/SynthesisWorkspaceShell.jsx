import { useState } from "react";
import { cn } from "@/lib/utils";

const REGIONS = [
  { key: "index", label: "Lista" },
  { key: "content", label: "Conteúdo" },
  { key: "context", label: "Contexto" },
];

export default function SynthesisWorkspaceShell({ index, content, context, navigation }) {
  const [region, setRegion] = useState("content");
  const panels = { index, content, context };
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#e2e6ef] bg-white">
      {navigation}
      <div role="tablist" aria-label="Regiões do workspace" className="grid grid-cols-3 border-b border-[#edf0f7] bg-[#fbfcff] xl:hidden">
        {REGIONS.map((item) => (
          <button
            key={item.key}
            id={`synthesis-region-tab-${item.key}`}
            type="button"
            role="tab"
            aria-controls={`synthesis-region-${item.key}`}
            aria-selected={region === item.key}
            onClick={() => setRegion(item.key)}
            className={cn(
              "border-b-2 px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff] focus-visible:ring-inset",
              region === item.key ? "border-[#6259ff] bg-white text-[#554bea]" : "border-transparent text-[#667391] hover:text-[#111936]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid min-w-0 xl:grid-cols-[minmax(250px,0.72fr)_minmax(0,1.45fr)_minmax(280px,0.83fr)]">
        {REGIONS.map((item) => (
          <section
            key={item.key}
            id={`synthesis-region-${item.key}`}
            role="tabpanel"
            aria-label={item.label}
            aria-labelledby={`synthesis-region-tab-${item.key}`}
            className={cn(
              "min-h-0 min-w-0 overflow-hidden",
              item.key !== "index" && "xl:border-l xl:border-[#edf0f7]",
              item.key === "context" && "bg-[#fbfcff]",
              item.key !== region && "hidden xl:block",
            )}
          >
            <div className="h-[min(72vh,900px)] min-h-[520px] overflow-y-auto">{panels[item.key]}</div>
          </section>
        ))}
      </div>
    </section>
  );
}
