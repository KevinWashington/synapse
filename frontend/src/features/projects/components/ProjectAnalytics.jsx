import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertCircleIcon, BarChart3Icon, BookMarkedIcon, ChevronRightIcon, DownloadIcon, FilterIcon, LoaderIcon, NetworkIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { articleService } from "@features/articles/public/services";
import { synthesisService } from "@features/articles/public/services";
import { ArticleGraph } from "@features/articles/public/components";
import { projectService } from "@/features/projects/services/projectService";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { EXCLUDED_OUTCOMES, getArticleYear, getStudyTypeLabel, buildStats, buildYearData, buildSourceData, buildStudyTypeData, buildStatusData, buildKeywordData, buildTrendData, CHART_COLORS } from "../utils/projectAnalytics";
import { PublicationYearChart, StudyTypeChart, SourceChart, KeywordCloud, StatusChart, TrendChart } from "./analytics/ProjectAnalyticsCharts";
function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "0%";
  }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatDistributionLabel(value) {
  if (value === "true") return "Sim";
  if (value === "false") return "Não";
  if (value === "high") return "Alta";
  if (value === "medium") return "Média";
  if (value === "low") return "Baixa";
  if (value === "unrated") return "Sem nota";
  return value;
}

function formatSuggestionStatus(value) {
  if (value === "ready") return "Pronto";
  if (value === "needs_data") return "Sem dados";
  if (value === "missing_field") return "Campo ausente";
  return "Indisponível";
}

function formatVisualizationType(value) {
  if (value === "bar_chart") return "Barras por estudo";
  if (value === "category_bar_chart") return "Barras por categoria";
  if (value === "multi_category_bar_chart") return "Frequência por opção";
  if (value === "qualitative_table") return "Tabela qualitativa";
  return "Não disponivel";
}

function truncateChartLabel(value, maxLength = 18) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function EmptyChart({ children, compact = false }) {
  return (
    <div className={cn(
      "flex h-full items-center justify-center rounded-lg bg-[#f8f9fc] text-center text-sm text-[#667391]",
      compact ? "min-h-[118px] px-3 text-xs" : "min-h-[180px]"
    )}>
      {children}
    </div>
  );
}

