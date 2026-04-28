import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/layout";
import RQSynthesisPanel from "./RQSynthesisPanel";
import {
  BASE_EXTRACTION_COLUMNS,
  buildDistributionsCsv,
  buildExtractionMatrixCsv,
  buildQualitySummaryCsv,
  buildSynthesisReportJson,
} from "../utils/synthesisExport";

function triggerFileDownload(content, contentType, fileName) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDistributionLabel(value) {
  if (value === "high") return "Alta";
  if (value === "medium") return "Media";
  if (value === "low") return "Baixa";
  if (value === "unrated") return "Sem nota";
  if (value === "true") return "Sim";
  if (value === "false") return "Nao";
  if (value === "yes") return "Sim";
  if (value === "partial") return "Parcial";
  if (value === "no") return "Nao";
  if (value === "na") return "NA";
  return value;
}

function formatCellValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (value === true) {
    return "Sim";
  }
  if (value === false) {
    return "Nao";
  }
  if (value == null || value === "") {
    return "-";
  }
  return String(value);
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-3">
      <p className="text-xs uppercase tracking-wide text-[var(--syn-text-secondary)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--syn-text-primary)]">{value}</p>
    </div>
  );
}

function formatVisualizationType(value) {
  if (value === "bar_chart") return "Grafico de barras por estudo";
  if (value === "category_bar_chart") return "Grafico de barras por categoria";
  if (value === "multi_category_bar_chart") return "Barras de frequencia por opcao";
  if (value === "qualitative_table") return "Tabela qualitativa";
  return "Nao disponivel";
}

function formatSuggestionStatus(value) {
  if (value === "ready") return "Pronto";
  if (value === "needs_data") return "Sem dados extraidos";
  if (value === "missing_field") return "Campo ausente";
  return "Indisponivel";
}

