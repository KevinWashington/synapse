import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import ReviewSummaryHeader from "@/components/layout/ReviewSummaryHeader";

const MODES = [
  ["rqs", "Perguntas de pesquisa"],
  ["matrix", "Matriz de extração"],
  ["visualizations", "Visualizações"],
  ["quality", "Avaliação da qualidade"],
];

export function SynthesisModeNavigation({ mode, onModeChange }) {
  return (
    <nav aria-label="Modos de síntese" className="grid min-w-0 grid-cols-2 border-b border-[#e7ebf4] bg-[#fbfcff] lg:grid-cols-4">
      {MODES.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-current={mode === key ? "page" : undefined}
          onClick={() => onModeChange(key)}
          className={cn(
            "min-w-0 border-b-2 px-3 py-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff] focus-visible:ring-inset sm:text-sm",
            mode === key ? "border-[#6259ff] bg-white text-[#554bea]" : "border-transparent text-[#667391] hover:text-[#111936]",
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
export default function SynthesisHeader({ overview, loading, onRefresh, onExport }) {
  return (
    <ReviewSummaryHeader
      title="Síntese da revisão"
      description="Transforme dados extraídos em respostas sustentadas."
      actions={<div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onRefresh} disabled={loading} aria-label="Atualizar síntese" className="gap-2 border-[#dfe4ef] bg-white">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
          <details className="relative">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-[#dfe4ef] bg-white px-3 text-sm font-medium shadow-xs hover:bg-[#f4f6fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]">
              <Download className="h-4 w-4" /> Exportar
            </summary>
            <div className="absolute right-0 z-30 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-lg border border-[#e2e6ef] bg-white p-2 shadow-xl">
              {[["matrix.csv", "Matriz CSV"], ["report.json", "Relatório JSON"], ["distributions.csv", "Distribuições CSV"], ["quality.csv", "Qualidade CSV"]].map(([kind, label]) => (
                <div key={kind} className="border-b border-[#edf0f7] py-2 last:border-0">
                  <p className="px-2 pb-1 text-xs font-semibold text-[#667391]">{label}</p>
                  <div className="flex gap-1">
                    <button type="button" className="flex-1 rounded px-2 py-1.5 text-left text-xs hover:bg-[#f4f6fb]" onClick={() => onExport(kind, "filtered")}>Filtros atuais</button>
                    <button type="button" className="flex-1 rounded px-2 py-1.5 text-left text-xs hover:bg-[#f4f6fb]" onClick={() => onExport(kind, "full")}>Tudo</button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>}
      metrics={[
        { label: "Estudos incluídos", value: overview?.includedCount ?? "—" },
        { label: "Com dados extraídos", value: overview?.extractedCount ?? "—" },
        { label: "RQs com evidência", value: overview ? `${overview.coveredRQCount}/${overview.researchQuestionCount}` : "—" },
        { label: "Qualidade avaliada", value: overview?.qualityAssessedCount ?? "—" },
      ]}
    />
  );
}
