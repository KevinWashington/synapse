/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderIcon,
  MoreVerticalIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { getQueueStatus } from "../../utils/reviewWorkspace";

const STAGE_LABELS = {
  identification: "Identificação",
  screening: "Triagem",
  eligibility: "Elegibilidade",
  included: "Inclusão",
};

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
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function getSourceInitial(sourceName) {
  if (!sourceName) return "DB";
  if (sourceName === "Web of Science") return "W";
  if (sourceName === "IEEE Xplore") return "IEEE";
  if (sourceName === "ScienceDirect") return "SD";
  return sourceName.slice(0, 2).toUpperCase();
}

function getStageCount(summary, stageKey) {
  if (stageKey === "included") return summary?.included || 0;
  return summary?.[stageKey]?.total || 0;
}

export function getArticleBadge(article, stageKey, duplicateIds, extractionSchema = []) {
  return getQueueStatus(article, stageKey, duplicateIds, extractionSchema);
}

export function getFilterOptions(stageKey, duplicateIds, articles, stageTotal = articles.length) {
  if (stageKey === "identification") {
    const duplicates = duplicateIds.size;
    return [
      { key: "all", label: "Na fila", count: stageTotal },
      { key: "duplicates", label: "Duplicatas", count: duplicates },
      { key: "unique", label: "Únicos", count: Math.max(stageTotal - duplicates, 0) },
    ];
  }

  if (stageKey === "screening" || stageKey === "eligibility") {
    return [
      { key: "all", label: "Na fila", count: stageTotal },
      { key: "assigned", label: "Atribuídos a mim" },
    ];
  }

  return [
    { key: "all", label: "Todos", count: stageTotal },
    { key: "pending_extraction", label: "Aguarda extração" },
  ];
}

function SourceBadge({ article }) {
  const tone = SOURCE_TONES[article.sourceName] || "bg-[#eef3ff] text-[#4d68ff]";
  return (
    <span className="flex w-12 shrink-0 flex-col items-center gap-1 text-center">
      <span className={cn("grid h-8 min-w-8 place-items-center rounded-md px-1 text-[10px] font-bold", tone)}>
        {getSourceInitial(article.sourceName)}
      </span>
      <span className="line-clamp-1 max-w-12 text-[10px] text-[#667391]">{article.sourceName}</span>
    </span>
  );
}

