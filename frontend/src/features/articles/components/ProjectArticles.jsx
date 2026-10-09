import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpenIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HelpCircleIcon,
  LoaderIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { articleService } from "@features/articles/services/articleService";
import { useProjectArticles } from "@features/articles/hooks/useProjectArticles";
import { resolveSelectedArticle } from "@features/articles/utils/reviewFlow";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import ImportBibTeXModal from "./ImportBibTeXModal";
import NewArticleModal from "./NewArticleModal";
import UploadPDFModal from "./UploadPDFModal";
import ReviewAssignmentStatus from "./ReviewAssignmentStatus";
import AdaptiveReviewWorkspace from "./review/AdaptiveReviewWorkspace";
import ArticleReadingPane from "./review/ArticleReadingPane";
import EligibilityDecisionTool from "./review/EligibilityDecisionTool";
import IdentificationTool from "./review/IdentificationTool";
import IncludedExtractionTool from "./review/IncludedExtractionTool";
import ReviewQueuePanel, { getArticleBadge, getFilterOptions } from "./review/ReviewQueuePanel";
import ReviewStageNavigator from "./review/ReviewStageNavigator";
import ScreeningDecisionTool from "./review/ScreeningDecisionTool";
import { useReviewDraftGuard } from "./review/useReviewDraftGuard";
import { collaborativeReview } from "../utils/collaborativeReview";

const STAGES = [
  {
    key: "identification",
    number: 1,
    label: "Identificação",
    description: "Registros importados de diferentes bases de dados. Remova duplicatas antes de seguir para a triagem.",
    icon: FileTextIcon,
  },
  {
    key: "screening",
    number: 2,
    label: "Triagem",
    description: "Classifique os estudos com base nos critérios de elegibilidade definidos.",
    icon: ShieldCheckIcon,
  },
  {
    key: "eligibility",
    number: 3,
    label: "Elegibilidade",
    description: "Avalie o texto completo dos estudos quanto a elegibilidade.",
    icon: BookOpenIcon,
  },
  {
    key: "included",
    number: 4,
    label: "Inclusão",
    description: "Estudos que atendem a todos os critérios e serão incluídos na revisão.",
    icon: CheckCircle2Icon,
  },
];

const SOURCE_TONES = {
  Scopus: "bg-[#ff8a00] text-white",
  "Web of Science": "bg-[#7b3fff] text-white",
  "IEEE Xplore": "bg-[#1976b9] text-white",
  ScienceDirect: "bg-[#ff7a00] text-white",
  PubMed: "bg-[#18a66a] text-white",
};

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function getStageCount(summary, stageKey) {
  if (stageKey === "identification") return summary?.identification?.total || 0;
  if (stageKey === "screening") return summary?.screening?.total || 0;
  if (stageKey === "eligibility") return summary?.eligibility?.total || 0;
  if (stageKey === "included") return summary?.included || 0;
  return 0;
}

function getSourceInitial(sourceName) {
  if (!sourceName) {
    return "DB";
  }

  if (sourceName === "Web of Science") return "W";
  if (sourceName === "IEEE Xplore") return "IEEE";
  if (sourceName === "ScienceDirect") return "SD";
  return sourceName.slice(0, 2).toUpperCase();
}

