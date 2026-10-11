import { CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, DatabaseIcon, ExternalLinkIcon, FileTextIcon, HelpCircleIcon, SparklesIcon, UploadIcon, XIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getExtractionProgress, hasExtractionValue } from "@features/articles/utils/reviewWorkspace";
import { cn } from "@/lib/utils";
import ReviewAssignmentStatus from "@/features/articles/components/ReviewAssignmentStatus";
import { getArticleBadge } from "@/features/articles/components/review/ReviewQueuePanel";
import { collaborativeReview } from "@/features/articles/utils/collaborativeReview";


function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}




export function ArticleDetailPanel({
  activeStage,
  article,
  currentIndex,
  onClose,
  onSkip,
  onNext,
  onOpenArticle,
  onOpenEligibility,
  onOpenScreening,
  onOpenUploadPdf,
  onPrevious,
  project,
  total,
}) {
  if (!article) {
    return (
      <section className="grid min-h-[520px] place-items-center rounded-lg border border-[#edf0f7] bg-white p-6 text-center">
        <div>
          <FileTextIcon className="mx-auto h-10 w-10 text-[#a4adc2]" />
          <p className="mt-3 text-sm font-semibold text-[#111936]">Selecione um artigo</p>
          <p className="mt-1 text-sm text-[#667391]">O detalhe do registro aparece aqui.</p>
        </div>
      </section>
    );
  }

  const badge = getArticleBadge(article, activeStage, new Set(), project?.dataExtractionSchema || []);
  const review = collaborativeReview(article);
  const isIncludedStage = activeStage === "included";
  const extractionSchema = project?.dataExtractionSchema || [];
  const extractionData = article.extractionData || {};
  const completedFields = getExtractionProgress(article, extractionSchema).completed;

  return (
    <section className="min-w-0 rounded-lg border border-[#edf0f7] bg-white">
      <div className="flex items-center justify-between border-b border-[#edf0f7] px-5 py-4">
        <div className="flex items-center gap-3 text-sm text-[#56627f]">
          <button type="button" onClick={onPrevious} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#f4f6fb]">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span>{currentIndex + 1} de {formatNumber(total)}</span>
          <button type="button" onClick={onNext} className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#f4f6fb]">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-[#edf0f7] text-[#667391] hover:bg-[#f4f6fb]">
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5">
        <div className="mb-4">
          {review.managed ? <ReviewAssignmentStatus article={article} /> : (
          <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", badge.className)}>
            {badge.label}
          </span>
          )}
        </div>
        <h2 className="text-xl font-semibold leading-8 text-[#111936]">{article.title}</h2>
        <p className="mt-3 text-sm leading-6 text-[#56627f]">{article.authors}</p>
        <p className="mt-1 text-sm text-[#56627f]">
          {article.year} · {article.journal}{article.doi ? ` · DOI: ${article.doi}` : ""}
        </p>

        <div className="mt-5 border-b border-[#edf0f7] pb-3">
          <span className="text-sm font-semibold text-[#6259ff]">
            {isIncludedStage ? "Dados do estudo" : activeStage === "eligibility" ? "Texto completo" : "Resumo"}
          </span>
        </div>

        {isIncludedStage ? (
          <div className="mt-5 space-y-5">
            <div className="rounded-lg border border-[#edf0f7] bg-[#fbfcff] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#111936]">Extração de dados</h3>
                  <p className="mt-2 text-sm leading-6 text-[#56627f]">
                    Abra o workspace completo do artigo para preencher o formulário de extração com o PDF ao lado.
                  </p>
                </div>
                <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-semibold text-[#6259ff]">
                  {completedFields} de {extractionSchema.length} campos
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {extractionSchema.length ? extractionSchema.slice(0, 6).map((field) => {
                  const value = extractionData[field.key];
                  const filled = hasExtractionValue(value);
                  return (
                    <div key={field.key} className="rounded-lg border border-[#edf0f7] bg-white p-3">
                      <p className="line-clamp-1 text-xs font-semibold text-[#56627f]">{field.label}</p>
                      <p className={cn("mt-2 line-clamp-2 text-sm", filled ? "text-[#111936]" : "text-[#a4adc2]")}>
                        {filled ? String(Array.isArray(value) ? value.join(", ") : value) : "Não preenchido"}
                      </p>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-[#667391]">Nenhum campo de extração configurado no planejamento.</p>
                )}
              </div>
              <Button
                className="mt-5 h-10 gap-2 rounded-lg bg-[#6259ff] text-white hover:bg-[#5148ee]"
                onClick={() => onOpenArticle(article.id, "extracao")}
              >
                <DatabaseIcon className="h-4 w-4" />
                Abrir workspace de extração
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {activeStage === "eligibility" ? (
              <div className="rounded-lg border border-[#edf0f7] bg-[#fbfcff] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#111936]">{article.hasPdf ? "PDF disponível" : "Texto completo pendente"}</span>
                  <Button variant="outline" size="sm" disabled={!article.hasPdf && !review.canWrite} title={!article.hasPdf ? review.writeExplanation : undefined} className="h-8 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={() => article.hasPdf ? onOpenArticle(article.id) : onOpenUploadPdf(article)}>
                    {article.hasPdf ? <ExternalLinkIcon className="h-3.5 w-3.5" /> : <UploadIcon className="h-3.5 w-3.5" />}
                    {article.hasPdf ? "Abrir artigo" : "Enviar PDF"}
                  </Button>
                </div>
                <div className="h-64 overflow-hidden rounded-md border border-[#dfe4ef] bg-white p-5 text-sm leading-6 text-[#56627f]">
                  {article.abstract || "Este artigo ainda não possui resumo cadastrado. Envie o PDF ou complemente os metadados para avaliar o texto completo."}
                </div>
              </div>
            ) : (
              <div>
                <p className="line-clamp-[8] text-sm leading-7 text-[#56627f]">
                  {article.abstract || "Resumo não cadastrado para este artigo."}
                </p>
              </div>
            )}

            {article.aiEvaluation ? (
              <div className="rounded-lg border border-[#c9c3ff] bg-[#fbfaff] p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#6259ff]">
                    <SparklesIcon className="h-4 w-4" />
                    Sugestao da IA
                  </span>
                  {article.aiRelevanceScore != null ? (
                    <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-semibold text-[#6259ff]">
                      {article.aiRelevanceScore}% relevancia
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-6 text-[#56627f]">{article.aiEvaluation}</p>
              </div>
            ) : null}

            {activeStage === "screening" ? (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#111936]">Sua decisão</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <Button disabled={!review.canDecide} title={review.explanation} className="h-12 gap-2 rounded-lg border border-[#27a363] bg-[#eefaf3] text-[#19884f] hover:bg-[#e3f6eb]" onClick={() => onOpenScreening(article, "included")}>
                    <CheckCircle2Icon className="h-5 w-5" />
                    Incluir
                  </Button>
                  <Button disabled={!review.canDecide} title={review.explanation} className="h-12 gap-2 rounded-lg border border-[#ef6262] bg-[#fff0f0] text-[#d94343] hover:bg-[#ffe4e4]" onClick={() => onOpenScreening(article, "excluded")}>
                    <XCircleIcon className="h-5 w-5" />
                    Excluir
                  </Button>
                  <Button variant="outline" className="h-12 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onSkip}>
                    <HelpCircleIcon className="h-5 w-5" />
                    Pular por agora
                  </Button>
                </div>
              </div>
            ) : null}

            {activeStage === "eligibility" ? (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#111936]">Sua decisão</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <Button
                    className="h-12 gap-2 rounded-lg border border-[#27a363] bg-[#eefaf3] text-[#19884f] hover:bg-[#e3f6eb]"
                    disabled={!review.canDecide || (!article.hasPdf && article.fullTextStatus !== "uploaded")}
                    title={review.explanation}
                    onClick={() => onOpenEligibility(article, "included")}
                  >
                    <CheckCircle2Icon className="h-5 w-5" />
                    Incluir
                  </Button>
                  <Button disabled={!review.canDecide} title={review.explanation} className="h-12 gap-2 rounded-lg border border-[#ef6262] bg-[#fff0f0] text-[#d94343] hover:bg-[#ffe4e4]" onClick={() => onOpenEligibility(article, "excluded")}>
                    <XCircleIcon className="h-5 w-5" />
                    Excluir
                  </Button>
                  <Button variant="outline" className="h-12 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onSkip}>
                    <HelpCircleIcon className="h-5 w-5" />
                    Pular por agora
                  </Button>
                </div>
                {!article.hasPdf && article.fullTextStatus !== "uploaded" ? (
                  <p className="mt-3 text-xs text-[#d48700]">Envie o PDF para liberar a decisão de inclusão.</p>
                ) : null}
                {!article.hasPdf ? (
                  <Button disabled={!review.canDecide} title={review.explanation} variant="outline" className="mt-3 h-10 rounded-lg border-[#dfe4ef] bg-white" onClick={() => onOpenEligibility(article, "full_text_unavailable")}>
                    Marcar texto completo indisponível
                  </Button>
                ) : null}
              </div>
            ) : null}


          </div>
        )}
      </div>
    </section>
  );
}


export default ArticleDetailPanel;
