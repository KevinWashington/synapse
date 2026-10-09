import { CheckCircle2Icon, DownloadIcon, ExternalLinkIcon, GitBranchIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { collaborativeReview } from "../../utils/collaborativeReview";
import { getExtractionProgress, hasExtractionValue } from "../../utils/reviewWorkspace";

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function IncludedExtractionTool({
  article,
  project,
  summary,
  extractionFormId,
  isSaving = false,
  onOpenExtraction,
  onExport,
  onViewFlow,
}) {
  const schema = project?.dataExtractionSchema || [];
  const extractionData = article?.extractionData || {};
  const progress = getExtractionProgress(article, schema);
  const pendingFields = schema.filter((field) => !hasExtractionValue(extractionData[field.key]));
  const review = collaborativeReview(article);
  const canEdit = Boolean(article && review.canWrite && schema.length);

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
          <p className="mt-2 text-xs text-[#667391]">
            {schema.length ? `${progress.completed} de ${progress.total} campos preenchidos` : "Nenhum campo configurado"}
          </p>
          {pendingFields.length ? (
            <p className="mt-2 text-xs leading-5 text-[#8a5a00]">
              Pendente: {pendingFields.slice(0, 3).map((field) => field.label).join(", ")}
            </p>
          ) : null}
          {!review.canWrite && review.writeExplanation ? (
            <p className="mt-2 text-xs leading-5 text-[#667391]">{review.writeExplanation}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        <Button
          type="submit"
          form={extractionFormId}
          value="draft"
          className="h-10 w-full justify-start gap-2 bg-[#6259ff] text-white hover:bg-[#5148ee]"
          disabled={!canEdit || isSaving}
        >
          <SaveIcon className="h-4 w-4" />
          {isSaving ? "Salvando..." : "Salvar rascunho"}
        </Button>
        <Button
          type="submit"
          form={extractionFormId}
          value="complete"
          variant="outline"
          className="h-10 w-full justify-start gap-2 bg-white"
          disabled={!canEdit || isSaving}
        >
          <CheckCircle2Icon className="h-4 w-4" />
          Concluir extração
        </Button>
        {article && onOpenExtraction ? <Button variant="outline" className="h-10 w-full justify-start gap-2 bg-white" onClick={() => onOpenExtraction(article.id)}>
          <ExternalLinkIcon className="h-4 w-4" />
          Abrir em modo de foco
        </Button> : null}
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
