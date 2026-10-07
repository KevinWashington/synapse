import {
  Bot,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageSquare,
  Paperclip,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, LoadingState } from "@/components/layout";
import {
  ArticleLibraryDetailPanel,
  useArticlesLibraryPage,
} from "@/features/articles";
import { usePageTitle } from "@hooks/usePageTitle";

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function getSourceInitial(sourceName) {
  return (sourceName || "Artigo")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ArticleLibraryList({
  articles,
  loading,
  onOpenArticle,
  onPageChange,
  page,
  pageSize,
  total,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total ? ((page - 1) * pageSize) + 1 : 0;
  const rangeEnd = total ? rangeStart + articles.length - 1 : 0;

  return (
    <section data-testid="library-list-surface" className="flex min-h-[420px] flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--syn-border)] pb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--syn-text-primary)]">Artigos do projeto</h2>
          <p className="mt-1 text-xs text-[var(--syn-text-secondary)]">{formatNumber(total)} registros encontrados</p>
        </div>
        <span className="rounded-full bg-[var(--syn-badge-blue-bg)] px-3 py-1 text-xs font-semibold text-[var(--syn-badge-blue-text)]">
          {formatNumber(total)}
        </span>
      </div>

      <div data-testid="library-list-scroll" className="min-h-0 flex-1 overflow-y-auto py-3">
        {loading ? (
          <LoadingState message="Carregando artigos..." />
        ) : articles.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum artigo encontrado"
            description="Selecione um projeto ou importe artigos via BibTeX"
          />
        ) : (
          <div className="grid gap-3">
            {articles.map((article) => (
              <article
                key={article.id}
                data-testid="library-article-card"
                className="group grid gap-3 rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4 transition-colors hover:border-[#c9c3ff] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <button
                  type="button"
                  onClick={() => onOpenArticle(article)}
                  className="flex min-w-0 cursor-pointer items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40"
                  aria-label={`Abrir ${article.title}`}
                >
                  <span className="grid h-10 min-w-10 shrink-0 place-items-center rounded-lg bg-[#eef1ff] text-xs font-bold text-[#6259ff]">
                    {getSourceInitial(article.sourceName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-2 text-sm font-semibold leading-5 text-[var(--syn-text-primary)] group-hover:text-[#6259ff]">
                      {article.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--syn-text-secondary)]">
                      {article.authors || "Autoria não informada"}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--syn-text-secondary)]">
                      <span className="font-medium text-[#6259ff]">{article.sourceName || "Fonte não informada"}</span>
                      {article.year ? <span>{article.year}</span> : null}
                      {article.journal ? <span className="max-w-[360px] truncate">{article.journal}</span> : null}
                    </span>
                  </span>
                </button>

                <div className="flex items-center justify-between gap-3 border-t border-[var(--syn-border)] pt-3 sm:justify-end sm:border-0 sm:pt-0">
                  <div className="flex items-center gap-2 text-[var(--syn-text-secondary)]">
                    {article.hasPdf ? <Paperclip className="h-4 w-4" aria-label="PDF disponível" /> : null}
                    {article.aiRelevanceScore != null ? <Bot className="h-4 w-4 text-[var(--syn-badge-blue-text)]" aria-label="Avaliação por IA" /> : null}
                    {article.notas ? <MessageSquare className="h-4 w-4" aria-label="Possui notas" /> : null}
                  </div>
                  <StatusBadge status={article.status} />
                  <button
                    type="button"
                    onClick={() => onOpenArticle(article)}
                    aria-label={`Abrir detalhes de ${article.title}`}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[var(--syn-text-secondary)] transition-colors hover:bg-[#eef1ff] hover:text-[#6259ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--syn-border)] py-4 text-xs text-[var(--syn-text-secondary)]">
        <span>Mostrando {formatNumber(rangeStart)}–{formatNumber(rangeEnd)} de {formatNumber(total)} artigos</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Página anterior"
            className="h-8 w-8 rounded-lg"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-24 text-center">Página {page} de {pageCount}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Próxima página"
            className="h-8 w-8 rounded-lg"
            disabled={page >= pageCount || loading}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </section>
  );
}

function Articles() {
  const {
    articlePage,
    articlePageSize,
    articleTotal,
    articles,
    filterStatus,
    loading,
    openDetail,
    panelOpen,
    projects,
    searchTerm,
    selectedArticle,
    selectedProjectId,
    setArticlePage,
    setFilterStatus,
    setPanelOpen,
    setSearchTerm,
    setSelectedProjectId,
  } = useArticlesLibraryPage();

  usePageTitle({ title: "" });

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal text-[#0f1734]">Biblioteca de artigos</h1>
        <p className="mt-2 text-sm text-[#667391]">
          Consulte, filtre e retome a revisão dos artigos de todos os seus projetos.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--syn-text-secondary)]" />
          <Input
            placeholder="Pesquisar artigos..."
            aria-label="Pesquisar artigos"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger aria-label="Projeto da biblioteca" className="h-11 w-full bg-white sm:w-[220px] sm:max-w-[220px]">
            <SelectValue placeholder="Selecionar projeto" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id.toString()}>
                {project.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger aria-label="Status dos artigos" className="h-11 w-full bg-white sm:w-[160px] sm:max-w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Não lido</SelectItem>
            <SelectItem value="analisado">Lido</SelectItem>
            <SelectItem value="excluido">Excluído</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ArticleLibraryList
        articles={articles}
        loading={loading}
        onOpenArticle={openDetail}
        onPageChange={setArticlePage}
        page={articlePage}
        pageSize={articlePageSize}
        total={articleTotal}
      />

      <ArticleLibraryDetailPanel
        article={selectedArticle}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        projectId={selectedProjectId}
      />
    </div>
  );
}

export default Articles;
