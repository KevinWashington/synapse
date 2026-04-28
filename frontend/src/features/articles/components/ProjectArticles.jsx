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
  FilterIcon,
  Grid2X2Icon,
  HelpCircleIcon,
  ListIcon,
  LoaderIcon,
  MoreVerticalIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { articleService } from "@features/articles/services/articleService";
import { useProjectArticles } from "@features/articles/hooks/useProjectArticles";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import EligibilityDecisionDialog from "./EligibilityDecisionDialog";
import ImportBibTeXModal from "./ImportBibTeXModal";
import NewArticleModal from "./NewArticleModal";
import ScreeningDecisionDialog from "./ScreeningDecisionDialog";
import UploadPDFModal from "./UploadPDFModal";

const STAGES = [
  {
    key: "identification",
    number: 1,
    label: "Identificacao",
    description: "Registros importados de diferentes bases de dados. Remova duplicatas antes de seguir para a triagem.",
    icon: FileTextIcon,
  },
  {
    key: "screening",
    number: 2,
    label: "Triagem (titulo e resumo)",
    description: "Classifique os estudos com base nos criterios de elegibilidade definidos.",
    icon: ShieldCheckIcon,
  },
  {
    key: "eligibility",
    number: 3,
    label: "Elegibilidade (texto completo)",
    description: "Avalie o texto completo dos estudos quanto a elegibilidade.",
    icon: BookOpenIcon,
  },
  {
    key: "included",
    number: 4,
    label: "Inclusao",
    description: "Estudos que atendem a todos os criterios e serao incluidos na revisao.",
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

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("pt-BR");
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

function getStageConfig(stageKey) {
  return STAGES.find((stage) => stage.key === stageKey) || STAGES[0];
}

function getArticleBadge(article, stageKey, duplicateIds) {
  if (!article) {
    return { label: "-", className: "bg-[#edf1f7] text-[#667391]", dot: "bg-[#a4adc2]" };
  }

  if (stageKey === "identification") {
    const duplicate = duplicateIds.has(article.id) || article.duplicateGroupKey || article.reviewOutcome === "duplicate_removed";
    return duplicate
      ? { label: "Duplicata", className: "bg-[#fff3e0] text-[#d57a00]", dot: "bg-[#ff9f1c]" }
      : { label: "Unico", className: "bg-[#e8f8ef] text-[#258c55]", dot: "bg-[#22b66f]" };
  }

  if (stageKey === "screening") {
    if (article.aiSuggestedStatus === "excluido" || article.screeningDecision === "excluded") {
      return { label: "Excluir", className: "bg-[#ffecef] text-[#d94343]", dot: "bg-[#f04444]" };
    }
    if (article.aiSuggestedStatus === "incluido" || article.screeningDecision === "included" || article.currentPhase === "eligibility") {
      return { label: "Incluir", className: "bg-[#e8f8ef] text-[#258c55]", dot: "bg-[#22b66f]" };
    }
    return { label: "Talvez", className: "bg-[#fff6e5] text-[#d48700]", dot: "bg-[#ff9f1c]" };
  }

  if (stageKey === "eligibility") {
    if (article.reviewOutcome === "excluded_eligibility" || article.reviewOutcome === "full_text_unavailable" || article.eligibilityDecision === "excluded") {
      return { label: "Excluir", className: "bg-[#ffecef] text-[#d94343]", dot: "bg-[#f04444]" };
    }
    if (article.reviewOutcome === "included") {
      return { label: "Incluir", className: "bg-[#e8f8ef] text-[#258c55]", dot: "bg-[#22b66f]" };
    }
    return { label: "Aguardando", className: "bg-[#edf1f7] text-[#667391]", dot: "bg-[#a4adc2]" };
  }

  return { label: "Incluido", className: "bg-[#e8f8ef] text-[#258c55]", dot: "bg-[#22b66f]" };
}

function getFilterOptions(stageKey, summary, duplicateIds, articles) {
  if (stageKey === "identification") {
    const duplicates = articles.filter((article) => duplicateIds.has(article.id) || article.duplicateGroupKey).length;
    return [
      { key: "all", label: "Todos", count: getStageCount(summary, stageKey) },
      { key: "duplicates", label: "Duplicatas", count: duplicates },
      { key: "unique", label: "Unicos", count: Math.max((articles.length || 0) - duplicates, 0) },
    ];
  }

  if (stageKey === "screening") {
    return [
      { key: "all", label: "Todos", count: articles.length },
      { key: "include", label: "Incluir", count: articles.filter((article) => getArticleBadge(article, stageKey, duplicateIds).label === "Incluir").length },
      { key: "exclude", label: "Excluir", count: articles.filter((article) => getArticleBadge(article, stageKey, duplicateIds).label === "Excluir").length },
      { key: "maybe", label: "Talvez", count: articles.filter((article) => getArticleBadge(article, stageKey, duplicateIds).label === "Talvez").length },
    ];
  }

  if (stageKey === "eligibility") {
    return [
      { key: "all", label: "Todos", count: articles.length },
      { key: "include", label: "Incluir", count: articles.filter((article) => getArticleBadge(article, stageKey, duplicateIds).label === "Incluir").length },
      { key: "exclude", label: "Excluir", count: articles.filter((article) => getArticleBadge(article, stageKey, duplicateIds).label === "Excluir").length },
      { key: "pending", label: "Aguardando", count: articles.filter((article) => getArticleBadge(article, stageKey, duplicateIds).label === "Aguardando").length },
    ];
  }

  return [
    { key: "all", label: "Todos", count: articles.length },
    {
      key: "pending_extraction",
      label: "Aguarda extracao",
      count: articles.filter((article) => !Object.keys(article.extractionData || {}).length).length,
    },
  ];
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
    if (filter === "include") return badge === "Incluir";
    if (filter === "exclude") return badge === "Excluir";
    if (filter === "maybe") return badge === "Talvez";
    if (filter === "pending") return badge === "Aguardando";
    if (filter === "pending_extraction") return !Object.keys(article.extractionData || {}).length;
    return true;
  });
}

