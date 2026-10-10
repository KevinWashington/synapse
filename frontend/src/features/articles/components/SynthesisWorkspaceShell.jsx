import { useState } from "react";

const REGIONS = ["Lista", "Conteúdo", "Contexto"];

export default function SynthesisWorkspaceShell({ index, content, context }) {
  const [region, setRegion] = useState("Conteúdo");
  const panels = { Lista: index, Conteúdo: content, Contexto: context };
  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(260px,0.9fr)_minmax(420px,1.55fr)_minmax(250px,0.8fr)]">
      <div className="xl:hidden" role="tablist" aria-label="Regiões do workspace">
        <div className="flex rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] p-1">
          {REGIONS.map((item) => <button key={item} role="tab" aria-selected={region === item} className={`flex-1 rounded-md px-2 py-2 text-sm ${region === item ? "bg-[var(--syn-bg-primary)] font-semibold text-[var(--syn-text-primary)] shadow-sm" : "text-[var(--syn-text-secondary)]"}`} onClick={() => setRegion(item)}>{item}</button>)}
        </div>
      </div>
      {REGIONS.map((item) => <section key={item} role="tabpanel" aria-label={item} className={`min-w-0 rounded-xl border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] ${item !== region ? "hidden xl:block" : ""}`}>
        <div className="max-h-[min(72vh,900px)] min-h-[420px] overflow-y-auto">{panels[item]}</div>
      </section>)}
    </div>
  );
}
