import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  FilterIcon,
  LoaderIcon,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/Button";
import { articleService } from "@features/articles/public/services";
import { projectService } from "@/features/projects/services/projectService";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import ReviewSummaryHeader from "@/components/layout/ReviewSummaryHeader";

const FUNNEL_STEPS = [
  { key: "identified", label: "Identificação", color: "#6259ff" },
  { key: "screening", label: "Triagem", color: "#6259ff" },
  { key: "eligible", label: "Elegibilidade", color: "#49c987" },
  { key: "included", label: "Inclusão", color: "#ffc35a" },
];

const PIE_COLORS = ["#6259ff", "#7c73ff", "#49c987", "#ffc35a", "#ff7b7b"];

const ACTIVITY_STYLES = {
  included: "bg-[#eaf8f0] text-[#2fa060]",
  eligibility: "bg-[#eef1ff] text-[#6259ff]",
  screening: "bg-[#fff6e5] text-[#d48700]",
  created: "bg-[#edf1f7] text-[#667391]",
};

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "Sem dados";
  }

  return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("pt-BR");
}

function totalFromStats(stats) {
  return stats?.identified || 0;
}

function FunnelChart({ stats }) {
  const maxValue = Math.max(stats.identified || 0, 1);
  const steps = FUNNEL_STEPS.map((step, index) => ({
    ...step,
    value: stats[step.key] || 0,
    opacity: 1 - index * 0.08,
  }));

  return (
    <section aria-label="Progresso da revisão" className="min-w-0 p-4 sm:p-5">
      <h3 className="mb-5 text-sm font-semibold text-[#111936]">Progresso da revisão (PRISMA)</h3>
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.key}
            className="grid min-h-10 grid-cols-[minmax(0,1fr)_48px] items-center gap-3 text-sm sm:grid-cols-[minmax(0,1fr)_48px_minmax(60px,120px)]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span style={{ backgroundColor: step.color }} className="h-2 w-2 shrink-0 rounded-full" />
              <span className="truncate font-semibold text-[#253252]">{step.label}</span>
            </div>
            <span className="text-right font-semibold text-[#111936]">{formatNumber(step.value)}</span>
            <div className="hidden h-8 w-full items-center sm:flex">
              <div
                style={{
                  width: `${(step.value / maxValue) * 100}%`,
                  backgroundColor: step.color,
                  opacity: step.opacity,
                }}
                className="h-6 rounded-sm"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DataSourcesCard({ sources }) {
  return (
    <section aria-label="Fontes de dados" className="min-w-0 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#111936]">Fontes de dados</h3>
        <span className="text-xs text-[#667391]">{sources.length} fontes</span>
      </div>
      <div tabIndex={0} aria-label="Lista de fontes" className="max-h-[320px] space-y-3 overflow-y-auto rounded-sm pr-1 focus-visible:outline-2 focus-visible:outline-[#6259ff]">
        {sources.length ? sources.map((source) => (
          <div key={`${source.sourceCategory}-${source.sourceName}`} className="flex items-start justify-between gap-3 border-b border-[#edf0f7] pb-3 text-sm last:border-0">
            <span className="min-w-0 break-words text-[#253252]">{source.sourceName}</span>
            <span className="shrink-0 text-xs text-[#56627f]">{formatNumber(source.total)} artigos</span>
          </div>
        )) : (
          <p className="text-sm text-[#667391]">Nenhuma fonte registrada.</p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#edf0f7] pt-3 text-sm font-semibold text-[#111936]">
        <span>Total</span>
        <span>{formatNumber(sources.reduce((total, source) => total + source.total, 0))} artigos</span>
      </div>
    </section>
  );
}

function EvolutionCard({ evolution }) {
  return (
    <section aria-label="Evolução das etapas" className="min-w-0 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#111936]">Evolução das etapas</h3>
        <span className="text-xs text-[#56627f]">Últimas {evolution.length} datas</span>
      </div>
      {evolution.length ? (
        <div className="h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolution}>
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: "#667391" }} />
              <YAxis tick={{ fontSize: 11, fill: "#667391" }} width={36} />
              <Tooltip labelFormatter={formatDate} />
              <Line name="Identificação" type="monotone" dataKey="identification" stroke="#6259ff" strokeWidth={2} dot={false} />
              <Line name="Triagem" type="monotone" dataKey="screening" stroke="#736bff" strokeWidth={2} dot={false} />
              <Line name="Elegibilidade" type="monotone" dataKey="eligibility" stroke="#49c987" strokeWidth={2} dot={false} />
              <Line name="Inclusão" type="monotone" dataKey="included" stroke="#ffc35a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[210px] items-center justify-center text-sm text-[#667391]">
          Sem eventos suficientes para montar a evolução.
        </div>
      )}
    </section>
  );
}

function StudyTypeCard({ studyTypes, included }) {
  const chartData = studyTypes.map((item) => ({
    name: item.label,
    value: item.total,
    percentage: item.percentage,
  }));

  return (
    <section aria-label="Distribuição por tipo de estudo" className="min-w-0 p-4 sm:p-5">
      <h3 className="mb-4 text-sm font-semibold text-[#111936]">Distribuição por tipo de estudo</h3>
      <div className="grid items-center gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className="relative h-[150px]">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={46} outerRadius={70} dataKey="value" paddingAngle={2}>
                  {chartData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : null}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold text-[#111936]">{formatNumber(included)}</span>
            <span className="text-xs text-[#667391]">incluídos</span>
          </div>
        </div>
        <div className="max-h-[280px] space-y-3 overflow-y-auto">
          {chartData.length ? chartData.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-[#253252]">
                <span style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} className="h-2 w-2 rounded-full" />
                {item.name}
              </span>
              <span className="text-[#56627f]">{item.percentage}% ({item.value})</span>
            </div>
          )) : (
            <p className="text-sm text-[#667391]">Nenhum tipo registrado.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function PlanningSummaryCard({ summary, onOpenPlanning }) {
  return (
    <section aria-label="Resumo do planejamento" className="min-w-0 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#111936]">Resumo do planejamento</h3>
        <button type="button" onClick={onOpenPlanning} className="cursor-pointer rounded-sm text-xs font-semibold text-[#6259ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40">
          Ver planejamento
        </button>
      </div>
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <span className="text-[#667391]">Framework</span>
          <span className="font-medium text-[#253252]">{summary.framework}</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <span className="text-[#667391]">String de busca</span>
          <span className="font-medium text-[#253252]">{summary.searchStringCount} string(s) cadastrada(s)</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <span className="text-[#667391]">Critérios</span>
          <span className="font-medium text-[#253252]">
            {summary.inclusionCriteriaCount} inclusão / {summary.exclusionCriteriaCount} exclusão
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <span className="text-[#667391]">Extração de dados</span>
          <span className="font-medium text-[#253252]">{summary.extractionFieldCount} campo(s) configurado(s)</span>
        </div>
      </div>
    </section>
  );
}

function RecentActivitiesCard({ activities, onOpenArticle }) {
  return (
    <section aria-label="Atividades recentes" className="min-w-0 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#111936]">Atividades recentes</h3>
        <span className="text-xs text-[#667391]">{activities.length} eventos recentes</span>
      </div>
      <div tabIndex={0} aria-label="Lista de atividades recentes" className="max-h-[320px] space-y-3 overflow-y-auto rounded-sm pr-1 focus-visible:outline-2 focus-visible:outline-[#6259ff]">
        {activities.length ? activities.map((activity) => (
          <button
            key={activity.id}
            type="button"
            onClick={() => activity.articleId && onOpenArticle(activity.articleId)}
            disabled={!activity.articleId}
            className="flex w-full cursor-pointer items-start gap-3 rounded-sm text-left disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40"
          >
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", ACTIVITY_STYLES[activity.type] || ACTIVITY_STYLES.created)}>
              {activity.type === "included" ? <CheckCircle2Icon className="h-4 w-4" /> : <FileTextIcon className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-[#253252]">{activity.label}</span>
              <span className="mt-1 block line-clamp-2 text-xs text-[#667391]">{activity.description}</span>
            </span>
            <span className="shrink-0 text-[11px] text-[#8b96ad]">{formatDate(activity.timestamp)}</span>
          </button>
        )) : (
          <p className="text-sm text-[#667391]">Nenhuma atividade registrada.</p>
        )}
      </div>
    </section>
  );
}

function QuickActionsCard({ onImport, onGoToScreening, onViewFlow, onExport }) {
  const actions = [
    { label: "Importar artigos", icon: DownloadIcon, onClick: onImport },
    { label: "Ir para triagem", icon: FilterIcon, onClick: onGoToScreening },
    { label: "Ver fluxo (PRISMA)", icon: BarChart3Icon, onClick: onViewFlow },
    { label: "Exportar dados", icon: DownloadIcon, onClick: onExport },
  ];

  return (
    <section aria-label="Ações rápidas" className="min-w-0 border-t border-[#edf0f7] bg-[#fbfcff] p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-[#111936]">Ações rápidas</h3>
      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-[#253252] hover:bg-[#f7f8fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40"
          >
            <span className="flex items-center gap-3">
              <action.icon className="h-4 w-4 text-[#667391]" />
              {action.label}
            </span>
            <ArrowRightIcon className="h-4 w-4 text-[#a4adc2]" />
          </button>
        ))}
      </div>
    </section>
  );
}

function ProjectOverview({
  onGoToScreening,
  onImportArticles,
  onOpenArticle,
  onOpenPlanning,
  onViewFlow,
  project,
}) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [section, setSection] = useState("panorama");

  useEffect(() => {
    let ignore = false;

    async function loadOverview() {
      try {
        setLoading(true);
        setError(null);
        const response = await projectService.getProjectOverview(project.id);
        if (!ignore) {
          setOverview(response);
        }
      } catch (currentError) {
        if (!ignore) {
          setError(currentError.message || "Erro ao carregar visao geral");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadOverview();
    return () => {
      ignore = true;
    };
  }, [project.id]);

  const stats = useMemo(() => ({ identified: 0, screening: 0, eligible: 0, included: 0, ...(overview?.prismaStats || project.prismaStats) }), [overview?.prismaStats, project.prismaStats]);
  const total = totalFromStats(stats);

  const metricDescriptions = useMemo(() => ({
    identified: total ? "100% do total" : "Sem registros",
    screening: total ? `${formatPercent((stats.screening / total) * 100)} do total` : "Sem registros",
    eligible: total ? `${formatPercent((stats.eligible / total) * 100)} do total` : "Sem registros",
    included: total ? `${formatPercent((stats.included / total) * 100)} do total` : "Sem registros",
  }), [stats, total]);

  async function handleExport() {
    try {
      await articleService.exportSelectionReport(project.id, "csv");
      toast.success("Relatório CSV exportado.");
    } catch (currentError) {
      toast.error(`Erro ao exportar relatório: ${currentError.message}`);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#edf0f7] bg-white px-4 py-3 text-sm text-[#667391]">
        <LoaderIcon className="h-4 w-4 animate-spin" />
        Carregando visao geral...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#fee2e2] bg-[#fff1f2] p-4 text-sm text-[#be123c]">
        {error}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <ReviewSummaryHeader
        title="Visão geral da revisão"
        description="Acompanhe o andamento, consulte o contexto e continue sua revisão."
        actions={<Button className="gap-2 bg-[#6259ff] text-white hover:bg-[#5148ee]" onClick={total ? onGoToScreening : onImportArticles}>
          {total ? <ArrowRightIcon className="h-4 w-4" /> : <DownloadIcon className="h-4 w-4" />}
          {total ? "Revisar artigos" : "Importar artigos"}
        </Button>}
        metrics={[
          { label: "Artigos identificados", value: formatNumber(stats.identified), description: metricDescriptions.identified },
          { label: "Em triagem", value: formatNumber(stats.screening), description: metricDescriptions.screening },
          { label: "Artigos elegíveis", value: formatNumber(stats.eligible), description: metricDescriptions.eligible },
          { label: "Estudos incluídos", value: formatNumber(stats.included), description: metricDescriptions.included },
        ]}
      />
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#e2e6ef] bg-white">
        <nav aria-label="Seções da visão geral" className="grid grid-cols-3 border-b border-[#edf0f7] bg-[#fbfcff]">
          {[["panorama", "Panorama"], ["activity", "Fontes e atividades"], ["protocol", "Protocolo e estudos"]].map(([key, label]) => (
            <button type="button" key={key} aria-pressed={section === key} onClick={() => setSection(key)}
              className={cn("min-w-0 border-b-2 px-2 py-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#6259ff] sm:px-4 sm:text-sm",
                section === key ? "border-[#6259ff] bg-white text-[#554bea]" : "border-transparent text-[#667391] hover:text-[#111936]")}>
              {label}
            </button>
          ))}
        </nav>
        {section === "panorama" ? <>
          <div className="grid min-w-0 divide-y divide-[#edf0f7] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="min-w-0">
              <FunnelChart stats={stats} />
              <div className="px-4 pb-5 sm:px-5"><Button variant="outline" size="sm" className="gap-2" onClick={onViewFlow}><BarChart3Icon className="h-4 w-4" />Ver fluxo PRISMA</Button></div>
            </div>
            <EvolutionCard evolution={overview.evolution || []} />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[#edf0f7] bg-[#fbfcff] px-4 py-4 sm:px-5">
            <DatabaseIcon className="h-4 w-4 text-[#6259ff]" />
            <h3 className="text-sm font-medium text-[#111936]">Concordância com a IA</h3>
            <span className="text-sm font-semibold text-[#6259ff]">{formatPercent(overview.reviewerAgreement?.rate)}</span>
            <span className="text-xs text-[#667391]">{overview.reviewerAgreement?.agreed || 0} de {overview.reviewerAgreement?.reviewed || 0} decisões humanas coincidem com a sugestão da IA.</span>
          </div>
        </> : null}
        {section === "activity" ? <div className="grid min-w-0 divide-y divide-[#edf0f7] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <DataSourcesCard sources={overview.sources || []} />
          <RecentActivitiesCard activities={overview.recentActivities || []} onOpenArticle={onOpenArticle} />
        </div> : null}
        {section === "protocol" ? <div className="grid min-w-0 divide-y divide-[#edf0f7] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <PlanningSummaryCard summary={overview.planningSummary || {}} onOpenPlanning={onOpenPlanning} />
          <StudyTypeCard studyTypes={overview.studyTypes || []} included={stats.included} />
        </div> : null}
        <QuickActionsCard
          onExport={handleExport}
          onGoToScreening={onGoToScreening}
          onImport={onImportArticles}
          onViewFlow={onViewFlow}
        />
      </section>
    </div>
  );
}

export default ProjectOverview;
