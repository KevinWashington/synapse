import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DownloadIcon,
  FileDownIcon,
  FileTextIcon,
  ImageIcon,
  PencilIcon,
  LoaderIcon,
  ChevronDownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { articleService } from "@/features/articles/services/articleService";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/DropdownMenu";

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatPercent(value, total) {
  if (!total) {
    return "0%";
  }

  return `${Number((value / total) * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildFlowSvg(metrics, projectTitle) {
  const sourceLines = metrics.sources.length
    ? metrics.sources.slice(0, 4).map((item, index) => (
      `<text x="128" y="${index * 22 + 136}" fill="#56627f" font-size="14">${escapeXml(item.sourceName)}: ${item.total}</text>`
    )).join("")
    : `<text x="128" y="136" fill="#56627f" font-size="14">Sem fontes cadastradas</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="820" viewBox="0 0 1200 820" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="820" rx="24" fill="#ffffff"/>
  <text x="60" y="64" fill="#111936" font-family="Arial" font-size="28" font-weight="700">${escapeXml(projectTitle)}</text>
  <text x="60" y="96" fill="#56627f" font-family="Arial" font-size="16">Fluxo PRISMA</text>
  <rect x="60" y="124" width="300" height="108" rx="12" fill="#ffffff" stroke="#9bb6ff"/>
  <text x="128" y="156" fill="#111936" font-family="Arial" font-size="16" font-weight="700">Registros identificados</text>
  <text x="128" y="180" fill="#111936" font-family="Arial" font-size="16" font-weight="700">(n = ${metrics.identified})</text>
  ${sourceLines}
  <rect x="530" y="136" width="360" height="92" rx="12" fill="#ffffff" stroke="#dfe4ef"/>
  <text x="560" y="168" fill="#111936" font-family="Arial" font-size="16" font-weight="700">Registros removidos antes da triagem</text>
  <text x="560" y="196" fill="#56627f" font-family="Arial" font-size="14">Duplicatas (n = ${metrics.duplicatesRemoved})</text>
  <rect x="60" y="300" width="300" height="76" rx="12" fill="#ffffff" stroke="#9bb6ff"/>
  <text x="132" y="333" fill="#111936" font-family="Arial" font-size="16" font-weight="700">Registros para triagem</text>
  <text x="156" y="358" fill="#111936" font-family="Arial" font-size="16" font-weight="700">(n = ${metrics.screeningPool})</text>
  <rect x="530" y="304" width="360" height="68" rx="12" fill="#ffffff" stroke="#dfe4ef"/>
  <text x="560" y="336" fill="#111936" font-family="Arial" font-size="16" font-weight="700">Registros excluidos</text>
  <text x="560" y="360" fill="#111936" font-family="Arial" font-size="16">(n = ${metrics.excludedScreening})</text>
  <rect x="60" y="460" width="300" height="76" rx="12" fill="#ffffff" stroke="#78d3a4"/>
  <text x="94" y="493" fill="#111936" font-family="Arial" font-size="16" font-weight="700">Relatorios buscados para recuperacao</text>
  <text x="156" y="518" fill="#111936" font-family="Arial" font-size="16" font-weight="700">(n = ${metrics.reportsSought})</text>
  <rect x="530" y="464" width="360" height="68" rx="12" fill="#ffffff" stroke="#dfe4ef"/>
  <text x="560" y="496" fill="#111936" font-family="Arial" font-size="16" font-weight="700">Relatorios nao recuperados</text>
  <text x="560" y="520" fill="#111936" font-family="Arial" font-size="16">(n = ${metrics.fullTextUnavailable})</text>
  <rect x="60" y="584" width="300" height="76" rx="12" fill="#ffffff" stroke="#78d3a4"/>
  <text x="102" y="617" fill="#111936" font-family="Arial" font-size="16" font-weight="700">Relatorios avaliados para elegibilidade</text>
  <text x="156" y="642" fill="#111936" font-family="Arial" font-size="16" font-weight="700">(n = ${metrics.reportsAssessed})</text>
  <rect x="530" y="572" width="360" height="104" rx="12" fill="#ffffff" stroke="#dfe4ef"/>
  <text x="560" y="604" fill="#111936" font-family="Arial" font-size="16" font-weight="700">Relatorios excluidos</text>
  <text x="560" y="628" fill="#111936" font-family="Arial" font-size="16">(n = ${metrics.excludedEligibility})</text>
  <rect x="60" y="720" width="300" height="76" rx="12" fill="#fff9ed" stroke="#ffc66f"/>
  <text x="98" y="753" fill="#111936" font-family="Arial" font-size="16" font-weight="700">Estudos incluidos na revisao</text>
  <text x="156" y="778" fill="#111936" font-family="Arial" font-size="16" font-weight="700">(n = ${metrics.included})</text>
  <path d="M360 178 H500" stroke="#667391" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M210 232 V292" stroke="#667391" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M360 338 H500" stroke="#667391" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M210 376 V452" stroke="#667391" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M360 498 H500" stroke="#667391" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M210 536 V576" stroke="#667391" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M360 622 H500" stroke="#667391" stroke-width="2" marker-end="url(#arrow)"/>
  <path d="M210 660 V712" stroke="#667391" stroke-width="2" marker-end="url(#arrow)"/>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L6,3 z" fill="#667391" />
    </marker>
  </defs>
</svg>`;
}

async function downloadSvgAsPng(svg, filename) {
  const image = new Image();
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 820;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  URL.revokeObjectURL(url);

  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!pngBlob) {
    throw new Error("Nao foi possivel gerar o PNG.");
  }

  const pngUrl = URL.createObjectURL(pngBlob);
  const anchor = document.createElement("a");
  anchor.href = pngUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
}

function FlowBox({ children, tone = "blue", className }) {
  const toneClass = {
    blue: "border-[#9bb6ff] bg-white",
    green: "border-[#7ed7a7] bg-white",
    orange: "border-[#ffc66f] bg-[#fffaf0]",
    neutral: "border-[#dfe4ef] bg-white",
  }[tone];

  return (
    <div className={cn("min-w-0 break-words rounded-lg border px-4 py-4 text-center", toneClass, className)}>
      {children}
    </div>
  );
}

function StageLabel({ label, tone }) {
  const toneClass = {
    blue: "bg-[#eef3ff] text-[#4d68ff]",
    green: "bg-[#eefaf3] text-[#2fa060]",
    orange: "bg-[#fff4df] text-[#f59a00]",
  }[tone];

  return (
    <div className={cn("flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide md:min-h-[100px] md:w-9 md:px-1 md:[writing-mode:vertical-rl] md:rotate-180", toneClass)}>
      {label}
    </div>
  );
}

function ArrowRight() {
  return <div aria-hidden="true" className="hidden h-px flex-1 bg-[#8a95ad] after:ml-auto after:block after:h-0 after:w-0 after:-translate-y-[5px] after:border-y-[5px] after:border-l-[8px] after:border-y-transparent after:border-l-[#8a95ad] md:block" />;
}

function ArrowDown() {
  return <div aria-hidden="true" className="mx-auto h-5 w-px bg-[#8a95ad] after:block after:h-0 after:w-0 after:-translate-x-[5px] after:translate-y-5 after:border-x-[5px] after:border-t-[8px] after:border-x-transparent after:border-t-[#8a95ad]" />;
}

function SummaryRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={highlight ? "font-semibold text-[#6259ff]" : "text-[#56627f]"}>{label}</span>
      <span className={highlight ? "font-semibold text-[#6259ff]" : "font-semibold text-[#111936]"}>{formatNumber(value)}</span>
    </div>
  );
}

function Donut({ value, total }) {
  const percent = total ? Math.min(100, Math.round((value / total) * 1000) / 10) : 0;
  return (
    <div className="flex items-center gap-5">
      <div
        className="grid h-24 w-24 place-items-center rounded-full"
        style={{ background: `conic-gradient(#6259ff ${percent}%, #dcd8ff ${percent}% 100%)` }}
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-base font-semibold text-[#111936]">
          {formatPercent(value, total)}
        </div>
      </div>
      <div>
        <p className="text-lg font-semibold text-[#111936]">{formatNumber(value)} de {formatNumber(total)}</p>
        <p className="text-sm text-[#667391]">estudos incluidos</p>
      </div>
    </div>
  );
}

function ProjectPrismaFlow({ project, onEditFlow }) {
  const [summary, setSummary] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("diagram");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [summaryResponse, reportResponse] = await Promise.all([
        articleService.getSelectionSummary(project.id),
        articleService.getSelectionReport(project.id),
      ]);
      setSummary(summaryResponse);
      setReport(reportResponse);
    } catch (currentError) {
      setError(currentError.message || "Não foi possível carregar o fluxo PRISMA.");
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = useMemo(() => {
    const counts = report?.counts || {};
    const identified = counts.identified ?? summary?.totalRecords ?? 0;
    const duplicatesRemoved = counts.duplicatesRemoved ?? summary?.duplicatesRemoved ?? 0;
    const screeningPool = counts.screeningPool ?? summary?.screening?.total ?? 0;
    const excludedScreening = counts.excludedScreening ?? summary?.screening?.excluded ?? 0;
    const reportsSought = Math.max(screeningPool - excludedScreening, 0);
    const fullTextUnavailable = counts.fullTextUnavailable ?? summary?.fullTextUnavailable ?? 0;
    const reportsAssessed = Math.max(reportsSought - fullTextUnavailable, 0);
    const excludedEligibility = counts.excludedEligibility ?? Math.max((summary?.eligibility?.excluded || 0) - fullTextUnavailable, 0);
    const included = counts.included ?? summary?.included ?? 0;

    return {
      identified,
      duplicatesRemoved,
      screeningPool,
      excludedScreening,
      reportsSought,
      fullTextUnavailable,
      reportsAssessed,
      excludedEligibility,
      included,
      sources: report?.bySource || summary?.bySource || [],
    };
  }, [report, summary]);

  async function handleExportCsv() {
    try {
      await articleService.exportSelectionReport(project.id, "csv");
      toast.success("Dados do fluxo exportados.");
    } catch (error) {
      toast.error(`Erro ao exportar CSV: ${error.message}`);
    }
  }

  async function handleExportJson() {
    try {
      await articleService.exportSelectionReport(project.id, "json");
      toast.success("Relatorio do fluxo exportado.");
    } catch (error) {
      toast.error(`Erro ao exportar JSON: ${error.message}`);
    }
  }

  async function handleExportPng() {
    try {
      const svg = buildFlowSvg(metrics, project.title || "Projeto");
      await downloadSvgAsPng(svg, `fluxo-prisma-projeto-${project.id}.png`);
      toast.success("Imagem PNG gerada.");
    } catch (error) {
      toast.error(`Erro ao gerar PNG: ${error.message}`);
    }
  }

  function handleExportPdf() {
    const svg = buildFlowSvg(metrics, project.title || "Projeto");
    const html = `<!doctype html><html><head><title>Fluxo PRISMA</title><style>body{margin:0;padding:24px;background:#fff;font-family:Arial,sans-serif}svg{width:100%;height:auto}</style></head><body>${svg}<script>window.onload=function(){window.print()}</script></body></html>`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Nao foi possivel abrir a janela de impressao.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  }

  const sourceText = metrics.sources.length
    ? metrics.sources.slice(0, 4).map((item) => `${item.sourceName} (${formatNumber(item.total)})`).join(" · ") + (metrics.sources.length > 4 ? ` · +${metrics.sources.length - 4} fontes em Resumo e fontes` : "")
    : "Sem fontes cadastradas";

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#e2e6ef] bg-white">
      <section>
        <header className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#111936]">Fluxo PRISMA</h2>
            <p className="mt-1 text-sm text-[#667391]">Da identificação à inclusão: acompanhe o percurso dos registros e exporte o fluxo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2 border-[#dfe4ef] bg-white" onClick={onEditFlow}>
            <PencilIcon className="h-4 w-4" />
            Revisar registros
          </Button>
          <DropdownMenu><DropdownMenuTrigger asChild>
            <Button disabled={loading || Boolean(error)} className="gap-2 bg-[#6259ff] text-white hover:bg-[#5148ee]"><DownloadIcon className="h-4 w-4" />Exportar<ChevronDownIcon className="h-4 w-4" /></Button>
          </DropdownMenuTrigger><DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={handleExportPng}><ImageIcon className="h-4 w-4" />Imagem (PNG)</DropdownMenuItem>
            <DropdownMenuItem onSelect={handleExportPdf}><FileDownIcon className="h-4 w-4" />Documento (PDF)</DropdownMenuItem>
            <DropdownMenuItem onSelect={handleExportCsv}><DownloadIcon className="h-4 w-4" />Dados (CSV)</DropdownMenuItem>
            <DropdownMenuItem onSelect={handleExportJson}><FileTextIcon className="h-4 w-4" />Relatório (JSON)</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenu>
          </div>
        </header>
        <nav aria-label="Seções do fluxo" className="grid grid-cols-2 border-y border-[#edf0f7] bg-[#fbfcff]">
          {[["diagram", "Diagrama"], ["summary", "Resumo e fontes"]].map(([key, label]) => <button type="button" key={key}
            aria-pressed={activeTab === key} onClick={() => setActiveTab(key)}
            className={cn("min-w-0 border-b-2 px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#6259ff]", activeTab === key ? "border-[#6259ff] bg-white text-[#554bea]" : "border-transparent text-[#667391] hover:text-[#111936]")}>{label}</button>)}
        </nav>
        {error ? <div role="alert" className="space-y-3 p-5 text-sm text-[#667391]"><p>{error}</p><Button variant="outline" onClick={loadData}>Tentar novamente</Button></div> :
        loading ? (
          <div role="status" className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-[#667391]"><LoaderIcon className="h-4 w-4 animate-spin" />Carregando fluxo...</div>
        ) : activeTab === "diagram" ? (
          <section aria-label="Diagrama PRISMA" className="min-w-0 p-4 sm:p-5">
            <div className="mx-auto max-w-[1100px] space-y-3">
              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[40px_minmax(0,1fr)_24px_minmax(0,1fr)]">
                <StageLabel label="Identificação" tone="blue" />
                <FlowBox tone="blue">
                  <p className="text-base font-semibold text-[#111936]">Registros identificados em bases de dados</p>
                  <p className="mt-1 text-base font-semibold text-[#111936]">(n = {formatNumber(metrics.identified)})</p>
                  <p className="mt-4 text-sm leading-6 text-[#56627f]">{sourceText}</p>
                </FlowBox>
                <ArrowRight />
                <FlowBox tone="neutral" className="text-left">
                  <p className="font-semibold text-[#111936]">Registros removidos antes da triagem:</p>
                  <p className="mt-2 text-sm text-[#56627f]">Duplicatas (n = {formatNumber(metrics.duplicatesRemoved)})</p>
                </FlowBox>
              </div>

              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[40px_minmax(0,1fr)_24px_minmax(0,1fr)]">
                <div className="hidden md:block" />
                <ArrowDown />
              </div>

              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[40px_minmax(0,1fr)_24px_minmax(0,1fr)]">
                <StageLabel label="Triagem" tone="blue" />
                <FlowBox tone="blue">
                  <p className="text-base font-semibold text-[#111936]">Registros para triagem</p>
                  <p className="mt-1 text-base font-semibold text-[#111936]">(n = {formatNumber(metrics.screeningPool)})</p>
                </FlowBox>
                <ArrowRight />
                <FlowBox tone="neutral" className="text-left">
                  <p className="font-semibold text-[#111936]">Registros excluídos</p>
                  <p className="mt-2 text-sm text-[#56627f]">(n = {formatNumber(metrics.excludedScreening)})</p>
                </FlowBox>
              </div>

              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[40px_minmax(0,1fr)_24px_minmax(0,1fr)]">
                <div className="hidden md:block" />
                <ArrowDown />
              </div>

              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[40px_minmax(0,1fr)_24px_minmax(0,1fr)]">
                <StageLabel label="Elegibilidade" tone="green" />
                <FlowBox tone="green">
                  <p className="text-base font-semibold text-[#111936]">Relatórios buscados para recuperação</p>
                  <p className="mt-1 text-base font-semibold text-[#111936]">(n = {formatNumber(metrics.reportsSought)})</p>
                </FlowBox>
                <ArrowRight />
                <FlowBox tone="neutral" className="text-left">
                  <p className="font-semibold text-[#111936]">Relatórios não recuperados</p>
                  <p className="mt-2 text-sm text-[#56627f]">(n = {formatNumber(metrics.fullTextUnavailable)})</p>
                </FlowBox>
              </div>

              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[40px_minmax(0,1fr)_24px_minmax(0,1fr)]">
                <div className="hidden md:block" />
                <ArrowDown />
              </div>

              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[40px_minmax(0,1fr)_24px_minmax(0,1fr)]">
                <div className="hidden md:block" />
                <FlowBox tone="green">
                  <p className="text-base font-semibold text-[#111936]">Relatórios avaliados para elegibilidade</p>
                  <p className="mt-1 text-base font-semibold text-[#111936]">(n = {formatNumber(metrics.reportsAssessed)})</p>
                </FlowBox>
                <ArrowRight />
                <FlowBox tone="neutral" className="text-left">
                  <p className="font-semibold text-[#111936]">Relatórios excluídos</p>
                  <p className="mt-2 text-sm text-[#56627f]">(n = {formatNumber(metrics.excludedEligibility)})</p>
                  <div className="max-h-40 overflow-y-auto">{(report?.exclusionReasons?.eligibility || []).map((item) => (
                    <p key={item.reason} className="mt-1 text-sm text-[#56627f]">- {item.reason} (n = {formatNumber(item.count)})</p>
                  ))}</div>
                </FlowBox>
              </div>

              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[40px_minmax(0,1fr)_24px_minmax(0,1fr)]">
                <div className="hidden md:block" />
                <ArrowDown />
              </div>

              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[40px_minmax(0,1fr)_24px_minmax(0,1fr)]">
                <StageLabel label="Inclusão" tone="orange" />
                <FlowBox tone="orange">
                  <p className="text-base font-semibold text-[#111936]">Estudos incluídos na revisão</p>
                  <p className="mt-1 text-base font-semibold text-[#111936]">(n = {formatNumber(metrics.included)})</p>
                </FlowBox>
              </div>
            </div>
          </section>
        ) : null}
      </section>

      {!loading && !error && activeTab === "summary" && <div className="grid min-w-0 divide-y divide-[#edf0f7] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <section aria-label="Resumo do fluxo" className="min-w-0 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-[#111936]">Resumo do fluxo</h3>
          <div className="mt-6 space-y-5">
            <SummaryRow label="Registros identificados" value={metrics.identified} />
            <SummaryRow label="Duplicatas removidas" value={metrics.duplicatesRemoved} />
            <SummaryRow label="Registros para triagem" value={metrics.screeningPool} />
            <SummaryRow label="Registros excluídos na triagem" value={metrics.excludedScreening} />
            <SummaryRow label="Relatórios não recuperados" value={metrics.fullTextUnavailable} />
            <SummaryRow label="Relatórios avaliados para elegibilidade" value={metrics.reportsAssessed} />
            <SummaryRow label="Relatórios excluídos na elegibilidade" value={metrics.excludedEligibility} />
            <SummaryRow label="Estudos incluídos" value={metrics.included} highlight />
          </div>
          <div className="mt-8">
            <Donut value={metrics.included} total={metrics.reportsSought} />
            <p className="mt-2 text-center text-xs text-[#667391]">Proporção de incluídos em relação aos relatórios buscados.</p>
          </div>
        </section>

        <section aria-label="Fontes do fluxo" className="min-w-0 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-[#111936]">Fontes de dados</h3>
          <p className="mt-1 text-sm text-[#667391]">{metrics.sources.length} fontes na revisão.</p>
          <div className="mt-5 max-h-[320px] overflow-y-auto divide-y divide-[#edf0f7]">
            {metrics.sources.map((source) => <div key={source.sourceName} className="flex items-start justify-between gap-4 py-3 text-sm"><span className="min-w-0 break-words text-[#56627f]">{source.sourceName}</span><span className="shrink-0 font-semibold text-[#111936]">{formatNumber(source.total)}</span></div>)}
            {!metrics.sources.length && <p className="text-sm text-[#667391]">Sem fontes cadastradas.</p>}
          </div>
        </section>
      </div>}
    </div>
  );
}

export default ProjectPrismaFlow;