function ReviewQueuePanel({
  activeFilter,
  activeStage,
  articlePage = 1,
  articlePageSize = 20,
  articleTotal,
  articles,
  canManageArticles = true,
  duplicateIds,
  extractionSchema = [],
  filterOptions,
  isLoading,
  isPromotingUnique = false,
  onArticleSelect,
  onFilterChange,
  onOpenArticle,
  onPageChange,
  onPromoteAllUnique,
  onPromoteSelected,
  onToggleAllIdentification,
  onToggleIdentification,
  progressLabel,
  searchTerm,
  selectedArticle,
  selectedIdentificationIds,
  setSearchTerm,
  summary,
}) {
  const [confirmPromoteAllOpen, setConfirmPromoteAllOpen] = useState(false);
  const visibleIds = articles.map((article) => article.id);
  const allVisibleSelected = visibleIds.length > 0
    && visibleIds.every((id) => selectedIdentificationIds.includes(id));
  const reachedStageCount = getStageCount(summary, activeStage);
  const resolvedTotal = articleTotal ?? articles.length;
  const pageCount = Math.max(1, Math.ceil(resolvedTotal / articlePageSize));

  return (
    <>
      <section className="flex h-full min-h-0 min-w-0 flex-col bg-white xl:h-[720px]">
        <div className="border-b border-[#edf0f7] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-[#111936]">{STAGE_LABELS[activeStage]}</h2>
                <span className="rounded-full bg-[#f0edff] px-2.5 py-1 text-xs font-semibold text-[#6259ff]">
                  {formatNumber(resolvedTotal)} na fila
                </span>
              </div>
              {progressLabel ? <p className="mt-1 text-xs text-[#667391]">{progressLabel}</p> : null}
            </div>
            {activeStage === "identification" && canManageArticles ? (
              <Button
                size="sm"
                className="h-9 gap-2 rounded-lg bg-[#6259ff] text-xs text-white hover:bg-[#5148ee]"
                disabled={!resolvedTotal || isPromotingUnique}
                onClick={() => setConfirmPromoteAllOpen(true)}
              >
                {isPromotingUnique ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckIcon className="h-3.5 w-3.5" />}
                Enviar todos os únicos para triagem
              </Button>
            ) : null}
          </div>

          <div className="relative mt-4 min-w-0">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78839d]" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={activeStage === "identification" ? "Buscar por título, autor ou palavra-chave" : "Buscar artigos"}
              className="h-10 rounded-lg border-[#dfe4ef] bg-white pl-10 text-sm shadow-none"
            />
          </div>

          <div className="mt-4 flex gap-4 overflow-x-auto border-b border-[#edf0f7]">
            {filterOptions.map((option) => {
              const active = activeFilter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onFilterChange(option.key)}
                  className={cn(
                    "relative rounded-sm whitespace-nowrap pb-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]",
                    active ? "text-[#6259ff]" : "text-[#56627f] hover:text-[#111936]"
                  )}
                >
                  {option.label}
                  {option.count !== undefined ? (
                    <span className="ml-1.5 rounded-full bg-[#f0f2fb] px-1.5 py-0.5 text-[10px] text-[#667391]">
                      {formatNumber(option.count)}
                    </span>
                  ) : null}
                  {active ? <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[#6259ff]" /> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#56627f]">
            {activeStage === "identification" && canManageArticles ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os artigos visiveis"
                  checked={allVisibleSelected}
                  disabled={!visibleIds.length}
                  onChange={() => onToggleAllIdentification(visibleIds)}
                  className="h-4 w-4 rounded border-[#c6cede] accent-[#6259ff]"
                />
                <span>{allVisibleSelected ? "Limpar artigos visiveis" : "Selecionar artigos visiveis"} · {selectedIdentificationIds.length} selecionados</span>
              </label>
            ) : (
              <span>{selectedArticle ? "Artigo aberto no painel" : "Selecione um artigo para avaliar"}</span>
            )}
            {activeStage === "identification" && canManageArticles ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-2 rounded-lg border-[#dfe4ef] bg-white text-xs text-[#253252]"
                disabled={!selectedIdentificationIds.length}
                onClick={onPromoteSelected}
              >
                <CheckIcon className="h-3.5 w-3.5" />
                Enviar {selectedIdentificationIds.length} para triagem
              </Button>
            ) : null}
          </div>
        </div>

        <div data-testid="stage-list-scroll" className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-[#667391]">
              <LoaderIcon className="h-4 w-4 animate-spin" />
              Carregando artigos...
            </div>
          ) : articles.length ? (
            articles.map((article) => {
              const badge = getArticleBadge(article, activeStage, duplicateIds, extractionSchema);
              const selected = selectedArticle?.id === article.id;
              const checked = selectedIdentificationIds.includes(article.id);
              return (
                <div
                  key={article.id}
                  data-testid="stage-article-row"
                  data-article-title={article.title}
                  data-selected={String(selected)}
                  className={cn(
                    "flex min-w-0 w-full items-start gap-2 border-b border-[#edf0f7] px-4 py-3.5 text-left last:border-b-0 hover:bg-[#fbfcff]",
                    selected && "bg-[#fbfaff] ring-1 ring-inset ring-[#c9c3ff]"
                  )}
                >
                  {activeStage === "identification" && canManageArticles ? (
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${article.title}`}
                      checked={checked}
                      onChange={() => onToggleIdentification(article.id)}
                      className="mt-2 h-4 w-4 rounded border-[#c6cede] accent-[#6259ff]"
                    />
                  ) : null}
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onArticleSelect(article)}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]"
                  >
                    <span className={cn("mt-3 h-2 w-2 shrink-0 rounded-full", badge.dot)} />
                    <SourceBadge article={article} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold leading-5 text-[#111936]">{article.title}</span>
                      <span className="mt-1 block line-clamp-1 text-xs text-[#56627f]">{article.authors}</span>
                      <span className="mt-1 block line-clamp-1 text-xs text-[#56627f]">{article.year} · {article.journal}</span>
                      <span className="mt-2 flex min-w-0 items-center justify-between gap-2">
                        <span
                          title={badge.tooltip || badge.label}
                          className={cn("min-w-0 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold", badge.className)}
                        >
                          {badge.label}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#7a849d]">{formatDate(article.updatedAt || article.createdAt)}</span>
                      </span>
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`Mais acoes para ${article.title}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#667391] hover:bg-[#eef1ff]">
                        <MoreVerticalIcon className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpenArticle(article.id)}>Abrir artigo</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          ) : (
            <div className="grid h-64 place-items-center px-6 text-center text-sm text-[#667391]">
              Nenhum artigo encontrado nesta etapa.
            </div>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f7] px-4 py-3 text-sm text-[#667391]">
          <div className="flex flex-wrap items-center gap-2">
            <span>{formatNumber(articles.length)} {articles.length === 1 ? "exibido" : "exibidos"} de {formatNumber(resolvedTotal)}</span>
            {reachedStageCount !== resolvedTotal ? <span className="text-xs text-[#8b96ad]">{formatNumber(reachedStageCount)} chegaram a esta etapa</span> : null}
          </div>
          {pageCount > 1 ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" aria-label="Página anterior" className="h-8 w-8 rounded-lg border-[#dfe4ef] p-0" disabled={articlePage <= 1} onClick={() => onPageChange(articlePage - 1)}>
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <span className="min-w-24 text-center text-xs">Página {articlePage} de {pageCount}</span>
              <Button variant="outline" size="sm" aria-label="Próxima página" className="h-8 w-8 rounded-lg border-[#dfe4ef] p-0" disabled={articlePage >= pageCount} onClick={() => onPageChange(articlePage + 1)}>
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </section>
      <ConfirmationDialog
        open={confirmPromoteAllOpen}
        title="Enviar todos os únicos?"
        description={`Todos os ${formatNumber(resolvedTotal)} registros únicos elegíveis serão enviados para triagem. Grupos duplicados permanecerão para revisão.`}
        confirmLabel="Confirmar envio"
        isPending={isPromotingUnique}
        onConfirm={() => {
          setConfirmPromoteAllOpen(false);
          onPromoteAllUnique();
        }}
        onOpenChange={setConfirmPromoteAllOpen}
      />
    </>
  );
}

export default ReviewQueuePanel;
