import { useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  BarChart3Icon,
  BookMarkedIcon,
  ChevronRightIcon,
  DownloadIcon,
  FilterIcon,
  LoaderIcon,
  NetworkIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { articleService } from "@/features/articles/services/articleService";
import ArticleGraph from "@/features/articles/components/ArticleGraph";
import { projectService } from "@/features/projects/services/projectService";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  identified: "#6259ff",
  screening: "#7c73ff",
  eligible: "#ffd27a",
  included: "#49c987",
  excluded: "#ff6b73",
};

const CHART_COLORS = ["#6259ff", "#5a86ff", "#49c987", "#ffd27a", "#ff8b8b", "#aab4cc"];

const EXCLUDED_OUTCOMES = new Set([
  "duplicate_removed",
  "excluded_screening",
  "excluded_eligibility",
  "full_text_unavailable",
]);

const STUDY_TYPE_LABELS = {
  journal_article: "Artigo de periodico",
  conference_paper: "Conferencia",
  review: "Revisao",
  thesis: "Tese",
  book_chapter: "Capitulo de livro",
  other: "Outros",
  unclassified: "Nao classificado",
};

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
  if (value === "false") return "Nao";
  if (value === "high") return "Alta";
  if (value === "medium") return "Media";
  if (value === "low") return "Baixa";
  if (value === "unrated") return "Sem nota";
  return value;
}

function formatSuggestionStatus(value) {
  if (value === "ready") return "Pronto";
  if (value === "needs_data") return "Sem dados";
  if (value === "missing_field") return "Campo ausente";
  return "Indisponivel";
}

function formatVisualizationType(value) {
  if (value === "bar_chart") return "Barras por estudo";
  if (value === "category_bar_chart") return "Barras por categoria";
  if (value === "multi_category_bar_chart") return "Frequencia por opcao";
  if (value === "qualitative_table") return "Tabela qualitativa";
  return "Nao disponivel";
}

function truncateChartLabel(value, maxLength = 18) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function getArticleYear(article) {
  const year = Number(article?.year);
  return Number.isFinite(year) ? year : null;
}

function getStudyTypeLabel(value) {
  return STUDY_TYPE_LABELS[value || "unclassified"] || value;
}

function groupByCount(items, getKey) {
  const map = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) {
      return;
    }
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function buildStats(articles) {
  const identified = articles.length;
  const screening = articles.filter(
    (article) =>
      article.currentPhase === "screening" ||
      article.currentPhase === "eligibility" ||
      article.currentPhase === "included" ||
      ["excluded_screening", "excluded_eligibility", "full_text_unavailable", "included"].includes(article.reviewOutcome)
  ).length;
  const eligible = articles.filter(
    (article) =>
      article.currentPhase === "eligibility" ||
      article.currentPhase === "included" ||
      ["excluded_eligibility", "full_text_unavailable", "included"].includes(article.reviewOutcome)
  ).length;
  const included = articles.filter((article) => article.reviewOutcome === "included").length;
  const excluded = articles.filter((article) => EXCLUDED_OUTCOMES.has(article.reviewOutcome)).length;

  return {
    eligible,
    excluded,
    identified,
    included,
    screening,
  };
}

function buildYearData(articles) {
  return groupByCount(articles, getArticleYear)
    .sort((a, b) => Number(a.name) - Number(b.name))
    .map((item) => ({ ...item, year: String(item.name) }));
}

function buildSourceData(articles) {
  return groupByCount(articles, (article) => article.sourceName || "Origem nao informada").slice(0, 8);
}

function buildStudyTypeData(articles) {
  return groupByCount(articles, (article) => getStudyTypeLabel(article.studyType));
}

function buildStatusData(articles) {
  const values = articles.reduce(
    (acc, article) => {
      if (article.reviewOutcome === "included") {
        acc.included += 1;
      } else if (EXCLUDED_OUTCOMES.has(article.reviewOutcome)) {
        acc.excluded += 1;
      } else if (article.currentPhase === "eligibility") {
        acc.eligible += 1;
      } else if (article.currentPhase === "screening") {
        acc.screening += 1;
      } else {
        acc.identified += 1;
      }
      return acc;
    },
    { eligible: 0, excluded: 0, identified: 0, included: 0, screening: 0 }
  );

  return [
    { key: "included", name: "Incluidos", value: values.included, color: STATUS_COLORS.included },
    { key: "eligible", name: "Elegiveis", value: values.eligible, color: STATUS_COLORS.eligible },
    { key: "screening", name: "Em triagem", value: values.screening, color: STATUS_COLORS.screening },
    { key: "excluded", name: "Excluidos", value: values.excluded, color: STATUS_COLORS.excluded },
    { key: "identified", name: "Identificacao", value: values.identified, color: STATUS_COLORS.identified },
  ].filter((item) => item.value > 0);
}

