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
  ShieldCheckIcon,
  StarIcon,
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
import { articleService } from "@/features/articles/services/articleService";
import { projectService } from "@/features/projects/services/projectService";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const FUNNEL_STEPS = [
  { key: "identified", label: "Identificacao", color: "#6259ff" },
  { key: "screening", label: "Triagem", color: "#6259ff" },
  { key: "eligible", label: "Elegibilidade", color: "#49c987" },
  { key: "included", label: "Inclusao", color: "#ffc35a" },
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

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return `${new Date(value).toLocaleDateString("pt-BR")} as ${new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function totalFromStats(stats) {
  return stats?.identified || 0;
}

function MetricCard({ icon: Icon, label, value, description, colorClass, className }) {
  return (
    <div className={cn("flex min-h-[112px] rounded-lg border border-[#edf0f7] bg-white p-5", className)}>
      <div className="flex items-start gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", colorClass)}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-medium text-[#667391]">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-[#111936]">{value}</p>
          <p className="mt-1 text-xs text-[#667391]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function FunnelChart({ stats }) {
  const maxValue = Math.max(stats.identified, 1);
  const steps = FUNNEL_STEPS.map((step, index) => ({
    ...step,
    value: stats[step.key] || 0,
    opacity: 1 - index * 0.08,
    width: Math.max(44, ((stats[step.key] || 0) / maxValue) * 100),
  }));

  return (
    <div className="h-full rounded-lg border border-[#edf0f7] bg-white p-5">
      <p className="mb-5 text-sm font-semibold text-[#111936]">Progresso da revisao (PRISMA)</p>
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.key}
            className="grid min-h-10 grid-cols-[minmax(140px,1fr)_48px_minmax(120px,180px)] items-center gap-4 text-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span style={{ backgroundColor: step.color }} className="h-2 w-2 shrink-0 rounded-full" />
              <span className="truncate font-semibold text-[#253252]">{step.label}</span>
            </div>
            <span className="text-right font-semibold text-[#111936]">{formatNumber(step.value)}</span>
            <div className="flex h-10 w-full items-center justify-center">
              <div
                style={{
                  width: `${step.width}%`,
                  backgroundColor: step.color,
                  opacity: step.opacity,
                }}
                className="h-10 rounded-md"
              />
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[minmax(140px,1fr)_48px_minmax(120px,180px)] gap-4 pt-2">
          <div />
          <div />
          <div className="text-center">
            <p className="text-lg font-semibold leading-none text-[#111936]">{formatNumber(stats.included)}</p>
            <p className="mt-1 text-xs text-[#667391]">estudos incluidos</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataSourcesCard({ sources }) {
  return (
    <div className="rounded-lg border border-[#edf0f7] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111936]">Fontes de dados</p>
        <span className="text-xs font-semibold text-[#6259ff]">Ver todas</span>
      </div>
      <div className="space-y-3">
        {sources.length ? sources.slice(0, 5).map((source) => (
          <div key={`${source.sourceCategory}-${source.sourceName}`} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 text-xs">
            <span className="font-semibold text-[#ff7a00]">{source.sourceName.slice(0, 8)}</span>
            <span className="truncate text-[#253252]">{source.sourceName}</span>
            <span className="text-[#56627f]">{formatNumber(source.total)} artigos</span>
          </div>
        )) : (
          <p className="text-sm text-[#667391]">Nenhuma fonte registrada.</p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#edf0f7] pt-3 text-sm font-semibold text-[#111936]">
        <span>Total</span>
        <span>{formatNumber(sources.reduce((total, source) => total + source.total, 0))} artigos</span>
      </div>
    </div>
  );
}

function EvolutionCard({ evolution }) {
  return (
    <div className="rounded-lg border border-[#edf0f7] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111936]">Evolucao das etapas</p>
        <span className="rounded-lg border border-[#edf0f7] px-3 py-1 text-xs text-[#56627f]">Ultimos 10 dias</span>
      </div>
      {evolution.length ? (
        <div className="h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolution}>
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: "#667391" }} />
              <YAxis tick={{ fontSize: 11, fill: "#667391" }} width={36} />
              <Tooltip labelFormatter={formatDate} />
              <Line type="monotone" dataKey="identification" stroke="#6259ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="screening" stroke="#736bff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="eligibility" stroke="#49c987" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="included" stroke="#ffc35a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[210px] items-center justify-center text-sm text-[#667391]">
          Sem eventos suficientes para montar a evolucao.
        </div>
      )}
    </div>
  );
}

function StudyTypeCard({ studyTypes, included }) {
  const chartData = studyTypes.map((item) => ({
    name: item.label,
    value: item.total,
    percentage: item.percentage,
  }));

  return (
    <div className="rounded-lg border border-[#edf0f7] bg-white p-5">
      <p className="mb-4 text-sm font-semibold text-[#111936]">Distribuicao por tipo de estudo</p>
      <div className="grid items-center gap-4 md:grid-cols-[150px_1fr]">
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
            <span className="text-xs text-[#667391]">incluidos</span>
          </div>
        </div>
        <div className="space-y-3">
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
    </div>
  );
}

function PlanningSummaryCard({ summary, onOpenPlanning }) {
  return (
    <div className="rounded-lg border border-[#edf0f7] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111936]">Resumo do planejamento</p>
        <button type="button" onClick={onOpenPlanning} className="text-xs font-semibold text-[#6259ff]">
          Ver planejamento
        </button>
      </div>
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-[150px_1fr] gap-3">
          <span className="text-[#667391]">Framework</span>
          <span className="font-medium text-[#253252]">{summary.framework}</span>
        </div>
        <div className="grid grid-cols-[150px_1fr] gap-3">
          <span className="text-[#667391]">String de busca</span>
          <span className="font-medium text-[#253252]">{summary.searchStringCount} string(s) cadastrada(s)</span>
        </div>
        <div className="grid grid-cols-[150px_1fr] gap-3">
          <span className="text-[#667391]">Criterios</span>
          <span className="font-medium text-[#253252]">
            {summary.inclusionCriteriaCount} inclusao / {summary.exclusionCriteriaCount} exclusao
          </span>
        </div>
        <div className="grid grid-cols-[150px_1fr] gap-3">
          <span className="text-[#667391]">Extracao de dados</span>
          <span className="font-medium text-[#253252]">{summary.extractionFieldCount} campo(s) configurado(s)</span>
        </div>
      </div>
    </div>
  );
}

function RecentActivitiesCard({ activities, onOpenArticle }) {
  return (
    <div className="rounded-lg border border-[#edf0f7] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111936]">Atividades recentes</p>
        <span className="text-xs font-semibold text-[#6259ff]">Ver todas</span>
      </div>
      <div className="space-y-3">
        {activities.length ? activities.map((activity) => (
          <button
            key={activity.id}
            type="button"
            onClick={() => activity.articleId && onOpenArticle(activity.articleId)}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", ACTIVITY_STYLES[activity.type] || ACTIVITY_STYLES.created)}>
              {activity.type === "included" ? <CheckCircle2Icon className="h-4 w-4" /> : <FileTextIcon className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-[#253252]">{activity.label}</span>
              <span className="block truncate text-xs text-[#667391]">{activity.description}</span>
            </span>
            <span className="text-[11px] text-[#8b96ad]">{formatDate(activity.timestamp)}</span>
          </button>
        )) : (
          <p className="text-sm text-[#667391]">Nenhuma atividade registrada.</p>
        )}
      </div>
    </div>
  );
}

function QuickActionsCard({ onImport, onGoToScreening, onViewFlow, onExport }) {
  const actions = [
    { label: "Importar artigos", icon: DownloadIcon, onClick: onImport },
    { label: "Ir para triagem", icon: FilterIcon, onClick: onGoToScreening },
    { label: "Ver fluxo (PRISMA)", icon: BarChart3Icon, onClick: onViewFlow },
    { label: "Exportar dados", icon: DownloadIcon, onClick: onExport },
    { label: "Gerar relatorio", icon: FileTextIcon, onClick: onExport },
  ];

  return (
    <div className="rounded-lg border border-[#edf0f7] bg-white p-5">
      <p className="mb-4 text-sm font-semibold text-[#111936]">Acoes rapidas</p>
      <div className="space-y-1">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-[#253252] hover:bg-[#f7f8fc]"
          >
            <span className="flex items-center gap-3">
              <action.icon className="h-4 w-4 text-[#667391]" />
              {action.label}
            </span>
            <ArrowRightIcon className="h-4 w-4 text-[#a4adc2]" />
          </button>
        ))}
      </div>
    </div>
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

  const stats = overview?.prismaStats || project.prismaStats;
  const total = totalFromStats(stats);

  const metricDescriptions = useMemo(() => ({
    identified: "100% do total",
    screening: total ? `${formatPercent((stats.screening / total) * 100)} do total` : "Sem registros",
    eligible: total ? `${formatPercent((stats.eligible / total) * 100)} do total` : "Sem registros",
    included: total ? `${formatPercent((stats.included / total) * 100)} do total` : "Sem registros",
  }), [stats, total]);

  async function handleExport() {
    try {
      await articleService.exportSelectionReport(project.id, "csv");
      toast.success("Relatorio CSV exportado.");
    } catch (currentError) {
      toast.error(`Erro ao exportar relatorio: ${currentError.message}`);
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
    <div className="space-y-4">
      <div className="grid items-stretch gap-4 xl:grid-cols-[0.95fr_1.45fr]">
        <FunnelChart stats={stats} />
        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            icon={FileTextIcon}
            label="Artigos identificados"
            value={formatNumber(stats.identified)}
            description={metricDescriptions.identified}
            colorClass="bg-[#f0edff] text-[#6259ff]"
          />
          <MetricCard
            icon={FilterIcon}
            label="Em triagem"
            value={formatNumber(stats.screening)}
            description={metricDescriptions.screening}
            colorClass="bg-[#eef1ff] text-[#6259ff]"
          />
          <MetricCard
            icon={ShieldCheckIcon}
            label="Artigos elegiveis"
            value={formatNumber(stats.eligible)}
            description={metricDescriptions.eligible}
            colorClass="bg-[#eaf8f0] text-[#35a967]"
          />
          <MetricCard
            icon={DatabaseIcon}
            label="Taxa de concordancia entre revisores"
            value={formatPercent(overview.reviewerAgreement.rate)}
            description={`${overview.reviewerAgreement.agreed} de ${overview.reviewerAgreement.reviewed} decisoes com IA`}
            colorClass="bg-[#eef1ff] text-[#6259ff]"
            className="md:col-span-2"
          />
          <MetricCard
            icon={StarIcon}
            label="Estudos incluidos"
            value={formatNumber(stats.included)}
            description={metricDescriptions.included}
            colorClass="bg-[#fff5e3] text-[#ff9f1c]"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr_0.9fr]">
        <DataSourcesCard sources={overview.sources} />
        <EvolutionCard evolution={overview.evolution} />
        <RecentActivitiesCard activities={overview.recentActivities} onOpenArticle={onOpenArticle} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr_0.9fr]">
        <StudyTypeCard studyTypes={overview.studyTypes} included={stats.included} />
        <PlanningSummaryCard summary={overview.planningSummary} onOpenPlanning={onOpenPlanning} />
        <QuickActionsCard
          onExport={handleExport}
          onGoToScreening={onGoToScreening}
          onImport={onImportArticles}
          onViewFlow={onViewFlow}
        />
      </div>
    </div>
  );
}

export default ProjectOverview;
