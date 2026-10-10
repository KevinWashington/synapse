import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

const MODES = [["rqs", "Perguntas de pesquisa"], ["matrix", "Matriz de extração"], ["visualizations", "Visualizações"], ["quality", "Avaliação da qualidade"]];

export default function SynthesisHeader({ mode, onModeChange, overview, loading, onRefresh, onExport }) {
  return <header className="space-y-4 border-b border-[var(--syn-border)] pb-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--syn-accent)]">Evidências rastreáveis</p><h1 className="mt-1 text-2xl font-semibold text-[var(--syn-text-primary)]">Síntese da revisão</h1><p className="mt-1 text-sm text-[var(--syn-text-secondary)]">Transforme dados extraídos em respostas sustentadas</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={onRefresh} disabled={loading} aria-label="Atualizar síntese"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button><Button size="sm" variant="outline" className="gap-2" onClick={onExport}><Download className="h-4 w-4" /> Exportar</Button></div></div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="Estudos incluídos" value={overview?.includedCount ?? "—"} /><Metric label="Extração concluída" value={overview?.extractedCount ?? "—"} /><Metric label="RQs com evidência" value={`${overview?.coveredRQCount ?? 0}/${overview?.researchQuestionCount ?? 0}`} /><Metric label="Qualidade avaliada" value={overview?.qualityAssessedCount ?? "—"} /></div>
    <nav className="flex max-w-full gap-1 overflow-x-auto border-b border-[var(--syn-border)]" aria-label="Modos de síntese">{MODES.map(([key, label]) => <button key={key} type="button" aria-current={mode === key ? "page" : undefined} className={`shrink-0 border-b-2 px-3 py-2.5 text-sm ${mode === key ? "border-[var(--syn-accent)] font-semibold text-[var(--syn-accent)]" : "border-transparent text-[var(--syn-text-secondary)] hover:text-[var(--syn-text-primary)]"}`} onClick={() => onModeChange(key)}>{label}</button>)}</nav>
  </header>;
}
function Metric({ label, value }) { return <div className="min-w-0 rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] px-3 py-2"><p className="truncate text-xs text-[var(--syn-text-secondary)]">{label}</p><p className="mt-1 text-lg font-semibold text-[var(--syn-text-primary)]">{value}</p></div>; }