function normalizeKeyword(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildKeywordData(articles, projectKeywords = []) {
  const map = new Map();
  const addKeyword = (keyword) => {
    const normalized = normalizeKeyword(String(keyword || ""));
    if (!normalized || normalized.length < 3) {
      return;
    }
    map.set(normalized, (map.get(normalized) || 0) + 1);
  };

  projectKeywords.forEach(addKeyword);
  articles.forEach((article) => {
    (article.aiKeywords || []).forEach(addKeyword);
    String(article.keywords || "")
      .split(/[,;|]/)
      .forEach(addKeyword);
  });

  return Array.from(map, ([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, 18);
}

function buildTrendData(overview, articles) {
  if (overview?.evolution?.length) {
    return overview.evolution.map((point) => ({
      label: new Date(`${point.date}T00:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      Identificados: point.identification,
      Incluidos: point.included,
      Publicacoes: point.screening,
    }));
  }

  const yearData = buildYearData(articles);
  return yearData.map((point) => ({
    label: point.year,
    Identificados: point.value,
    Incluidos: articles.filter((article) => article.reviewOutcome === "included" && String(article.year) === point.year).length,
    Publicacoes: point.value,
  }));
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
    <section className={cn("rounded-lg border border-[#edf0f7] bg-white p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#111936]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function FilterSelect({ icon: Icon, value, onValueChange, children, className }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
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
    { key: "dashboard", label: "Painel", icon: BarChart3Icon },
    { key: "graph", label: "Grafo", icon: NetworkIcon },
  ];

  return (
    <div className="inline-flex rounded-lg border border-[#dfe4ef] bg-white p-1">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition",
              isActive ? "bg-[#6259ff] text-white" : "text-[#56627f] hover:bg-[#f7f8fc] hover:text-[#182344]"
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PublicationYearChart({ data }) {
  if (!data.length) {
    return <EmptyChart>Nenhum ano de publicacao informado.</EmptyChart>;
  }

  return (
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -18, right: 6, top: 12 }}>
          <CartesianGrid stroke="#f0f2f8" vertical={false} />
          <XAxis dataKey="year" tick={{ fill: "#56627f", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#56627f", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "#f6f7ff" }} />
          <Bar dataKey="value" fill="#8178ff" radius={[4, 4, 0, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StudyTypeChart({ data, total }) {
  if (!data.length) {
    return <EmptyChart>Nenhum tipo de estudo classificado.</EmptyChart>;
  }

  return (
    <div className="grid min-h-[230px] items-center gap-4 md:grid-cols-[170px_1fr]">
      <div className="relative h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={2}>
              {data.map((item, index) => (
                <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-[#111936]">{formatNumber(total)}</span>
          <span className="text-xs text-[#667391]">artigos</span>
        </div>
      </div>
      <div className="space-y-3">
        {data.slice(0, 6).map((item, index) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-[#253252]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 text-[#56627f]">
              {formatNumber(item.value)} ({formatPercent((item.value / total) * 100)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceChart({ data, total }) {
  if (!data.length) {
    return <EmptyChart>Nenhuma fonte registrada.</EmptyChart>;
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const width = total ? Math.max((item.value / total) * 100, 2) : 0;
        return (
          <div key={item.name} className="grid grid-cols-[110px_1fr_82px] items-center gap-3 text-xs">
            <span className="truncate font-medium text-[#253252]">{item.name}</span>
            <div className="h-3 overflow-hidden rounded-full bg-[#eef1ff]">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  width: `${width}%`,
                }}
              />
            </div>
            <span className="text-right text-[#56627f]">
              {formatNumber(item.value)} ({formatPercent((item.value / total) * 100)})
            </span>
          </div>
        );
      })}
    </div>
  );
}

function KeywordCloud({ data }) {
  if (!data.length) {
    return <EmptyChart>Nenhuma palavra-chave registrada.</EmptyChart>;
  }

  const max = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="flex min-h-[190px] flex-wrap items-center justify-center gap-x-5 gap-y-3 px-4 py-2 text-center">
      {data.map((item, index) => {
        const size = 13 + Math.round((item.count / max) * 18);
        return (
          <span
            key={item.text}
            className="font-semibold leading-none"
            style={{
              color: CHART_COLORS[index % CHART_COLORS.length],
              fontSize: `${size}px`,
            }}
          >
            {item.text}
          </span>
        );
      })}
    </div>
  );
}

function StatusChart({ data, total }) {
  if (!data.length) {
    return <EmptyChart>Nenhum status para exibir.</EmptyChart>;
  }

  return (
    <div className="grid min-h-[190px] items-center gap-4 md:grid-cols-[155px_1fr]">
      <div className="relative h-[155px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={47} outerRadius={72} startAngle={90} endAngle={450}>
              {data.map((item) => (
                <Cell key={item.key} fill={item.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-[#111936]">{formatNumber(total)}</span>
          <span className="text-xs text-[#667391]">artigos</span>
        </div>
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 text-[#253252]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="text-[#56627f]">
              {formatNumber(item.value)} ({formatPercent((item.value / total) * 100)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ data }) {
  if (!data.length) {
    return <EmptyChart>Sem eventos suficientes para montar tendencias.</EmptyChart>;
  }

  return (
    <div className="h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -18, right: 8, top: 10 }}>
          <CartesianGrid stroke="#f0f2f8" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#56627f", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#56627f", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip />
          <Line type="monotone" dataKey="Identificados" stroke="#6259ff" strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="Incluidos" stroke="#49c987" strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="Publicacoes" stroke="#5a86ff" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function InsightsPanel({ stats, sourceData, yearData, studyTypeData, onGoToScreening }) {
  const peakYear = [...yearData].sort((a, b) => b.value - a.value)[0];
  const topSource = sourceData[0];
  const topType = studyTypeData[0];
  const includeRate = stats.identified ? (stats.included / stats.identified) * 100 : 0;

  const insights = [
    peakYear
      ? `Maior volume de publicacoes em ${peakYear.year}, com ${formatNumber(peakYear.value)} registro(s).`
      : "Cadastre anos de publicacao para gerar tendencias temporais.",
    topSource
      ? `${topSource.name} concentra ${formatPercent((topSource.value / stats.identified) * 100)} dos registros filtrados.`
      : "As fontes dos artigos ainda nao foram informadas.",
    topType
      ? `${topType.name} e o tipo de estudo mais frequente neste recorte.`
      : "Classifique tipos de estudo para melhorar a analise metodologica.",
    `A taxa de inclusao atual e ${formatPercent(includeRate)} dos registros identificados.`,
  ];

  const nextSteps = [
    { label: `Revisar artigos em triagem (${formatNumber(Math.max(stats.screening - stats.eligible, 0))})`, onClick: onGoToScreening },
    { label: "Atualizar criterios de elegibilidade", onClick: null },
    { label: "Exportar relatorio de graficos", onClick: null },
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
          <p className="mb-3 text-xs font-semibold text-[#253252]">Proximos passos sugeridos</p>
          <div className="space-y-1">
            {nextSteps.map((step) => (
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
              return [value, "Valor extraido"];
            }}
            labelFormatter={(value) => value}
          />
          <Bar dataKey={isCountChart ? "count" : "value"} fill="#8178ff" radius={[4, 4, 0, 0]} barSize={22} />
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
          <p className="line-clamp-3 min-h-[60px] text-xs font-semibold leading-5 text-[#111936]" title={suggestion.question}>
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
          <p className="mt-2 truncate text-[11px] text-[#56627f]" title={suggestion.field?.label || "Nao configurado"}>
            Campo: {suggestion.field?.label || "Nao configurado"}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#667391]" title={suggestion.reason}>{suggestion.reason}</p>
        </div>

        {!rows.length ? (
          <EmptyChart compact>
            {suggestion.status === "missing_field"
              ? "Configure um campo de extracao para esta pergunta no planejamento."
              : "Preencha a extracao dos artigos incluidos para gerar esta visualizacao."}
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
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#111936]">Visualizacoes sugeridas por pergunta</h2>
          <p className="mt-1 text-xs text-[#667391]">
            Geradas por regras locais com base no tipo de dado definido na extracao.
          </p>
        </div>
        <span className="rounded-lg bg-[#f5f7fc] px-3 py-2 text-xs font-semibold text-[#56627f]">
          {formatNumber(suggestions.length)} pergunta(s)
        </span>
      </div>

      {suggestions.length ? (
        <div className="grid gap-4 xl:grid-cols-3">
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
          <EmptyChart>Cadastre perguntas e campos de extracao para receber sugestoes de visualizacao.</EmptyChart>
        </ChartCard>
      )}
    </section>
  );
}

function ProjectAnalytics({ graphRefreshToken = 0, onGoToScreening, onOpenArticle, project }) {
  const [activeView, setActiveView] = useState("dashboard");
  const [articles, setArticles] = useState([]);
  const [overview, setOverview] = useState(null);
  const [synthesisReport, setSynthesisReport] = useState(null);
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
        const [overviewResponse, firstPage, synthesisResponse] = await Promise.all([
          projectService.getProjectOverview(project.id),
          articleService.getArticlesByProject(project.id, { limit: 500, page: 1 }),
          articleService.getProjectSynthesisReport(project.id),
        ]);

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
          setSynthesisReport(synthesisResponse || null);
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
  const visualizationSuggestions = synthesisReport?.visualizationSuggestions || [];

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

  if (activeView === "graph") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewToggle value={activeView} onChange={setActiveView} />
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-lg border-[#dfe4ef] bg-white text-[#182344] shadow-none"
            onClick={() => setActiveView("dashboard")}
          >
            <BarChart3Icon className="h-4 w-4" />
            Voltar aos graficos
          </Button>
        </div>
        <ArticleGraph projectId={project.id} graphRefreshToken={graphRefreshToken} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#edf0f7] bg-white px-4 py-3 text-sm text-[#667391]">
        <LoaderIcon className="h-4 w-4 animate-spin" />
        Carregando graficos e analises...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#fee2e2] bg-[#fff1f2] px-4 py-3 text-sm text-[#be123c]">
        <AlertCircleIcon className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewToggle value={activeView} onChange={setActiveView} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-lg border-[#dfe4ef] bg-white text-[#182344] shadow-none"
            onClick={() => toast.info("Use os filtros para personalizar os graficos exibidos.")}
          >
            <SlidersHorizontalIcon className="h-4 w-4" />
            Personalizar graficos
          </Button>
          <Button
            size="sm"
            onClick={() => handleExport("csv")}
            className="h-10 rounded-lg bg-[#6259ff] px-4 text-white shadow-[0_10px_20px_rgba(98,89,255,0.18)] hover:bg-[#5148ee]"
          >
            <DownloadIcon className="h-4 w-4" />
            Exportar dados
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr_1fr_auto]">
        <FilterSelect icon={BookMarkedIcon} value={yearFilter} onValueChange={setYearFilter}>
          <SelectItem value="all">Todo o periodo</SelectItem>
          {filterOptions.years.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect icon={FilterIcon} value={statusFilter} onValueChange={setStatusFilter}>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="screening">Em triagem</SelectItem>
          <SelectItem value="eligible">Elegiveis</SelectItem>
          <SelectItem value="included">Incluidos</SelectItem>
          <SelectItem value="excluded">Excluidos</SelectItem>
        </FilterSelect>
        <FilterSelect value={studyTypeFilter} onValueChange={setStudyTypeFilter}>
          <SelectItem value="all">Todos os tipos de estudo</SelectItem>
          {filterOptions.studyTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {getStudyTypeLabel(type)}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect value={sourceFilter} onValueChange={setSourceFilter}>
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

      <SuggestedVisualizationsSection
        suggestions={visualizationSuggestions}
        onOpenArticle={onOpenArticle}
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr_1.05fr]">
        <ChartCard title="Publicacoes por ano">
          <PublicationYearChart data={yearData} />
        </ChartCard>
        <ChartCard title="Artigos por tipo de estudo">
          <StudyTypeChart data={studyTypeData} total={Math.max(stats.identified, 1)} />
        </ChartCard>
        <ChartCard title="Artigos por fonte">
          <SourceChart data={sourceData} total={Math.max(stats.identified, 1)} />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr_1fr]">
        <ChartCard title="Publicacoes por fonte">
          <SourceChart data={sourceData.slice(0, 6)} total={Math.max(stats.identified, 1)} />
        </ChartCard>
        <ChartCard title="Palavras-chave mais frequentes">
          <KeywordCloud data={keywordData} />
        </ChartCard>
        <ChartCard title="Distribuicao por status">
          <StatusChart data={statusData} total={Math.max(stats.identified, 1)} />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <ChartCard title="Tendencias ao longo do tempo">
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
    </div>
  );
}

export default ProjectAnalytics;
