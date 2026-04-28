import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DownloadIcon,
  FileDownIcon,
  FileTextIcon,
  ImageIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { articleService } from "@/features/articles/services/articleService";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

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
  <text x="60" y="96" fill="#56627f" font-family="Arial" font-size="16">Fluxo PRISMA 2020</text>
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
    <div className={cn("rounded-lg border px-6 py-4 text-center shadow-[0_8px_20px_rgba(17,25,54,0.03)]", toneClass, className)}>
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
    <div className={cn("flex min-h-[110px] w-12 items-center justify-center rounded-lg text-xs font-bold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180", toneClass)}>
      {label}
    </div>
  );
}

function ArrowRight() {
  return <div className="hidden h-px flex-1 bg-[#8a95ad] after:ml-auto after:block after:h-0 after:w-0 after:-translate-y-[5px] after:border-y-[5px] after:border-l-[8px] after:border-y-transparent after:border-l-[#8a95ad] lg:block" />;
}

function ArrowDown() {
  return <div className="mx-auto h-10 w-px bg-[#8a95ad] after:block after:h-0 after:w-0 after:-translate-x-[5px] after:translate-y-10 after:border-x-[5px] after:border-t-[8px] after:border-x-transparent after:border-t-[#8a95ad]" />;
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryResponse, reportResponse] = await Promise.all([
        articleService.getSelectionSummary(project.id),
        articleService.getSelectionReport(project.id),
      ]);
      setSummary(summaryResponse);
      setReport(reportResponse);
    } catch (error) {
      toast.error(`Erro ao carregar fluxo PRISMA: ${error.message}`);
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
    ? metrics.sources.slice(0, 4).map((item) => `${item.sourceName} (${formatNumber(item.total)})`).join(" · ")
    : "Sem fontes cadastradas";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-lg border border-[#edf0f7] bg-white p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#111936]">Fluxo PRISMA 2020</h2>
            <p className="mt-2 text-sm text-[#56627f]">Acompanhe o fluxo de selecao dos estudos ao longo das etapas da revisao.</p>
          </div>
          <Button variant="outline" className="h-10 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onEditFlow}>
            <PencilIcon className="h-4 w-4" />
            Editar fluxograma
          </Button>
        </div>

        {loading ? (
          <div className="grid min-h-[520px] place-items-center text-sm text-[#667391]">Carregando fluxo...</div>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <div className="min-w-[860px] space-y-4 pb-4">
              <div className="grid grid-cols-[64px_minmax(280px,1fr)_80px_minmax(280px,1fr)] items-center gap-5">
                <StageLabel label="Identificacao" tone="blue" />
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

              <div className="grid grid-cols-[64px_minmax(280px,1fr)_80px_minmax(280px,1fr)] items-center gap-5">
                <div />
                <ArrowDown />
              </div>

              <div className="grid grid-cols-[64px_minmax(280px,1fr)_80px_minmax(280px,1fr)] items-center gap-5">
                <StageLabel label="Triagem" tone="blue" />
                <FlowBox tone="blue">
                  <p className="text-base font-semibold text-[#111936]">Registros para triagem</p>
                  <p className="mt-1 text-base font-semibold text-[#111936]">(n = {formatNumber(metrics.screeningPool)})</p>
                </FlowBox>
                <ArrowRight />
                <FlowBox tone="neutral" className="text-left">
                  <p className="font-semibold text-[#111936]">Registros excluidos</p>
                  <p className="mt-2 text-sm text-[#56627f]">(n = {formatNumber(metrics.excludedScreening)})</p>
                </FlowBox>
              </div>

              <div className="grid grid-cols-[64px_minmax(280px,1fr)_80px_minmax(280px,1fr)] items-center gap-5">
                <div />
                <ArrowDown />
              </div>

              <div className="grid grid-cols-[64px_minmax(280px,1fr)_80px_minmax(280px,1fr)] items-center gap-5">
                <StageLabel label="Elegibilidade" tone="green" />
                <FlowBox tone="green">
                  <p className="text-base font-semibold text-[#111936]">Relatorios buscados para recuperacao</p>
                  <p className="mt-1 text-base font-semibold text-[#111936]">(n = {formatNumber(metrics.reportsSought)})</p>
                </FlowBox>
                <ArrowRight />
                <FlowBox tone="neutral" className="text-left">
                  <p className="font-semibold text-[#111936]">Relatorios nao recuperados</p>
                  <p className="mt-2 text-sm text-[#56627f]">(n = {formatNumber(metrics.fullTextUnavailable)})</p>
                </FlowBox>
              </div>

              <div className="grid grid-cols-[64px_minmax(280px,1fr)_80px_minmax(280px,1fr)] items-center gap-5">
                <div />
                <ArrowDown />
              </div>

              <div className="grid grid-cols-[64px_minmax(280px,1fr)_80px_minmax(280px,1fr)] items-center gap-5">
                <div />
                <FlowBox tone="green">
                  <p className="text-base font-semibold text-[#111936]">Relatorios avaliados para elegibilidade</p>
                  <p className="mt-1 text-base font-semibold text-[#111936]">(n = {formatNumber(metrics.reportsAssessed)})</p>
                </FlowBox>
                <ArrowRight />
                <FlowBox tone="neutral" className="text-left">
                  <p className="font-semibold text-[#111936]">Relatorios excluidos</p>
                  <p className="mt-2 text-sm text-[#56627f]">(n = {formatNumber(metrics.excludedEligibility)})</p>
                  {(report?.exclusionReasons?.eligibility || []).slice(0, 4).map((item) => (
                    <p key={item.reason} className="mt-1 text-sm text-[#56627f]">- {item.reason} (n = {formatNumber(item.count)})</p>
                  ))}
                </FlowBox>
              </div>

              <div className="grid grid-cols-[64px_minmax(280px,1fr)_80px_minmax(280px,1fr)] items-center gap-5">
                <div />
                <ArrowDown />
              </div>

              <div className="grid grid-cols-[64px_minmax(280px,1fr)_80px_minmax(280px,1fr)] items-center gap-5">
                <StageLabel label="Inclusao" tone="orange" />
                <FlowBox tone="orange">
                  <p className="text-base font-semibold text-[#111936]">Estudos incluidos na revisao</p>
                  <p className="mt-1 text-base font-semibold text-[#111936]">(n = {formatNumber(metrics.included)})</p>
                  <p className="mt-4 text-sm text-[#56627f]">Relatorios de estudos incluidos (n = {formatNumber(metrics.included)})</p>
                </FlowBox>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-[#edf0f7] pt-4 text-xs text-[#56627f]">
          * Fluxo baseado no PRISMA 2020. Os numeros sao calculados a partir das decisoes reais dos artigos do projeto.
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-lg border border-[#edf0f7] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111936]">Resumo do fluxo</h3>
          <div className="mt-6 space-y-5">
            <SummaryRow label="Registros identificados" value={metrics.identified} />
            <SummaryRow label="Duplicatas removidas" value={metrics.duplicatesRemoved} />
            <SummaryRow label="Registros para triagem" value={metrics.screeningPool} />
            <SummaryRow label="Registros excluidos" value={metrics.excludedScreening} />
            <SummaryRow label="Relatorios avaliados para elegibilidade" value={metrics.reportsAssessed} />
            <SummaryRow label="Relatorios excluidos" value={metrics.excludedEligibility} />
            <SummaryRow label="Estudos incluidos" value={metrics.included} highlight />
          </div>
          <div className="mt-8">
            <Donut value={metrics.included} total={metrics.reportsSought} />
          </div>
        </section>

        <section className="rounded-lg border border-[#edf0f7] bg-white p-6">
          <h3 className="text-base font-semibold text-[#111936]">Exportar fluxo</h3>
          <div className="mt-5 space-y-3">
            <Button variant="outline" className="h-10 w-full justify-start gap-3 rounded-lg border-[#dfe4ef] bg-white" onClick={handleExportPng}>
              <ImageIcon className="h-4 w-4" />
              Exportar como imagem (PNG)
            </Button>
            <Button variant="outline" className="h-10 w-full justify-start gap-3 rounded-lg border-[#dfe4ef] bg-white" onClick={handleExportPdf}>
              <FileDownIcon className="h-4 w-4" />
              Exportar como PDF
            </Button>
            <Button variant="outline" className="h-10 w-full justify-start gap-3 rounded-lg border-[#dfe4ef] bg-white" onClick={handleExportCsv}>
              <DownloadIcon className="h-4 w-4" />
              Exportar dados (CSV)
            </Button>
            <Button variant="outline" className="h-10 w-full justify-start gap-3 rounded-lg border-[#dfe4ef] bg-white" onClick={handleExportJson}>
              <FileTextIcon className="h-4 w-4" />
              Exportar relatorio (JSON)
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-[#edf0f7] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-[#111936]">Notas</h3>
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white">
              <PlusIcon className="h-4 w-4" />
              Adicionar nota
            </Button>
          </div>
          <p className="mt-8 text-sm leading-6 text-[#667391]">
            Nenhuma nota adicionada. Adicione observacoes sobre seu fluxo PRISMA.
          </p>
        </section>
      </aside>
    </div>
  );
}

export default ProjectPrismaFlow;
