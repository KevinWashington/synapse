import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const SOURCE_TONES = {
  Scopus: "bg-[#ff8a00] text-white",
  "Web of Science": "bg-[#7b3fff] text-white",
  "IEEE Xplore": "bg-[#1976b9] text-white",
  ScienceDirect: "bg-[#ff7a00] text-white",
  PubMed: "bg-[#18a66a] text-white",
};

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}


function getStageCount(summary, stageKey) {
  if (stageKey === "identification") return summary?.identification?.total || 0;
  if (stageKey === "screening") return summary?.screening?.total || 0;
  if (stageKey === "eligibility") return summary?.eligibility?.total || 0;
  if (stageKey === "included") return summary?.included || 0;
  return 0;
}

function getSourceInitial(sourceName) {
  if (!sourceName) {
    return "DB";
  }

  if (sourceName === "Web of Science") return "W";
  if (sourceName === "IEEE Xplore") return "IEEE";
  if (sourceName === "ScienceDirect") return "SD";
  return sourceName.slice(0, 2).toUpperCase();
}

function SummaryDonut({ rows, total }) {
  const primary = rows[0]?.value || 0;
  const percent = total ? Math.min(100, Math.round((primary / total) * 1000) / 10) : 0;

  return (
    <div className="flex items-center gap-5">
      <div
        className="grid h-24 w-24 place-items-center rounded-full"
        style={{ background: `conic-gradient(#14a365 ${percent}%, #ff920f ${percent}% 100%)` }}
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-xl font-semibold text-[#111936]">
          {formatNumber(total)}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-[#56627f]">
              <span className={cn("h-2 w-2 rounded-full", row.dot)} />
              {row.label}
            </span>
            <span className="font-semibold text-[#111936]">{formatNumber(row.value)} ({total ? Math.round((row.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StageSidebar({
  activeStage,
  articleTotal,
  articles,
  canManageArticles = true,
  duplicateCandidates,
  onBatchEvaluate,
  onExportStage,
  onRunDedup,
  onViewFlow,
  summary,
}) {
  const duplicateIds = new Set(
    duplicateCandidates.flatMap((candidate) => candidate.candidateIds || [])
  );
  const identificationCount = articleTotal ?? articles.length;
  const count = activeStage === "identification"
    ? identificationCount
    : getStageCount(summary, activeStage);
  const extractionPending = summary?.pendingExtraction ?? 0;

  const rows = {
    identification: [
      { label: "Únicos na fila", value: Math.max(identificationCount - duplicateIds.size, 0), dot: "bg-[#14a365]" },
      { label: "Possíveis duplicatas", value: duplicateIds.size, dot: "bg-[#ff920f]" },
    ],
    screening: [
      { label: "Encaminhados", value: Math.max((summary?.screening?.total || 0) - (summary?.screening?.excluded || 0) - (summary?.screening?.active || 0), 0), dot: "bg-[#14a365]" },
      { label: "Excluidos", value: summary?.screening?.excluded || 0, dot: "bg-[#f04444]" },
      { label: "Pendentes", value: summary?.screening?.active || 0, dot: "bg-[#ff920f]" },
    ],
    eligibility: [
      { label: "Excluidos", value: summary?.eligibility?.excluded || 0, dot: "bg-[#f04444]" },
      { label: "Incluidos", value: summary?.included || 0, dot: "bg-[#14a365]" },
      { label: "Pendentes", value: summary?.eligibility?.active || 0, dot: "bg-[#a4adc2]" },
    ],
    included: [
      { label: "Incluidos", value: summary?.included || 0, dot: "bg-[#14a365]" },
      { label: "Aguarda extração", value: extractionPending, dot: "bg-[#6259ff]" },
    ],
  }[activeStage];

  return (
    <aside className="space-y-4 xl:col-span-2 2xl:col-span-1">
      <section className="rounded-lg border border-[#edf0f7] bg-white p-5">
        <h3 className="text-sm font-semibold text-[#111936]">Resumo da etapa</h3>
        <div className="mt-5">
          <SummaryDonut rows={rows} total={count} />
        </div>
      </section>

      {activeStage === "identification" ? (
        <section className="rounded-lg border border-[#edf0f7] bg-white p-5">
          <h3 className="text-sm font-semibold text-[#111936]">Fontes de dados</h3>
          <div className="mt-4 space-y-3">
            {(summary?.bySource || []).slice(0, 4).map((item) => (
              <div key={`${item.sourceCategory}-${item.sourceName}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-[#56627f]">
                  <span className={cn("grid h-6 min-w-6 place-items-center rounded px-1 text-[9px] font-bold", SOURCE_TONES[item.sourceName] || "bg-[#eef3ff] text-[#4d68ff]")}>
                    {getSourceInitial(item.sourceName)}
                  </span>
                  {item.sourceName}
                </span>
                <span className="font-semibold text-[#111936]">{formatNumber(item.total)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-[#edf0f7] bg-white p-5">
        <h3 className="text-sm font-semibold text-[#111936]">Ações rápidas</h3>
        <div className="mt-4 space-y-2">
          {activeStage === "identification" ? (
            <>
              {canManageArticles ? <Button variant="outline" className="h-10 w-full justify-between rounded-lg border-[#dfe4ef] bg-white" onClick={onRunDedup}>
                Detectar duplicatas
                <span className="rounded-full bg-[#6259ff] px-2 py-0.5 text-xs text-white">{duplicateCandidates.length}</span>
              </Button> : null}
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onExportStage}>
                Exportar etapa
              </Button>
            </>
          ) : null}
          {activeStage === "screening" ? (
            <>
              {canManageArticles ? <Button variant="outline" className="h-10 w-full justify-start gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onBatchEvaluate}>
                <SparklesIcon className="h-4 w-4" />
                Triagem IA
              </Button> : null}
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onExportStage}>
                Exportar etapa
              </Button>
            </>
          ) : null}
          {activeStage === "eligibility" ? (
            <>
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onExportStage}>
                Exportar lista desta etapa
              </Button>
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onViewFlow}>
                Ver fluxograma PRISMA
              </Button>
            </>
          ) : null}
          {activeStage === "included" ? (
            <>
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onExportStage}>
                Exportar lista de incluídos
              </Button>
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onViewFlow}>
                Ver fluxograma PRISMA
              </Button>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-[#edf0f7] bg-[#fbfaff] p-5">
        <h3 className="text-sm font-semibold text-[#6259ff]">Dica</h3>
        <p className="mt-3 text-sm leading-6 text-[#56627f]">
          {activeStage === "identification"
            ? "Revise e remova duplicatas para garantir que cada estudo seja avaliado apenas uma vez."
            : activeStage === "included"
              ? "Preencha a extração estruturada dos estudos incluídos antes da síntese final."
              : "Registre decisões com justificativas para manter a trilha de auditoria da revisão."}
        </p>
      </section>
    </aside>
  );
}


export default StageSidebar;
