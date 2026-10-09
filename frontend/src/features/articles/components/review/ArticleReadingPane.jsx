import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function ArticleReadingPane({
  activeStage,
  article,
  project,
  position = { current: 0, total: 0 },
  onPrevious,
  onNext,
  onUploadPdf,
  onOpenArticle,
}) {
  if (!article) {
    return (
      <div className="grid min-h-[620px] place-items-center p-8 text-center">
        <div>
          <FileTextIcon className="mx-auto h-10 w-10 text-[#a4adc2]" />
          <p className="mt-3 text-sm font-semibold text-[#111936]">Selecione um artigo</p>
          <p className="mt-1 text-sm text-[#667391]">O conteúdo do registro aparece aqui.</p>
        </div>
      </div>
    );
  }

  const isEligibility = activeStage === "eligibility";
  const isIncluded = activeStage === "included";
  const label = isIncluded ? "Dados do estudo" : isEligibility ? "Texto completo" : "Resumo";
  const extractionSchema = project?.dataExtractionSchema || [];
  const extractionData = article.extractionData || {};

  return (
    <article className="min-h-[620px] bg-white">
      <header className="flex items-center justify-between border-b border-[#edf0f7] px-5 py-3">
        <button type="button" onClick={onPrevious} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[#667391] hover:bg-[#f4f6fb]">
          <ChevronLeftIcon className="h-4 w-4" />
          Anterior
        </button>
        <span className="text-xs font-medium text-[#667391]">
          {formatNumber(position.current)} de {formatNumber(position.total)}
        </span>
        <button type="button" onClick={onNext} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[#667391] hover:bg-[#f4f6fb]">
          Próximo
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </header>

      <div className="mx-auto max-w-[760px] px-6 py-7 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a94aa]">
          {article.year} · {article.journal}
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-8 tracking-[-0.025em] text-[#111936]">{article.title}</h2>
        <p className="mt-3 text-sm leading-6 text-[#56627f]">{article.authors}</p>
        {article.doi ? <p className="mt-1 text-xs text-[#7a849d]">DOI: {article.doi}</p> : null}

        <div className="mt-7 flex items-center justify-between border-b border-[#edf0f7] pb-3">
          <h3 className="text-sm font-semibold text-[#6259ff]">{label}</h3>
          {isEligibility ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-lg border-[#dfe4ef] bg-white"
              onClick={() => article.hasPdf ? onOpenArticle(article.id) : onUploadPdf(article)}
            >
              {article.hasPdf ? <ExternalLinkIcon className="h-3.5 w-3.5" /> : <UploadIcon className="h-3.5 w-3.5" />}
              {article.hasPdf ? "Abrir artigo" : "Enviar PDF"}
            </Button>
          ) : null}
        </div>

        {isIncluded ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {extractionSchema.length ? extractionSchema.slice(0, 8).map((field) => {
              const value = extractionData[field.key];
              const filled = value !== undefined && value !== null && value !== "";
              return (
                <div key={field.key} className="border-b border-[#edf0f7] py-3">
                  <p className="text-xs font-semibold text-[#667391]">{field.label}</p>
                  <p className={filled ? "mt-1 text-sm text-[#111936]" : "mt-1 text-sm text-[#a4adc2]"}>
                    {filled ? String(Array.isArray(value) ? value.join(", ") : value) : "Não preenchido"}
                  </p>
                </div>
              );
            }) : <p className="text-sm text-[#667391]">Nenhum campo de extração configurado.</p>}
          </div>
        ) : isEligibility ? (
          <div className="mt-5 min-h-72 rounded-lg border border-[#e2e6ef] bg-[#fbfcff] p-5">
            <p className="max-w-[68ch] whitespace-pre-wrap text-sm leading-7 text-[#56627f]">
              {article.abstract || "O texto completo ainda não está disponível. Envie o PDF para continuar a avaliação."}
            </p>
          </div>
        ) : (
          <p className="mt-5 max-w-[68ch] whitespace-pre-wrap text-sm leading-7 text-[#56627f]">
            {article.abstract || "Resumo não cadastrado para este artigo."}
          </p>
        )}
      </div>
    </article>
  );
}

export default ArticleReadingPane;