function StageStepper({ activeStage, onStageChange, summary }) {
  const activeIndex = STAGES.findIndex((stage) => stage.key === activeStage);

  return (
    <section className="rounded-lg border border-[#edf0f7] bg-white p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#111936]">Etapas da revisao</h2>
          <p className="mt-1 text-sm text-[#667391]">Acompanhe e gerencie cada etapa do fluxo PRISMA.</p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        {STAGES.map((stage, index) => {
          const isActive = stage.key === activeStage;
          const isDone = index < activeIndex;

          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => onStageChange(stage.key)}
              className={cn(
                "relative flex items-center gap-4 rounded-lg border bg-white p-4 text-left transition-colors",
                isActive ? "border-[#6259ff] bg-[#fbfaff]" : "border-[#edf0f7] hover:border-[#cfd6e7]"
              )}
            >
              <span className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full border text-base font-semibold",
                isActive ? "border-[#6259ff] bg-[#6259ff] text-white" : "border-[#dfe4ef] text-[#111936]"
              )}>
                {stage.number}
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate text-sm font-semibold", isActive ? "text-[#6259ff]" : "text-[#111936]")}>
                  {stage.label}
                </span>
                <span className="mt-1 block text-xs text-[#56627f]">{formatNumber(getStageCount(summary, stage.key))} artigos</span>
              </span>
              {isDone ? (
                <span className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-[#dff7ea] text-[#21945a]">
                  <CheckIcon className="h-4 w-4" />
                </span>
              ) : null}
              {index < STAGES.length - 1 ? (
                <span className="absolute -right-3 top-1/2 hidden h-px w-3 bg-[#dfe4ef] xl:block" />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SourceBadge({ article }) {
  const tone = SOURCE_TONES[article.sourceName] || "bg-[#eef3ff] text-[#4d68ff]";

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 text-center">
      <span className={cn("grid h-8 min-w-8 place-items-center rounded-md px-1 text-[10px] font-bold", tone)}>
        {getSourceInitial(article.sourceName)}
      </span>
      <span className="line-clamp-1 max-w-12 text-[10px] text-[#667391]">{article.sourceName}</span>
    </div>
  );
}

function StageListPanel({
  activeFilter,
  activeStage,
  articles,
  duplicateIds,
  filterOptions,
  isLoading,
  onArticleSelect,
  onFilterChange,
  onOpenArticle,
  onPromoteSelected,
  onToggleIdentification,
  searchTerm,
  selectedArticle,
  selectedIdentificationIds,
  setSearchTerm,
  summary,
}) {
  const stage = getStageConfig(activeStage);

  return (
    <section className="min-w-0 rounded-lg border border-[#edf0f7] bg-white">
      <div className="border-b border-[#edf0f7] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#111936]">{stage.label}</h2>
              <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-semibold text-[#6259ff]">
                {formatNumber(getStageCount(summary, activeStage))} artigos
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#56627f]">{stage.description}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-[240px] flex-1">
            <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78839d]" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={activeStage === "identification" ? "Buscar por titulo, autor ou palavra-chave" : "Buscar artigos"}
              className="h-11 rounded-lg border-[#dfe4ef] bg-white pl-11 text-sm shadow-none"
            />
          </div>
          <Button variant="outline" className="h-11 gap-2 rounded-lg border-[#dfe4ef] bg-white">
            <FilterIcon className="h-4 w-4" />
            Filtros
          </Button>
          <Button variant="outline" className="h-11 gap-2 rounded-lg border-[#dfe4ef] bg-white">
            Mais opcoes
            <MoreVerticalIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 flex gap-5 overflow-x-auto border-b border-[#edf0f7]">
          {filterOptions.map((option) => {
            const active = activeFilter === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onFilterChange(option.key)}
                className={cn(
                  "relative whitespace-nowrap pb-3 text-sm font-semibold",
                  active ? "text-[#6259ff]" : "text-[#56627f] hover:text-[#111936]"
                )}
              >
                {option.label}
                <span className="ml-2 rounded-full bg-[#f0f2fb] px-2 py-0.5 text-xs text-[#667391]">{formatNumber(option.count)}</span>
                {active ? <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[#6259ff]" /> : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#56627f]">
          <span>
            {activeStage === "identification" ? `${selectedIdentificationIds.length} selecionados` : selectedArticle ? "1 selecionado" : "Nenhum selecionado"}
          </span>
          <div className="flex items-center gap-2">
            {activeStage === "identification" ? (
              <Button size="sm" className="h-8 gap-2 rounded-lg bg-[#6259ff] text-xs text-white hover:bg-[#5148ee]" onClick={onPromoteSelected}>
                <CheckIcon className="h-3.5 w-3.5" />
                Enviar para triagem
              </Button>
            ) : null}
            <span>Ordenar por:</span>
            <Button variant="outline" size="sm" className="h-8 rounded-lg border-[#dfe4ef] bg-white text-xs">Mais recentes</Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-[#dfe4ef] bg-[#f0edff] text-[#6259ff]"><ListIcon className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-[#dfe4ef] bg-white"><Grid2X2Icon className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <div className="min-h-[420px]">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-[#667391]">
            <LoaderIcon className="h-4 w-4 animate-spin" />
            Carregando artigos...
          </div>
        ) : articles.length ? (
          articles.map((article) => {
            const badge = getArticleBadge(article, activeStage, duplicateIds);
            const selected = selectedArticle?.id === article.id;
            const checked = activeStage === "identification"
              ? selectedIdentificationIds.includes(article.id)
              : selected;

            return (
              <button
                key={article.id}
                type="button"
                onClick={() => onArticleSelect(article)}
                className={cn(
                  "flex w-full items-start gap-4 border-b border-[#edf0f7] px-5 py-4 text-left last:border-b-0 hover:bg-[#fbfcff]",
                  selected && "bg-[#fbfaff] ring-1 ring-inset ring-[#c9c3ff]"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    event.stopPropagation();
                    if (activeStage === "identification") {
                      onToggleIdentification(article.id);
                    } else {
                      onArticleSelect(article);
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                  className="mt-2 h-4 w-4 rounded border-[#c6cede] accent-[#6259ff]"
                />
                <span className={cn("mt-3 h-2 w-2 shrink-0 rounded-full", badge.dot)} />
                <SourceBadge article={article} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-6 text-[#111936]">{article.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-[#56627f]">{article.authors}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-[#56627f]">
                    {article.year} · {article.journal}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", badge.className)}>{badge.label}</span>
                  <span className="text-xs text-[#56627f]">{formatDate(article.updatedAt || article.createdAt)}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <span className="grid h-7 w-7 place-items-center rounded-full text-[#667391] hover:bg-[#eef1ff]">
                        <MoreVerticalIcon className="h-4 w-4" />
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpenArticle(article.id)}>Abrir artigo</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </button>
            );
          })
        ) : (
          <div className="grid h-64 place-items-center px-6 text-center text-sm text-[#667391]">
            Nenhum artigo encontrado nesta etapa.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#edf0f7] px-5 py-4 text-sm text-[#667391]">
        <span>Mostrando 1 a {formatNumber(articles.length)} de {formatNumber(getStageCount(summary, activeStage))} artigos</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-[#dfe4ef] bg-white"><ChevronLeftIcon className="h-4 w-4" /></Button>
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#bdb7ff] bg-[#f0edff] text-sm font-semibold text-[#6259ff]">1</span>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-[#dfe4ef] bg-white"><ChevronRightIcon className="h-4 w-4" /></Button>
        </div>
      </div>
    </section>
  );
}

function ArticleDetailPanel({
  activeStage,
  article,
  currentIndex,
  onClose,
  onMaybe,
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
          <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", badge.className)}>
            {badge.label}
          </span>
        </div>
        <h2 className="text-xl font-semibold leading-8 text-[#111936]">{article.title}</h2>
        <p className="mt-3 text-sm leading-6 text-[#56627f]">{article.authors}</p>
        <p className="mt-1 text-sm text-[#56627f]">
          {article.year} · {article.journal}{article.doi ? ` · DOI: ${article.doi}` : ""}
        </p>

        <div className="mt-5 flex gap-6 border-b border-[#edf0f7] text-sm font-semibold">
          <span className="relative pb-3 text-[#6259ff] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[#6259ff]">
            {isIncludedStage ? "Dados do estudo" : activeStage === "eligibility" ? "Texto completo" : "Resumo"}
          </span>
          <span className="pb-3 text-[#56627f]">Detalhes</span>
          <span className="pb-3 text-[#56627f]">Citacoes</span>
          <span className="pb-3 text-[#56627f]">Anexos ({article.hasPdf ? 1 : 0})</span>
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
                  <span className="text-sm font-semibold text-[#111936]">{article.hasPdf ? "PDF disponivel" : "Texto completo pendente"}</span>
                  <Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={() => article.hasPdf ? onOpenArticle(article.id) : onOpenUploadPdf(article)}>
                    {article.hasPdf ? <ExternalLinkIcon className="h-3.5 w-3.5" /> : <UploadIcon className="h-3.5 w-3.5" />}
                    {article.hasPdf ? "Abrir artigo" : "Enviar PDF"}
                  </Button>
                </div>
                <div className="h-64 overflow-hidden rounded-md border border-[#dfe4ef] bg-white p-5 text-sm leading-6 text-[#56627f]">
                  {article.abstract || "Este artigo ainda nao possui resumo cadastrado. Envie o PDF ou complemente os metadados para avaliar o texto completo."}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-[#111936]">Resumo</h3>
                <p className="mt-3 line-clamp-[8] text-sm leading-7 text-[#56627f]">
                  {article.abstract || "Resumo nao cadastrado para este artigo."}
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
                <h3 className="mb-3 text-sm font-semibold text-[#111936]">Sua decisao</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <Button className="h-12 gap-2 rounded-lg border border-[#27a363] bg-[#eefaf3] text-[#19884f] hover:bg-[#e3f6eb]" onClick={() => onOpenScreening(article, "included")}>
                    <CheckCircle2Icon className="h-5 w-5" />
                    Incluir
                  </Button>
                  <Button className="h-12 gap-2 rounded-lg border border-[#ef6262] bg-[#fff0f0] text-[#d94343] hover:bg-[#ffe4e4]" onClick={() => onOpenScreening(article, "excluded")}>
                    <XCircleIcon className="h-5 w-5" />
                    Excluir
                  </Button>
                  <Button variant="outline" className="h-12 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onMaybe}>
                    <HelpCircleIcon className="h-5 w-5" />
                    Talvez
                  </Button>
                </div>
              </div>
            ) : null}

            {activeStage === "eligibility" ? (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#111936]">Sua decisao</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <Button className="h-12 gap-2 rounded-lg border border-[#27a363] bg-[#eefaf3] text-[#19884f] hover:bg-[#e3f6eb]" onClick={() => onOpenEligibility(article, "included")}>
                    <CheckCircle2Icon className="h-5 w-5" />
                    Incluir
                  </Button>
                  <Button className="h-12 gap-2 rounded-lg border border-[#ef6262] bg-[#fff0f0] text-[#d94343] hover:bg-[#ffe4e4]" onClick={() => onOpenEligibility(article, "excluded")}>
                    <XCircleIcon className="h-5 w-5" />
                    Excluir
                  </Button>
                  <Button variant="outline" className="h-12 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onMaybe}>
                    <HelpCircleIcon className="h-5 w-5" />
                    Aguardando
                  </Button>
                </div>
                {!article.hasPdf ? (
                  <Button variant="outline" className="mt-3 h-10 rounded-lg border-[#dfe4ef] bg-white" onClick={() => onOpenEligibility(article, "full_text_unavailable")}>
                    Marcar texto completo indisponivel
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end">
              <span className="text-xs text-[#21945a]">Salvo automaticamente</span>
            </div>
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

function StageSidebar({
  activeStage,
  articles,
  duplicateCandidates,
  onBatchEvaluate,
  onExportStage,
  onRunDedup,
  onViewFlow,
  summary,
}) {
  const count = getStageCount(summary, activeStage);
  const extractionPending = articles.filter((article) => !Object.keys(article.extractionData || {}).length).length;

  const rows = {
    identification: [
      { label: "Duplicatas", value: summary?.duplicatesRemoved || 0, dot: "bg-[#ff920f]" },
      { label: "Unicos", value: Math.max((summary?.identification?.total || 0) - (summary?.duplicatesRemoved || 0), 0), dot: "bg-[#14a365]" },
    ],
    screening: [
      { label: "Incluir", value: Math.max((summary?.screening?.total || 0) - (summary?.screening?.excluded || 0) - (summary?.screening?.active || 0), 0), dot: "bg-[#14a365]" },
      { label: "Excluir", value: summary?.screening?.excluded || 0, dot: "bg-[#f04444]" },
      { label: "Talvez", value: summary?.screening?.active || 0, dot: "bg-[#ff920f]" },
    ],
    eligibility: [
      { label: "Excluir", value: summary?.eligibility?.excluded || 0, dot: "bg-[#f04444]" },
      { label: "Incluir", value: summary?.included || 0, dot: "bg-[#14a365]" },
      { label: "Aguardando", value: summary?.eligibility?.active || 0, dot: "bg-[#a4adc2]" },
    ],
    included: [
      { label: "Incluidos", value: summary?.included || 0, dot: "bg-[#14a365]" },
      { label: "Aguarda extracao", value: extractionPending, dot: "bg-[#6259ff]" },
    ],
  }[activeStage];

  return (
    <aside className="space-y-4">
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
        <h3 className="text-sm font-semibold text-[#111936]">Acoes rapidas</h3>
        <div className="mt-4 space-y-2">
          {activeStage === "identification" ? (
            <>
              <Button variant="outline" className="h-10 w-full justify-between rounded-lg border-[#dfe4ef] bg-white" onClick={onRunDedup}>
                Detectar duplicatas
                <span className="rounded-full bg-[#6259ff] px-2 py-0.5 text-xs text-white">{duplicateCandidates.length}</span>
              </Button>
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onExportStage}>
                Exportar etapa
              </Button>
            </>
          ) : null}
          {activeStage === "screening" ? (
            <>
              <Button variant="outline" className="h-10 w-full justify-start gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onBatchEvaluate}>
                <SparklesIcon className="h-4 w-4" />
                Triagem IA
              </Button>
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
              <Button variant="outline" className="h-10 w-full justify-start gap-2 rounded-lg border-[#dfe4ef] bg-white">
                <DatabaseIcon className="h-4 w-4" />
                Iniciar extracao de dados
              </Button>
              <Button variant="outline" className="h-10 w-full justify-start rounded-lg border-[#dfe4ef] bg-white" onClick={onExportStage}>
                Exportar lista de incluidos
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
              ? "Preencha a extracao estruturada dos estudos incluidos antes da sintese final."
              : "Registre decisoes com justificativas para manter a trilha de auditoria da revisao."}
        </p>
      </section>
    </aside>
  );
}

function ProjectArticles({ project, onNavigate, onGraphNeedsRefresh, onViewFlow }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNewArticleModal, setShowNewArticleModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUploadPdfModal, setShowUploadPdfModal] = useState(false);
  const [pdfTarget, setPdfTarget] = useState(null);
  const [screeningInitialDecision, setScreeningInitialDecision] = useState("included");
  const [eligibilityInitialDecision, setEligibilityInitialDecision] = useState("included");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState(null);

  const {
    activeFlowTab,
    articles,
    duplicateCandidates,
    eligibilityArticle,
    identificationArticles,
    isBatchEvaluating,
    isLoadingArticles,
    isLoadingDuplicates,
    isSavingDecision,
    promoteSelectedToScreening,
    refreshAll,
    runBatchEvaluate,
    runDedupAnalysis,
    screeningArticle,
    searchTerm,
    selectedIdentificationIds,
    setActiveFlowTab,
    setEligibilityArticle,
    setScreeningArticle,
    setSearchTerm,
    submitEligibilityDecision,
    submitScreeningDecision,
    summary,
    toggleIdentificationSelection,
  } = useProjectArticles(project, onGraphNeedsRefresh);

  const activeStage = STAGES.some((stage) => stage.key === activeFlowTab)
    ? activeFlowTab
    : "identification";

  useEffect(() => {
    if (activeFlowTab === "overview" || activeFlowTab === "report") {
      setActiveFlowTab("identification");
    }
  }, [activeFlowTab, setActiveFlowTab]);

  useEffect(() => {
    if (searchParams.get("action") !== "import") {
      return;
    }

    setShowImportModal(true);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("action");
      return next;
    });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setActiveFilter("all");
    setSelectedArticle(null);
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
    () => getFilterOptions(activeStage, summary, duplicateIds, stageArticles),
    [activeStage, duplicateIds, stageArticles, summary]
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

  useEffect(() => {
    setSelectedArticle((current) => {
      if (current && filteredArticles.some((article) => article.id === current.id)) {
        return current;
      }
      return filteredArticles[0] || null;
    });
  }, [filteredArticles]);

  const selectedIndex = selectedArticle
    ? filteredArticles.findIndex((article) => article.id === selectedArticle.id)
    : -1;

  function openEligibilityDecision(article, initialDecision = "included") {
    setEligibilityInitialDecision(initialDecision);
    setEligibilityArticle(article);
  }

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
    setSelectedArticle(filteredArticles[nextIndex]);
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

  function handleMaybe() {
    toast.info("O artigo permanece pendente para decisao posterior.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" className="h-10 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={handleExportStage}>
          <DownloadIcon className="h-4 w-4" />
          Exportar dados
        </Button>
        <Button className="h-10 gap-2 rounded-lg bg-[#6259ff] px-4 text-white hover:bg-[#5148ee]" onClick={() => setShowImportModal(true)}>
          <PlusIcon className="h-4 w-4" />
          Importar artigos
        </Button>
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-[#dfe4ef] bg-white" onClick={() => setShowNewArticleModal(true)}>
          <MoreVerticalIcon className="h-4 w-4" />
        </Button>
      </div>

      <StageStepper
        activeStage={activeStage}
        onStageChange={setActiveFlowTab}
        summary={summary}
      />

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.08fr)_minmax(430px,0.88fr)_300px]">
        <StageListPanel
          activeFilter={activeFilter}
          activeStage={activeStage}
          articles={filteredArticles}
          duplicateIds={duplicateIds}
          filterOptions={filterOptions}
          isLoading={isLoadingArticles}
          onArticleSelect={setSelectedArticle}
          onFilterChange={setActiveFilter}
          onOpenArticle={(articleId) => {
            const params = new URLSearchParams({ flow: activeStage });
            if (activeStage === "included") {
              params.set("workspace", "extracao");
            }
            onNavigate(`/projetos/${project.id}/artigos/${articleId}?${params.toString()}`);
          }}
          onPromoteSelected={promoteSelectedToScreening}
          onToggleIdentification={toggleIdentificationSelection}
          searchTerm={searchTerm}
          selectedArticle={selectedArticle}
          selectedIdentificationIds={selectedIdentificationIds}
          setSearchTerm={setSearchTerm}
          summary={summary}
        />

        <ArticleDetailPanel
          activeStage={activeStage}
          article={selectedArticle}
          currentIndex={selectedIndex >= 0 ? selectedIndex : 0}
          onClose={() => setSelectedArticle(null)}
          onMaybe={handleMaybe}
          onNext={() => selectAdjacent(1)}
          onOpenArticle={(articleId, workspace) => {
            const params = new URLSearchParams({ flow: activeStage });
            if (workspace || activeStage === "included") {
              params.set("workspace", workspace || "extracao");
            }
            onNavigate(`/projetos/${project.id}/artigos/${articleId}?${params.toString()}`);
          }}
          onOpenEligibility={openEligibilityDecision}
          onOpenScreening={(article, initialDecision) => {
            setScreeningInitialDecision(initialDecision);
            setScreeningArticle(article);
            if (initialDecision === "excluded") {
              toast.info("Informe a justificativa na janela de decisao.");
            }
          }}
          onOpenUploadPdf={openUploadPdf}
          onPrevious={() => selectAdjacent(-1)}
          project={project}
          total={filteredArticles.length}
        />

        <StageSidebar
          activeStage={activeStage}
          articles={stageArticles}
          duplicateCandidates={duplicateCandidates}
          onBatchEvaluate={runBatchEvaluate}
          onExportStage={handleExportStage}
          onRunDedup={handleDedupAndRefresh}
          onViewFlow={onViewFlow}
          summary={summary}
        />
      </div>

      {isBatchEvaluating || isLoadingDuplicates ? (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 rounded-lg border border-[#edf0f7] bg-white px-4 py-3 text-sm text-[#667391] shadow-lg">
          <LoaderIcon className="h-4 w-4 animate-spin" />
          Processando etapa...
        </div>
      ) : null}

      <NewArticleModal
        isOpen={showNewArticleModal}
        onClose={() => setShowNewArticleModal(false)}
        onSuccess={() => refreshAll()}
        projectId={project.id}
      />

      <ImportBibTeXModal
        isOpen={showImportModal}
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

      <ScreeningDecisionDialog
        article={screeningArticle}
        initialDecision={screeningInitialDecision}
        isOpen={Boolean(screeningArticle)}
        isSaving={isSavingDecision}
        onClose={() => setScreeningArticle(null)}
        onSubmit={submitScreeningDecision}
      />

      <EligibilityDecisionDialog
        article={eligibilityArticle}
        checklist={project?.eligibilityChecklist || []}
        initialDecision={eligibilityInitialDecision}
        projectId={project?.id}
        researchQuestions={project?.researchQuestions || []}
        isOpen={Boolean(eligibilityArticle)}
        isSaving={isSavingDecision}
        onClose={() => setEligibilityArticle(null)}
        onSubmit={submitEligibilityDecision}
      />
    </div>
  );
}

export default ProjectArticles;