export function DuplicateReviewPanel({
  candidates,
  isApplying = false,
  onApply,
  onSelectCanonical,
  selectedDuplicateMap,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!candidates.length) {
    return null;
  }

  const recordCount = candidates.reduce(
    (total, candidate) => total + (candidate.articles?.length || 0),
    0
  );

  return (
    <>
    <section className="rounded-lg border border-[#f0d6a8] bg-[#fffdf8] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[#111936]">Revisar duplicatas</h2>
            <span className="rounded-full bg-[#fff0d5] px-2.5 py-1 text-xs font-semibold text-[#b96a00]">
              {formatNumber(candidates.length)} grupo(s) · {formatNumber(recordCount)} registro(s)
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#56627f]">
            Escolha o registro que será mantido em cada grupo. Os demais serão removidos apenas após sua confirmação.
          </p>
        </div>
        <Button
          className="h-9 shrink-0 gap-2 rounded-lg bg-[#6259ff] text-xs text-white hover:bg-[#5148ee]"
          disabled={isApplying || !candidates.every((candidate) => selectedDuplicateMap[candidate.groupKey])}
          onClick={() => setConfirmOpen(true)}
        >
          {isApplying ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
          Confirmar revisão de duplicatas
        </Button>
      </div>

      <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
        {candidates.map((candidate, groupIndex) => (
          <fieldset key={candidate.groupKey} className="rounded-lg border border-[#eadfca] bg-white p-4">
            <legend className="px-1 text-xs font-semibold text-[#7b5a24]">
              Grupo {groupIndex + 1} · {candidate.reasonText}
            </legend>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {(candidate.articles || []).map((candidateArticle) => {
                const checked = selectedDuplicateMap[candidate.groupKey] === candidateArticle.id;
                return (
                  <label
                    key={candidateArticle.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      checked ? "border-[#6259ff] bg-[#f8f7ff]" : "border-[#e5e9f2] hover:border-[#cbd2e1]"
                    )}
                  >
                    <input
                      type="radio"
                      name={`canonical-${candidate.groupKey}`}
                      aria-label={`Manter ${candidateArticle.title}`}
                      checked={checked}
                      onChange={() => onSelectCanonical(candidate.groupKey, candidateArticle.id)}
                      className="mt-1 h-4 w-4 accent-[#6259ff]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-5 text-[#111936]">{candidateArticle.title}</span>
                      <span className="mt-1 block text-xs text-[#667391]">
                        {candidateArticle.authors} · {candidateArticle.year} · {candidateArticle.sourceName}
                      </span>
                      {candidateArticle.doi ? (
                        <span className="mt-1 block text-xs text-[#8b6a35]">DOI: {candidateArticle.doi}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
    <ConfirmationDialog
      open={confirmOpen}
      title="Aplicar revisão de duplicatas?"
      description={`Os registros não canônicos de ${formatNumber(candidates.length)} grupo(s) serão removidos da fila ativa.`}
      confirmLabel="Aplicar revisão"
      isPending={isApplying}
      onConfirm={() => {
        setConfirmOpen(false);
        onApply();
      }}
      onOpenChange={setConfirmOpen}
    />
    </>
  );
}

function filterArticles({ articles, duplicateIds, filter, searchTerm, stageKey }) {
  const normalizedSearch = normalizeText(searchTerm);

  return articles.filter((article) => {
    const searchable = normalizeText(`${article.title} ${article.authors} ${article.journal} ${article.sourceName}`);
    if (normalizedSearch && !searchable.includes(normalizedSearch)) {
      return false;
    }

    const badge = getArticleBadge(article, stageKey, duplicateIds).label;
    if (filter === "duplicates") return duplicateIds.has(article.id) || Boolean(article.duplicateGroupKey);
    if (filter === "unique") return !duplicateIds.has(article.id) && !article.duplicateGroupKey;
    if (filter === "exclude") return badge === "Excluido";
    if (filter === "pending") return badge === "Pendente";
    if (filter === "pending_extraction") return !Object.keys(article.extractionData || {}).length;
    return true;
  });
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

  const badge = getArticleBadge(article, activeStage, new Set());
  const review = collaborativeReview(article);
  const isIncludedStage = activeStage === "included";
  const extractionSchema = project?.dataExtractionSchema || [];
  const extractionData = article.extractionData || {};
  const completedFields = extractionSchema.filter((field) => {
    const value = extractionData[field.key];
    return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length);
  }).length;

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
                  const filled = value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length);
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

function SummaryDonut({ rows, total }) {
  const primary = rows[0]?.value || 0;
  const percent = total ? Math.min(100, Math.round((primary / total) * 1000) / 10) : 0;

  return (
    <div className="flex items-center gap-5">
      <div
        className="grid h-24 w-24 place-items-center rounded-full"
        style={{ background: `conic-gradient(#14a365 ${percent}%, #ff920f ${percent}% 100%)` }}
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-xl font-semibold text-[#111936]">
          {formatNumber(total)}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-[#56627f]">
              <span className={cn("h-2 w-2 rounded-full", row.dot)} />
              {row.label}
            </span>
            <span className="font-semibold text-[#111936]">{formatNumber(row.value)} ({total ? Math.round((row.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StageSidebar({
  activeStage,
  articleTotal,
  articles,
  canManageArticles = true,
  duplicateCandidates,
  onBatchEvaluate,
  onExportStage,
  onRunDedup,
  onViewFlow,
  summary,
}) {
  const duplicateIds = new Set(
    duplicateCandidates.flatMap((candidate) => candidate.candidateIds || [])
  );
  const identificationCount = articleTotal ?? articles.length;
  const count = activeStage === "identification"
    ? identificationCount
    : getStageCount(summary, activeStage);
  const extractionPending = summary?.pendingExtraction ?? 0;

  const rows = {
    identification: [
      { label: "Únicos na fila", value: Math.max(identificationCount - duplicateIds.size, 0), dot: "bg-[#14a365]" },
      { label: "Possíveis duplicatas", value: duplicateIds.size, dot: "bg-[#ff920f]" },
    ],
    screening: [
      { label: "Encaminhados", value: Math.max((summary?.screening?.total || 0) - (summary?.screening?.excluded || 0) - (summary?.screening?.active || 0), 0), dot: "bg-[#14a365]" },
      { label: "Excluidos", value: summary?.screening?.excluded || 0, dot: "bg-[#f04444]" },
      { label: "Pendentes", value: summary?.screening?.active || 0, dot: "bg-[#ff920f]" },
    ],
    eligibility: [
      { label: "Excluidos", value: summary?.eligibility?.excluded || 0, dot: "bg-[#f04444]" },
      { label: "Incluidos", value: summary?.included || 0, dot: "bg-[#14a365]" },
      { label: "Pendentes", value: summary?.eligibility?.active || 0, dot: "bg-[#a4adc2]" },
    ],
    included: [
      { label: "Incluidos", value: summary?.included || 0, dot: "bg-[#14a365]" },
      { label: "Aguarda extração", value: extractionPending, dot: "bg-[#6259ff]" },
    ],
  }[activeStage];

  return (
    <aside className="space-y-4 xl:col-span-2 2xl:col-span-1">
      <section className="rounded-lg border border-[#edf0f7] bg-white p-5">
        <h3 className="text-sm font-semibold text-[#111936]">Resumo da etapa</h3>
        <div className="mt-5">
          <SummaryDonut rows={rows} total={count} />
        </div>
      </section>

      {activeStage === "identification" ? (
        <section className="rounded-lg border border-[#edf0f7] bg-white p-5">
          <h3 className="text-sm font-semibold text-[#111936]">Fontes de dados</h3>
          <div className="mt-4 space-y-3">
            {(summary?.bySource || []).slice(0, 4).map((item) => (
              <div key={`${item.sourceCategory}-${item.sourceName}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-[#56627f]">
                  <span className={cn("grid h-6 min-w-6 place-items-center rounded px-1 text-[9px] font-bold", SOURCE_TONES[item.sourceName] || "bg-[#eef3ff] text-[#4d68ff]")}>
                    {getSourceInitial(item.sourceName)}
                  </span>
                  {item.sourceName}
                </span>
                <span className="font-semibold text-[#111936]">{formatNumber(item.total)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-[#edf0f7] bg-white p-5">
        <h3 className="text-sm font-semibold text-[#111936]">Ações rápidas</h3>
        <div className="mt-4 space-y-2">
          {activeStage === "identification" ? (
            <>
              {canManageArticles ? <Button variant="outline" className="h-10 w-full justify-between rounded-lg border-[#dfe4ef] bg-white" onClick={onRunDedup}>
                Detectar duplicatas
                <span className="rounded-full bg-[#6259ff] px-2 py-0.5 text-xs text-white">{duplicateCandidates.length}</span>
              </Button> : null}
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onExportStage}>
                Exportar etapa
              </Button>
            </>
          ) : null}
          {activeStage === "screening" ? (
            <>
              {canManageArticles ? <Button variant="outline" className="h-10 w-full justify-start gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onBatchEvaluate}>
                <SparklesIcon className="h-4 w-4" />
                Triagem IA
              </Button> : null}
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onExportStage}>
                Exportar etapa
              </Button>
            </>
          ) : null}
          {activeStage === "eligibility" ? (
            <>
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onExportStage}>
                Exportar lista desta etapa
              </Button>
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onViewFlow}>
                Ver fluxograma PRISMA
              </Button>
            </>
          ) : null}
          {activeStage === "included" ? (
            <>
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onExportStage}>
                Exportar lista de incluídos
              </Button>
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onViewFlow}>
                Ver fluxograma PRISMA
              </Button>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-[#edf0f7] bg-[#fbfaff] p-5">
        <h3 className="text-sm font-semibold text-[#6259ff]">Dica</h3>
        <p className="mt-3 text-sm leading-6 text-[#56627f]">
          {activeStage === "identification"
            ? "Revise e remova duplicatas para garantir que cada estudo seja avaliado apenas uma vez."
            : activeStage === "included"
              ? "Preencha a extração estruturada dos estudos incluídos antes da síntese final."
              : "Registre decisões com justificativas para manter a trilha de auditoria da revisão."}
        </p>
      </section>
    </aside>
  );
}

function ProjectArticles({ project, onNavigate, onGraphNeedsRefresh, onViewFlow, collaboration }) {
  const canManageArticles = (collaboration?.capabilities ?? project?.capabilities ?? []).includes("edit_project");
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNewArticleModal, setShowNewArticleModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUploadPdfModal, setShowUploadPdfModal] = useState(false);
  const [pdfTarget, setPdfTarget] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [isDetailClosed, setIsDetailClosed] = useState(false);
  const [isReviewDraftDirty, setIsReviewDraftDirty] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const draftGuard = useReviewDraftGuard({
    isDirty: isReviewDraftDirty,
    confirmDiscard: () => setIsReviewDraftDirty(false),
  });

  const {
    activeFlowTab,
    applyDuplicateReview,
    articlePage,
    articlePageSize,
    articleTotal,
    assignedToMe,
    articles,
    changeArticlePage,
    duplicateCandidates,
    identificationArticles,
    isBatchEvaluating,
    isLoadingArticles,
    isLoadingDuplicates,
    isPromotingUnique,
    isSavingDecision,
    promoteAllUniqueToScreening,
    promoteSelectedToScreening,
    refreshAll,
    runBatchEvaluate,
    runDedupAnalysis,
    searchTerm,
    selectedIdentificationIds,
    selectedDuplicateMap,
    setActiveFlowTab,
    setAssignedToMe,
    setSearchTerm,
    setSelectedDuplicateMap,
    submitEligibilityDecision,
    submitScreeningDecision,
    summary,
    toggleAllIdentificationSelection,
    toggleIdentificationSelection,
  } = useProjectArticles(project, onGraphNeedsRefresh, collaboration);

  const activeStage = STAGES.some((stage) => stage.key === activeFlowTab)
    ? activeFlowTab
    : "identification";

  useEffect(() => {
    if (searchParams.get("action") !== "import") {
      return;
    }

    setShowImportModal(canManageArticles);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("action");
      return next;
    });
  }, [canManageArticles, searchParams, setSearchParams]);

  useEffect(() => {
    setActiveFilter("all");
    setSelectedArticleId(null);
    setIsDetailClosed(false);
  }, [activeStage]);

  const duplicateIds = useMemo(() => {
    const ids = new Set();
    duplicateCandidates.forEach((group) => {
      (group.candidateIds || []).forEach((id) => ids.add(id));
    });
    return ids;
  }, [duplicateCandidates]);

  const stageArticles = activeStage === "identification" ? identificationArticles : articles;

  const filterOptions = useMemo(
    () => getFilterOptions(activeStage, duplicateIds, stageArticles, articleTotal).map((option) => {
      if (assignedToMe && option.key === "all") return { ...option, count: undefined };
      if (assignedToMe && option.key === "assigned") return { ...option, count: articleTotal };
      return option;
    }),
    [activeStage, articleTotal, assignedToMe, duplicateIds, stageArticles]
  );

  const filteredArticles = useMemo(
    () => filterArticles({
      articles: stageArticles,
      duplicateIds,
      filter: activeFilter,
      searchTerm,
      stageKey: activeStage,
    }),
    [activeFilter, activeStage, duplicateIds, searchTerm, stageArticles]
  );

  const selectedArticle = useMemo(
    () => isDetailClosed ? null : resolveSelectedArticle(filteredArticles, selectedArticleId),
    [filteredArticles, isDetailClosed, selectedArticleId]
  );

  useEffect(() => {
    if (!isDetailClosed) {
      setSelectedArticleId((currentId) => resolveSelectedArticle(filteredArticles, currentId)?.id ?? null);
    }
  }, [filteredArticles, isDetailClosed]);

  const selectedIndex = selectedArticle
    ? filteredArticles.findIndex((article) => article.id === selectedArticle.id)
    : -1;

  function openUploadPdf(article) {
    setPdfTarget(article);
    setShowUploadPdfModal(true);
  }

  function selectAdjacent(direction) {
    if (!filteredArticles.length) {
      return;
    }
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = (currentIndex + direction + filteredArticles.length) % filteredArticles.length;
    setIsDetailClosed(false);
    setSelectedArticleId(filteredArticles[nextIndex].id);
  }

  async function handleExportStage() {
    try {
      await articleService.exportSelectionReport(project.id, "csv");
      toast.success("Dados exportados.");
    } catch (error) {
      toast.error(`Erro ao exportar: ${error.message}`);
    }
  }

  async function handleDedupAndRefresh() {
    await runDedupAnalysis();
  }

  function handleSkip() {
    if (!selectedArticle) {
      return;
    }
    selectAdjacent(1);
    toast.info("Artigo mantido pendente. Próximo item aberto.");
  }

  async function saveScreeningDecision(articleId, payload) {
    setReviewStatus("Salvando decisão de triagem.");
    try {
      const saved = await submitScreeningDecision(articleId, payload);
      if (saved) setReviewStatus("Decisão de triagem salva. Próximo artigo aberto.");
      return saved;
    } catch (error) {
      setReviewStatus("Não foi possível salvar a decisão de triagem.");
      throw error;
    }
  }

  async function saveEligibilityDecision(articleId, payload) {
    setReviewStatus("Salvando decisão de elegibilidade.");
    try {
      const saved = await submitEligibilityDecision(articleId, payload);
      if (saved) setReviewStatus("Decisão de elegibilidade salva. Próximo artigo aberto.");
      return saved;
    } catch (error) {
      setReviewStatus("Não foi possível salvar a decisão de elegibilidade.");
      throw error;
    }
  }

  return (
    <div className="space-y-5">
      <p className="sr-only" aria-live="polite" aria-atomic="true">{reviewStatus}</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" className="h-10 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={handleExportStage}>
          <DownloadIcon className="h-4 w-4" />
          Exportar dados
        </Button>
        {canManageArticles ? <><Button className="h-10 gap-2 rounded-lg bg-[#6259ff] px-4 text-white hover:bg-[#5148ee]" onClick={() => setShowImportModal(true)}>
          <PlusIcon className="h-4 w-4" />
          Importar artigos
        </Button>
        <Button className="h-10 gap-2 rounded-lg bg-[#6259ff] px-4 text-white hover:bg-[#5148ee]" onClick={() => setShowNewArticleModal(true)}>
          <PlusIcon className="h-4 w-4" />
          Adicionar artigo  
        </Button></> : null}
      </div>

      <ReviewStageNavigator
        activeStage={activeStage}
        onStageChange={(stage) => draftGuard.guard(() => setActiveFlowTab(stage))}
        summary={summary}
      />

      {activeStage === "identification" && canManageArticles ? (
        <DuplicateReviewPanel
          candidates={duplicateCandidates}
          isApplying={isLoadingDuplicates}
          onApply={applyDuplicateReview}
          onSelectCanonical={(groupKey, articleId) => {
            setSelectedDuplicateMap((current) => ({ ...current, [groupKey]: articleId }));
          }}
          selectedDuplicateMap={selectedDuplicateMap}
        />
      ) : null}

      <AdaptiveReviewWorkspace
        queue={<ReviewQueuePanel
          activeFilter={activeFilter}
          activeStage={activeStage}
          articlePage={articlePage}
          articlePageSize={articlePageSize}
          articleTotal={articleTotal}
          articles={filteredArticles}
          canManageArticles={canManageArticles}
          duplicateIds={duplicateIds}
          filterOptions={filterOptions}
          isLoading={isLoadingArticles}
          isPromotingUnique={isPromotingUnique}
          onArticleSelect={(article) => {
            draftGuard.guard(() => {
              setIsDetailClosed(false);
              setSelectedArticleId(article.id);
            });
          }}
          onFilterChange={(filter) => {
            draftGuard.guard(() => {
              setActiveFilter(filter);
              setAssignedToMe(filter === "assigned");
            });
          }}
          onOpenArticle={(articleId) => {
            draftGuard.guard(() => {
              const params = new URLSearchParams({ flow: activeStage });
              if (activeStage === "included") {
                params.set("workspace", "extracao");
              }
              onNavigate(`/projetos/${project.id}/artigos/${articleId}?${params.toString()}`);
            });
          }}
          onPageChange={(page) => draftGuard.guard(() => changeArticlePage(page))}
          onPromoteAllUnique={promoteAllUniqueToScreening}
          onPromoteSelected={promoteSelectedToScreening}
          onToggleAllIdentification={toggleAllIdentificationSelection}
          onToggleIdentification={toggleIdentificationSelection}
          searchTerm={searchTerm}
          selectedArticle={selectedArticle}
          selectedIdentificationIds={selectedIdentificationIds}
          setSearchTerm={setSearchTerm}
          summary={summary}
        />}
        content={<ArticleReadingPane
          activeStage={activeStage}
          article={selectedArticle}
          onNext={() => draftGuard.guard(() => selectAdjacent(1))}
          onOpenArticle={(articleId) => {
            draftGuard.guard(() => {
              const params = new URLSearchParams({ flow: activeStage });
              if (activeStage === "included") params.set("workspace", "extracao");
              onNavigate(`/projetos/${project.id}/artigos/${articleId}?${params.toString()}`);
            });
          }}
          onPrevious={() => draftGuard.guard(() => selectAdjacent(-1))}
          onUploadPdf={openUploadPdf}
          position={{ current: selectedIndex >= 0 ? selectedIndex + 1 : 0, total: filteredArticles.length }}
          project={project}
        />}
        tool={activeStage === "identification" ? <IdentificationTool
          articleTotal={articleTotal}
          canManageArticles={canManageArticles}
          duplicateCandidates={duplicateCandidates}
          onExport={handleExportStage}
          onPromoteAllUnique={promoteAllUniqueToScreening}
          onRunDedup={handleDedupAndRefresh}
          summary={summary}
        /> : activeStage === "screening" ? <ScreeningDecisionTool
          article={selectedArticle}
          isSaving={isSavingDecision}
          onAdvance={() => { setIsReviewDraftDirty(false); selectAdjacent(1); }}
          onDirtyChange={setIsReviewDraftDirty}
          onSkip={() => draftGuard.guard(handleSkip)}
          onSubmit={saveScreeningDecision}
        /> : activeStage === "eligibility" ? <EligibilityDecisionTool
          article={selectedArticle}
          checklist={project?.eligibilityChecklist || []}
          isSaving={isSavingDecision}
          onAdvance={() => { setIsReviewDraftDirty(false); selectAdjacent(1); }}
          onDirtyChange={setIsReviewDraftDirty}
          onSubmit={saveEligibilityDecision}
          researchQuestions={project?.researchQuestions || []}
        /> : activeStage === "included" ? <IncludedExtractionTool
          article={selectedArticle}
          onExport={handleExportStage}
          onOpenExtraction={(articleId) => {
            const params = new URLSearchParams({ flow: activeStage, workspace: "extracao" });
            onNavigate(`/projetos/${project.id}/artigos/${articleId}?${params.toString()}`);
          }}
          onViewFlow={onViewFlow}
          project={project}
          summary={summary}
        /> : <StageSidebar
          activeStage={activeStage}
          articleTotal={articleTotal}
          articles={stageArticles}
          canManageArticles={canManageArticles}
          duplicateCandidates={duplicateCandidates}
          onBatchEvaluate={runBatchEvaluate}
          onExportStage={handleExportStage}
          onRunDedup={handleDedupAndRefresh}
          onViewFlow={onViewFlow}
          summary={summary}
        />}
      />

      {isBatchEvaluating || isLoadingDuplicates ? (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 rounded-lg border border-[#edf0f7] bg-white px-4 py-3 text-sm text-[#667391] shadow-lg">
          <LoaderIcon className="h-4 w-4 animate-spin" />
          Processando etapa...
        </div>
      ) : null}

      <NewArticleModal
        isOpen={canManageArticles && showNewArticleModal}
        onClose={() => setShowNewArticleModal(false)}
        onSuccess={() => refreshAll()}
        projectId={project.id}
      />

      <ImportBibTeXModal
        isOpen={canManageArticles && showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => refreshAll()}
        projectId={project.id}
      />

      <UploadPDFModal
        isOpen={showUploadPdfModal}
        onClose={() => {
          setShowUploadPdfModal(false);
          setPdfTarget(null);
        }}
        onSuccess={() => {
          setShowUploadPdfModal(false);
          setPdfTarget(null);
          refreshAll();
        }}
        project={project}
        article={pdfTarget}
      />

      <ConfirmationDialog
        open={draftGuard.isConfirmOpen}
        title="Descartar alterações da decisão?"
        description="Você tem uma decisão ainda não salva. Ao continuar, essas alterações serão perdidas."
        confirmLabel="Descartar e continuar"
        tone="destructive"
        onConfirm={draftGuard.confirm}
        onOpenChange={(open) => { if (!open) draftGuard.cancel(); }}
      />

    </div>
  );
}

export default ProjectArticles;
