import { DatabaseIcon, DownloadIcon, GitBranchIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function IncludedExtractionTool({
  article,
  project,
  summary,
  onOpenExtraction,
  onExport,
  onViewFlow,
}) {
  const schema = project?.dataExtractionSchema || [];
  const extractionData = article?.extractionData || {};
  const completed = schema.filter((field) => {
    const value = extractionData[field.key];
    return value !== undefined && value !== null && value !== "";
  }).length;

  return (
    <aside className="h-full bg-[#fbfbfe] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a94aa]">Inclusão</p>
      <h2 className="mt-2 text-base font-semibold text-[#111936]">Preparar síntese</h2>

      <div className="mt-5 space-y-2 border-y border-[#e5e8f0] py-4">
        <p className="text-sm font-semibold text-[#111936]">{formatNumber(summary?.included)} estudos incluídos</p>
        <p className="text-sm text-[#6259ff]">{formatNumber(summary?.pendingExtraction)} pendentes de extração</p>
      </div>

      {article ? (
        <div className="mt-4 rounded-lg border border-[#dfe3ee] bg-white p-3">
          <p className="line-clamp-2 text-xs font-semibold text-[#111936]">{article.title}</p>
          <p className="mt-2 text-xs text-[#667391]">{completed} de {schema.length} campos preenchidos</p>
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        <Button
          className="h-10 w-full justify-start gap-2 bg-[#6259ff] text-white hover:bg-[#5148ee]"
          disabled={!article}
          onClick={() => article && onOpenExtraction(article.id)}
        >
          <DatabaseIcon className="h-4 w-4" />
          Abrir extração
        </Button>
        <Button variant="outline" className="h-10 w-full justify-start gap-2 bg-white" onClick={onViewFlow}>
          <GitBranchIcon className="h-4 w-4" />
          Ver fluxograma PRISMA
        </Button>
        <Button variant="outline" className="h-10 w-full justify-start gap-2 bg-white" onClick={onExport}>
          <DownloadIcon className="h-4 w-4" />
          Exportar incluídos
        </Button>
      </div>
    </aside>
  );
}

export default IncludedExtractionTool;