function ChartCard({ action, children, className, title }) {
  return (
    <section className={cn("@container min-w-0 border-b border-[#edf0f7] bg-white p-4 sm:p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#111936]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function FilterSelect({ icon: Icon, label, value, onValueChange, children, className }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-10 rounded-lg border-[#dfe4ef] bg-white text-xs font-semibold text-[#253252] shadow-none",
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 text-[#56627f]" /> : null}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function ViewToggle({ value, onChange }) {
  const options = [
    { key: "dashboard", label: "Panorama", icon: BarChart3Icon },
    { key: "rqs", label: "Perguntas de pesquisa", icon: BookMarkedIcon },
    { key: "graph", label: "Relações entre artigos", icon: NetworkIcon },
  ];

  return (
    <nav aria-label="Seções de gráficos" className="grid min-w-0 grid-cols-1 border-y border-[#e7ebf4] bg-[#fbfcff] sm:grid-cols-3">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onChange(option.key)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6259ff] sm:text-sm",
              isActive ? "border-[#6259ff] bg-white text-[#554bea]" : "border-transparent text-[#667391] hover:text-[#111936]"
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}

function InsightsPanel({ stats, sourceData, yearData, studyTypeData, onGoToScreening }) {
  const peakYear = [...yearData].sort((a, b) => b.value - a.value)[0];
  const topSource = sourceData[0];
  const topType = studyTypeData[0];
  const includeRate = stats.identified ? (stats.included / stats.identified) * 100 : 0;

  const insights = [
    peakYear
      ? `Maior volume de publicações em ${peakYear.year}, com ${formatNumber(peakYear.value)} registro(s).`
      : "Cadastre anos de publicação para gerar tendências temporais.",
    topSource
      ? `${topSource.name} concentra ${formatPercent((topSource.value / stats.identified) * 100)} dos registros filtrados.`
      : "As fontes dos artigos ainda não foram informadas.",
    topType
      ? `${topType.name} e o tipo de estudo mais frequente neste recorte.`
      : "Classifique tipos de estudo para melhorar a analise metodologica.",
    `A taxa de inclusão atual e ${formatPercent(includeRate)} dos registros identificados.`,
  ];

  const nextSteps = [
    { label: `Revisar artigos em triagem (${formatNumber(Math.max(stats.screening - stats.eligible, 0))})`, onClick: onGoToScreening },
  ];

  return (
    <ChartCard title="Principais insights">
      <div className="grid gap-4 2xl:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div key={insight} className="flex gap-3 text-sm leading-5 text-[#253252]">
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  index === 0 && "bg-[#eef1ff] text-[#6259ff]",
                  index === 1 && "bg-[#eaf8f0] text-[#2fa060]",
                  index === 2 && "bg-[#fff5e3] text-[#d48700]",
                  index === 3 && "bg-[#fff1f2] text-[#e34b5f]"
                )}
              >
                <SparklesIcon className="h-4 w-4" />
              </span>
              <span>{insight}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-[#f5f7fc] p-4">
          <p className="mb-3 text-xs font-semibold text-[#253252]">Próximos passos sugeridos</p>
          <div className="space-y-1">
            {nextSteps.filter((step) => step.onClick).map((step) => (
              <button
                key={step.label}
                type="button"
                onClick={step.onClick || undefined}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs font-medium text-[#253252] hover:bg-white"
              >
                {step.label}
                <ChevronRightIcon className="h-4 w-4 text-[#8b96ad]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

function SuggestedVisualizationChart({ suggestion }) {
  const isCountChart = suggestion.visualizationType !== "bar_chart";
  const chartData = (suggestion.rows || []).map((row) => ({
    ...row,
    displayName: isCountChart ? formatDistributionLabel(row.value) : row.title,
  }));

  return (
    <div className="h-[150px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: -22, right: 4, top: 8, bottom: 4 }}>
          <CartesianGrid stroke="#f0f2f8" vertical={false} />
          <XAxis
            dataKey="displayName"
            tick={{ fill: "#56627f", fontSize: 11 }}
            tickFormatter={truncateChartLabel}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis tick={{ fill: "#56627f", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#f6f7ff" }}
            formatter={(value, _name, payload) => {
              if (isCountChart) {
                return [`${value} (${payload?.payload?.percentage ?? 0}%)`, "Contagem"];
              }
              return [value, "Valor extraído"];
            }}
            labelFormatter={(value) => value}
          />
          <Bar isAnimationActive={false} dataKey={isCountChart ? "count" : "value"} fill="#8178ff" radius={[4, 4, 0, 0]} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SuggestedQualitativeTable({ onOpenArticle, suggestion }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#edf0f7]">
      <div className="grid grid-cols-[minmax(0,0.9fr)_52px_minmax(0,1.2fr)] bg-[#f8f9fc] px-3 py-2 text-[11px] font-semibold text-[#56627f]">
        <span>Artigo</span>
        <span>Ano</span>
        <span>Resposta</span>
      </div>
      <div className="divide-y divide-[#edf0f7]">
        {(suggestion.rows || []).slice(0, 4).map((row) => (
          <div key={`${suggestion.rqNumber}-${row.articleId}`} className="grid grid-cols-[minmax(0,0.9fr)_52px_minmax(0,1.2fr)] px-3 py-2 text-[11px]">
            {onOpenArticle ? (
              <button
                type="button"
                className="truncate text-left font-medium text-[#253252] hover:text-[#6259ff]"
                onClick={() => onOpenArticle(row.articleId)}
                title={row.title}
              >
                {row.title}
              </button>
            ) : (
              <span className="truncate font-medium text-[#253252]" title={row.title}>{row.title}</span>
            )}
            <span className="text-[#667391]">{row.year || "-"}</span>
            <span className="line-clamp-2 text-[#56627f]" title={row.value}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestedVisualizationCard({ onOpenArticle, suggestion }) {
  const rows = suggestion.rows || [];
  const isChart = ["bar_chart", "category_bar_chart", "multi_category_bar_chart"].includes(suggestion.visualizationType);

  return (
    <ChartCard title={`RQ ${suggestion.rqNumber}`}>
      <div className="space-y-3">
        <div>
          <p className="line-clamp-3 text-sm font-semibold leading-5 text-[#111936]" title={suggestion.question}>
            {suggestion.question}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-[#eef1ff] px-2 py-1 text-[11px] font-semibold text-[#6259ff]">
              {formatSuggestionStatus(suggestion.status)}
            </span>
            <span className="rounded-md bg-[#f5f7fc] px-2 py-1 text-[11px] font-medium text-[#56627f]">
              {formatVisualizationType(suggestion.visualizationType)}
            </span>
          </div>
          <p className="mt-2 truncate text-[11px] text-[#56627f]" title={suggestion.field?.label || "Não configurado"}>
            Campo: {suggestion.field?.label || "Não configurado"}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#667391]" title={suggestion.reason}>{suggestion.reason}</p>
        </div>

        {!rows.length ? (
          <EmptyChart compact>
            {suggestion.status === "missing_field"
              ? "Configure um campo de extração para esta pergunta no planejamento."
              : "Preencha a extração dos artigos incluidos para gerar esta visualização."}
          </EmptyChart>
        ) : isChart ? (
          <SuggestedVisualizationChart suggestion={suggestion} />
        ) : (
          <SuggestedQualitativeTable suggestion={suggestion} onOpenArticle={onOpenArticle} />
        )}
      </div>
    </ChartCard>
  );
}

function SuggestedVisualizationsSection({ onOpenArticle, suggestions }) {
  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#edf0f7] px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-[#111936]">Visualizações por pergunta de pesquisa</h2>
          <p className="mt-1 text-xs text-[#667391]">
            Dados dos estudos incluídos, conforme os campos definidos no planejamento. Os filtros do Panorama não se aplicam aqui.
          </p>
        </div>
        <span className="rounded-lg bg-[#f5f7fc] px-3 py-2 text-xs font-semibold text-[#56627f]">
          {formatNumber(suggestions.length)} pergunta(s)
        </span>
      </div>

      {suggestions.length ? (
        <div className={cn("grid min-w-0 [&>section]:border-r [&>section]:border-[#edf0f7]", suggestions.length > 1 && "lg:grid-cols-2")}>
          {suggestions.map((suggestion) => (
            <SuggestedVisualizationCard
              key={`suggested-visualization-${suggestion.rqNumber}`}
              suggestion={suggestion}
              onOpenArticle={onOpenArticle}
            />
          ))}
        </div>
      ) : (
        <ChartCard title="Perguntas de pesquisa">
          <EmptyChart>Cadastre perguntas e campos de extração para receber sugestões de visualização.</EmptyChart>
        </ChartCard>
      )}
    </section>
  );
}

function ProjectAnalytics({ graphRefreshToken = 0, onGoToScreening, onOpenArticle, project }) {
  const [activeView, setActiveView] = useState("dashboard");
  const [articles, setArticles] = useState([]);
  const [overview, setOverview] = useState(null);
  const [visualizationSuggestions, setVisualizationSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [studyTypeFilter, setStudyTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  useEffect(() => {
    let ignore = false;

    async function loadAnalytics() {
      try {
        setLoading(true);
        setError(null);
        const [overviewResponse, firstPage, catalog] = await Promise.all([
          projectService.getProjectOverview(project.id),
          articleService.getArticlesByProject(project.id, { limit: 500, page: 1 }),
          synthesisService.getChartCatalog(project.id),
        ]);

        const rqCharts = await Promise.all((catalog || []).filter((item) => item.type === "rq").map(async (item) => {
          const chart = await synthesisService.getChart(project.id, item.key);
          const rows = Array.isArray(chart.rows) ? chart.rows : chart.rows?.items || [];
          return {
            rqNumber: item.rqNumber,
            question: item.label,
            field: chart.field,
            visualizationType: chart.field?.type === "text" ? "qualitative_table" : "category_bar_chart",
            status: rows.length ? "ready" : "needs_data",
            reason: "Distribuição calculada sobre estudos incluídos.",
            rows,
          };
        }));

        const pageSize = firstPage.limit || 500;
        const pageCount = Math.ceil((firstPage.total || 0) / pageSize);
        let allArticles = firstPage.articles || [];

        if (pageCount > 1) {
          const remainingPages = Array.from({ length: pageCount - 1 }, (_, index) => index + 2);
          const responses = await Promise.all(
            remainingPages.map((page) =>
              articleService.getArticlesByProject(project.id, { limit: pageSize, page })
            )
          );
          allArticles = allArticles.concat(responses.flatMap((response) => response.articles || []));
        }

        if (!ignore) {
          setOverview(overviewResponse);
          setArticles(allArticles);
          setVisualizationSuggestions(rqCharts);
        }
      } catch (currentError) {
        if (!ignore) {
          setError(currentError.message || "Erro ao carregar graficos");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      ignore = true;
    };
  }, [project.id]);

  const filterOptions = useMemo(() => {
    const years = Array.from(new Set(articles.map(getArticleYear).filter(Boolean))).sort((a, b) => b - a);
    const sources = Array.from(new Set(articles.map((article) => article.sourceName).filter(Boolean))).sort();
    const studyTypes = Array.from(new Set(articles.map((article) => article.studyType || "unclassified"))).sort();
    return { sources, studyTypes, years };
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesYear = yearFilter === "all" || String(getArticleYear(article)) === yearFilter;
      const matchesSource = sourceFilter === "all" || article.sourceName === sourceFilter;
      const matchesType =
        studyTypeFilter === "all" || (article.studyType || "unclassified") === studyTypeFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "included" && article.reviewOutcome === "included") ||
        (statusFilter === "excluded" && EXCLUDED_OUTCOMES.has(article.reviewOutcome)) ||
        (statusFilter === "screening" && article.currentPhase === "screening" && article.reviewOutcome === "active") ||
        (statusFilter === "eligible" && article.currentPhase === "eligibility" && article.reviewOutcome === "active");

      return matchesYear && matchesSource && matchesType && matchesStatus;
    });
  }, [articles, sourceFilter, statusFilter, studyTypeFilter, yearFilter]);

  const stats = useMemo(() => buildStats(filteredArticles), [filteredArticles]);
  const yearData = useMemo(() => buildYearData(filteredArticles), [filteredArticles]);
  const sourceData = useMemo(() => buildSourceData(filteredArticles), [filteredArticles]);
  const studyTypeData = useMemo(() => buildStudyTypeData(filteredArticles), [filteredArticles]);
  const statusData = useMemo(() => buildStatusData(filteredArticles), [filteredArticles]);
  const keywordData = useMemo(
    () => buildKeywordData(filteredArticles, project.keywords || []),
    [filteredArticles, project.keywords]
  );
  const hasFilters =
    yearFilter !== "all" || statusFilter !== "all" || studyTypeFilter !== "all" || sourceFilter !== "all";
  const trendData = useMemo(
    () => buildTrendData(hasFilters ? null : overview, filteredArticles),
    [filteredArticles, hasFilters, overview]
  );

  async function handleExport(format = "csv") {
    try {
      await articleService.exportSelectionReport(project.id, format);
      toast.success("Dados exportados com sucesso.");
    } catch (currentError) {
      toast.error(`Erro ao exportar dados: ${currentError.message}`);
    }
  }

  function clearFilters() {
    setYearFilter("all");
    setStatusFilter("all");
    setStudyTypeFilter("all");
    setSourceFilter("all");
  }

  if (loading) {
    return <div role="status" className="flex items-center gap-2 rounded-xl border border-[#e2e6ef] bg-white px-5 py-4 text-sm text-[#667391]"><LoaderIcon className="h-4 w-4 animate-spin" />Carregando gráficos e análises...</div>;
  }
  if (error) {
    return <div role="alert" className="flex items-center gap-2 rounded-xl border border-[#fee2e2] bg-[#fff1f2] px-5 py-4 text-sm text-[#be123c]"><AlertCircleIcon className="h-4 w-4" />{error}</div>;
  }
  return (
    <section aria-label="Workspace de gráficos" className="min-w-0 overflow-hidden rounded-xl border border-[#e2e6ef] bg-white text-[#111936] shadow-[0_10px_30px_rgba(18,27,54,0.03)]">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Gráficos da revisão</h2>
          <p className="mt-1 text-sm text-[#667391]">Explore o perfil dos estudos, as respostas às perguntas e as relações entre artigos.</p>
        </div>
        <Button variant="outline" size="sm" title="Exportar relatório de seleção do projeto completo" onClick={() => handleExport("csv")}><DownloadIcon className="h-4 w-4" />Exportar relatório</Button>
      </header>
      <ViewToggle value={activeView} onChange={setActiveView} />
      <div className="min-h-[420px] min-w-0 max-h-[min(72vh,900px)] overflow-y-auto">
        {activeView === "graph" ? <div className="min-w-0 p-4 sm:p-5"><Suspense fallback={<EmptyChart>Carregando grafo...</EmptyChart>}><ArticleGraph projectId={project.id} graphRefreshToken={graphRefreshToken} /></Suspense></div>
        : activeView === "rqs" ? <SuggestedVisualizationsSection suggestions={visualizationSuggestions} onOpenArticle={onOpenArticle} />
        : <>
      <div className="grid gap-3 border-b border-[#edf0f7] bg-[#fbfcff] p-4 sm:px-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr_1fr_auto]">
        <FilterSelect label="Período" icon={BookMarkedIcon} value={yearFilter} onValueChange={setYearFilter}>
          <SelectItem value="all">Todo o período</SelectItem>
          {filterOptions.years.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect label="Etapa ou resultado" icon={FilterIcon} value={statusFilter} onValueChange={setStatusFilter}>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="screening">Em triagem</SelectItem>
          <SelectItem value="eligible">Elegíveis</SelectItem>
          <SelectItem value="included">Incluídos</SelectItem>
          <SelectItem value="excluded">Excluídos</SelectItem>
        </FilterSelect>
        <FilterSelect label="Tipo de estudo" value={studyTypeFilter} onValueChange={setStudyTypeFilter}>
          <SelectItem value="all">Todos os tipos de estudo</SelectItem>
          {filterOptions.studyTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {getStudyTypeLabel(type)}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect label="Fonte" value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectItem value="all">Todas as fontes</SelectItem>
          {filterOptions.sources.map((source) => (
            <SelectItem key={source} value={source}>
              {source}
            </SelectItem>
          ))}
        </FilterSelect>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasFilters}
          onClick={clearFilters}
          className="h-10 rounded-lg border-[#dfe4ef] bg-white text-[#182344] shadow-none"
        >
          <RotateCcwIcon className="h-4 w-4" />
          Limpar filtros
        </Button>
      </div>

          <div className="grid grid-cols-2 gap-3 border-b border-[#edf0f7] px-4 py-3 sm:px-5 md:grid-cols-4">
            {[
              ["Registros no recorte", stats.identified],
              ["Incluídos no recorte", stats.included],
              ["Fontes no recorte", new Set(filteredArticles.map((article) => article.sourceName).filter(Boolean)).size],
              ["Taxa de inclusão", formatPercent(stats.identified ? stats.included / stats.identified * 100 : 0)],
            ].map(([label, value]) => <div key={label}><p className="text-xs text-[#667391]">{label}</p><p className="mt-1 text-base font-semibold">{typeof value === "number" ? formatNumber(value) : value}</p></div>)}
          </div>
      <div className="grid min-w-0 [&>section]:border-r [&>section]:border-[#edf0f7] xl:grid-cols-[1.15fr_1fr_1.05fr]">
        <ChartCard title="Publicações por ano">
          <PublicationYearChart data={yearData} />
        </ChartCard>
        <ChartCard title="Artigos por tipo de estudo">
          <StudyTypeChart data={studyTypeData} total={Math.max(stats.identified, 1)} />
        </ChartCard>
        <ChartCard title="Artigos por fonte">
          <SourceChart data={sourceData} total={Math.max(stats.identified, 1)} />
        </ChartCard>
      </div>

      <div className="grid min-w-0 [&>section]:border-r [&>section]:border-[#edf0f7] xl:grid-cols-[1fr_1.2fr_1fr]">
        <ChartCard title="Publicações por fonte">
          <SourceChart data={sourceData.slice(0, 6)} total={Math.max(stats.identified, 1)} />
        </ChartCard>
        <ChartCard title="Palavras-chave mais frequentes">
          <KeywordCloud data={keywordData} />
        </ChartCard>
        <ChartCard title="Distribuição por status">
          <StatusChart data={statusData} total={Math.max(stats.identified, 1)} />
        </ChartCard>
      </div>

      <div className="grid min-w-0 [&>section]:border-r [&>section]:border-[#edf0f7] xl:grid-cols-[1.2fr_1fr]">
        <ChartCard title="Tendências ao longo do tempo">
          <TrendChart data={trendData} />
        </ChartCard>
        <InsightsPanel
          stats={stats}
          sourceData={sourceData}
          studyTypeData={studyTypeData}
          yearData={yearData}
          onGoToScreening={onGoToScreening}
        />
      </div>
        </>}
      </div>
    </section>
  );
}

export default ProjectAnalytics;