function DistributionChartCard({ chart }) {
  const chartData = useMemo(
    () =>
      (chart?.rows || []).map((row) => ({
        ...row,
        displayValue: formatDistributionLabel(row.value),
      })),
    [chart]
  );

  return (
    <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-[var(--syn-text-primary)]">{chart.label}</p>
        <p className="text-xs text-[var(--syn-text-secondary)]">{chart.rows?.length || 0} categoria(s)</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--syn-border)" />
          <XAxis
            dataKey="displayValue"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--syn-text-secondary)", fontSize: 11 }}
            interval={0}
            angle={chartData.length > 4 ? -15 : 0}
            textAnchor={chartData.length > 4 ? "end" : "middle"}
            height={chartData.length > 4 ? 50 : 30}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: "var(--syn-text-secondary)", fontSize: 11 }}
            width={30}
          />
          <Tooltip
            formatter={(value, _name, payload) => [
              `${value} (${payload?.payload?.percentage ?? 0}%)`,
              "Contagem",
            ]}
            contentStyle={{
              backgroundColor: "var(--syn-bg-primary)",
              border: "1px solid var(--syn-border)",
              borderRadius: "var(--syn-radius-card)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="var(--syn-chart-current)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SuggestedBarChart({ suggestion }) {
  const chartData = useMemo(
    () =>
      (suggestion?.rows || []).map((row) => ({
        ...row,
        displayValue: row.title || row.value,
      })),
    [suggestion]
  );
  const isCountChart = suggestion?.visualizationType !== "bar_chart";

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--syn-border)" />
        <XAxis
          dataKey="displayValue"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--syn-text-secondary)", fontSize: 11 }}
          interval={0}
          angle={chartData.length > 4 ? -15 : 0}
          textAnchor={chartData.length > 4 ? "end" : "middle"}
          height={chartData.length > 4 ? 58 : 34}
          tickFormatter={(value) => formatDistributionLabel(value)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tick={{ fill: "var(--syn-text-secondary)", fontSize: 11 }}
          width={34}
        />
        <Tooltip
          formatter={(value, _name, payload) => {
            if (isCountChart) {
              return [`${value} (${payload?.payload?.percentage ?? 0}%)`, "Contagem"];
            }
            return [value, "Valor extraido"];
          }}
          labelFormatter={(value) => formatDistributionLabel(value)}
          contentStyle={{
            backgroundColor: "var(--syn-bg-primary)",
            border: "1px solid var(--syn-border)",
            borderRadius: "var(--syn-radius-card)",
            fontSize: 12,
          }}
        />
        <Bar
          dataKey={isCountChart ? "count" : "value"}
          fill="var(--syn-chart-current)"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SuggestedQualitativeTable({ suggestion, onOpenArticle }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--syn-border)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[34%]">Artigo</TableHead>
            <TableHead className="w-[12%]">Ano</TableHead>
            <TableHead>Resposta extraida</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(suggestion.rows || []).map((row) => (
            <TableRow key={`${suggestion.rqNumber}-${row.articleId}`}>
              <TableCell className="max-w-[280px]">
                <button
                  type="button"
                  className="truncate text-left text-xs font-medium text-[var(--syn-text-primary)] hover:underline"
                  onClick={() => onOpenArticle(row.articleId)}
                  title={row.title}
                >
                  {row.title}
                </button>
              </TableCell>
              <TableCell className="text-xs text-[var(--syn-text-secondary)]">
                {row.year || "-"}
              </TableCell>
              <TableCell className="text-xs leading-5 text-[var(--syn-text-secondary)]">
                {row.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SuggestedVisualizationCard({ suggestion, onOpenArticle }) {
  const hasRows = (suggestion?.rows || []).length > 0;
  const canRenderChart = [
    "bar_chart",
    "category_bar_chart",
    "multi_category_bar_chart",
  ].includes(suggestion?.visualizationType);

  return (
    <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1 text-[11px] font-semibold text-[var(--syn-text-secondary)]">
              RQ {suggestion.rqNumber}
            </span>
            <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1 text-[11px] text-[var(--syn-text-secondary)]">
              {formatSuggestionStatus(suggestion.status)}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--syn-text-primary)]" title={suggestion.question}>
            {suggestion.question}
          </p>
          <p className="mt-2 text-xs text-[var(--syn-text-secondary)]">
            Campo: {suggestion.field?.label || "Nao configurado"}
          </p>
          <p className="mt-1 text-xs text-[var(--syn-text-secondary)]">
            Sugestao: {formatVisualizationType(suggestion.visualizationType)}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--syn-text-secondary)]">
            {suggestion.reason}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {!hasRows ? (
          <div className="rounded-md border border-dashed border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] px-3 py-4 text-xs text-[var(--syn-text-secondary)]">
            {suggestion.status === "missing_field"
              ? "Configure um campo de extracao para esta pergunta no planejamento."
              : "Preencha a extracao dos artigos incluidos para gerar esta visualizacao."}
          </div>
        ) : canRenderChart ? (
          <SuggestedBarChart suggestion={suggestion} />
        ) : (
          <SuggestedQualitativeTable suggestion={suggestion} onOpenArticle={onOpenArticle} />
        )}
      </div>
    </div>
  );
}

function ExtractionMatrixTab({ data, onOpenArticle }) {
  const columns = useMemo(
    () => [...BASE_EXTRACTION_COLUMNS, ...(data?.extractionColumns || [])],
    [data]
  );

  if (!(data?.extractionRows || []).length) {
    return (
      <EmptyState
        title="Nenhum dado de extracao ainda"
        description="Os artigos incluidos aparecerao aqui apos o salvamento da extracao ou da avaliacao de qualidade."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--syn-text-secondary)]">
          {(data?.extractionRows || []).length} linha(s) na matriz de extracao.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() =>
            triggerFileDownload(
              buildExtractionMatrixCsv(data),
              "text/csv;charset=utf-8",
              `extraction-matrix-project-${data.projectId}.csv`
            )
          }
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          CSV de extracao
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--syn-radius-card)] border border-[var(--syn-border)]">
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.label || column.key}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.extractionRows || []).map((row) => (
              <TableRow key={row.articleId}>
                {columns.map((column) => {
                  const isBaseColumn = BASE_EXTRACTION_COLUMNS.some(
                    (baseColumn) => baseColumn.key === column.key
                  );
                  const value = isBaseColumn ? row[column.key] : row.values?.[column.key];

                  if (column.key === "title") {
                    return (
                      <TableCell key={`${row.articleId}-${column.key}`} className="max-w-[280px]">
                        <button
                          type="button"
                          className="truncate text-left text-sm font-medium text-[var(--syn-text-primary)] hover:underline"
                          onClick={() => onOpenArticle(row.articleId)}
                          title={row.title}
                        >
                          {row.title}
                        </button>
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell
                      key={`${row.articleId}-${column.key}`}
                      className="text-sm text-[var(--syn-text-secondary)]"
                    >
                      {formatCellValue(value)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function GraphsTab({ data, onOpenArticle }) {
  const charts = data?.distributionCharts || [];
  const suggestions = data?.visualizationSuggestions || [];

  if (!charts.length && !suggestions.length) {
    return (
      <EmptyState
        title="Nenhum grafico disponivel"
        description="As visualizacoes aparecerao quando houver perguntas de pesquisa e dados estruturados de extracao."
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-[var(--syn-text-primary)]">Visualizacoes sugeridas por pergunta</p>
          <p className="text-xs text-[var(--syn-text-secondary)]">
            Sugestoes geradas por regras locais a partir do tipo de dado extraido.
          </p>
        </div>
        {suggestions.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {suggestions.map((suggestion) => (
              <SuggestedVisualizationCard
                key={`rq-visualization-${suggestion.rqNumber}`}
                suggestion={suggestion}
                onOpenArticle={onOpenArticle}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhuma pergunta configurada"
            description="Cadastre perguntas de pesquisa no planejamento para receber sugestoes de visualizacao."
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--syn-text-primary)]">Distribuicoes gerais</p>
            <p className="text-xs text-[var(--syn-text-secondary)]">
              {charts.length} grafico(s) disponivel(is).
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              triggerFileDownload(
                buildDistributionsCsv(data),
                "text/csv;charset=utf-8",
                `distributions-project-${data.projectId}.csv`
              )
            }
            disabled={!charts.length}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            CSV de distribuicoes
          </Button>
        </div>

        {charts.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {charts.map((chart) => (
              <DistributionChartCard key={chart.key} chart={chart} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhuma distribuicao disponivel"
            description="As distribuicoes aparecerao quando os artigos incluidos receberem valores estruturados de extracao."
          />
        )}
      </section>
    </div>
  );
}

function QualityTab({ data }) {
  const qualitySummary = data?.qualitySummary;
  const ratingChart = useMemo(
    () => ({
      key: "qualityRating",
      label: "Classificacao geral de qualidade",
      rows: qualitySummary?.byRating || [],
    }),
    [qualitySummary]
  );

  if (!qualitySummary) {
    return (
      <EmptyState
        title="Nenhum resumo de qualidade ainda"
        description="As metricas de qualidade aparecerao quando os artigos incluidos receberem respostas de avaliacao."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="grid flex-1 gap-3 md:grid-cols-3">
          <MiniMetric label="Artigos avaliados" value={qualitySummary.ratedArticles || 0} />
          <MiniMetric label="Artigos sem nota" value={qualitySummary.unratedArticles || 0} />
          <MiniMetric
            label="Pontuacao media"
            value={qualitySummary.averageScore != null ? `${qualitySummary.averageScore}%` : "-"}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() =>
            triggerFileDownload(
              buildQualitySummaryCsv(data),
              "text/csv;charset=utf-8",
              `quality-summary-project-${data.projectId}.csv`
            )
          }
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          CSV de qualidade
        </Button>
      </div>

      <DistributionChartCard chart={ratingChart} />

      {(qualitySummary.byCriterion || []).length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {qualitySummary.byCriterion.map((criterion) => (
            <DistributionChartCard
              key={criterion.key}
              chart={{
                key: criterion.key,
                label: criterion.label,
                rows: criterion.rows,
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhuma resposta de criterio ainda"
          description="Salve as respostas de qualidade nos workspaces dos artigos para preencher esta secao."
        />
      )}
    </div>
  );
}

function SynthesisReportPanel({
  data,
  isLoading,
  onRefresh,
  onOpenArticle,
}) {
  const [activeTab, setActiveTab] = useState("rqs");

  if (!data && !isLoading) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--syn-text-primary)]">Workspace de sintese</p>
          <p className="text-xs text-[var(--syn-text-secondary)]">
            Reune RQs, matriz de extracao, distribuicoes e qualidade em um unico lugar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? "Carregando..." : "Atualizar"}
          </Button>
          {data ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                triggerFileDownload(
                  buildSynthesisReportJson(data),
                  "application/json;charset=utf-8",
                  `synthesis-report-project-${data.projectId}.json`
                )
              }
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              JSON
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full flex-wrap gap-2 bg-transparent p-0">
          <TabsTrigger
            value="rqs"
            className="border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] data-[state=active]:bg-[var(--syn-sidebar-accent)] data-[state=active]:text-white"
          >
            RQs
          </TabsTrigger>
          <TabsTrigger
            value="extraction"
            className="border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] data-[state=active]:bg-[var(--syn-sidebar-accent)] data-[state=active]:text-white"
          >
            Extracao
          </TabsTrigger>
          <TabsTrigger
            value="distributions"
            className="border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] data-[state=active]:bg-[var(--syn-sidebar-accent)] data-[state=active]:text-white"
          >
            Graficos
          </TabsTrigger>
          <TabsTrigger
            value="quality"
            className="border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] data-[state=active]:bg-[var(--syn-sidebar-accent)] data-[state=active]:text-white"
          >
            Qualidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rqs" className="mt-3">
          <RQSynthesisPanel
            data={data}
            isLoading={isLoading}
            onRefresh={onRefresh}
            onOpenArticle={onOpenArticle}
          />
        </TabsContent>

        <TabsContent value="extraction" className="mt-3">
          <ExtractionMatrixTab data={data} onOpenArticle={onOpenArticle} />
        </TabsContent>

        <TabsContent value="distributions" className="mt-3">
          <GraphsTab data={data} onOpenArticle={onOpenArticle} />
        </TabsContent>

        <TabsContent value="quality" className="mt-3">
          <QualityTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SynthesisReportPanel;
