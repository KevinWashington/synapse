import {
  Bot,
  ChevronRight,
  FileText,
  MessageSquare,
  Paperclip,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, LoadingState } from "@/components/layout";
import {
  ArticleLibraryDetailPanel,
  useArticlesLibraryPage,
} from "@/features/articles";
import { usePageTitle } from "@hooks/usePageTitle";

function Articles() {
  const {
    articles,
    filterStatus,
    loading,
    openDetail,
    panelOpen,
    projects,
    searchTerm,
    selectedArticle,
    selectedProjectId,
    setFilterStatus,
    setPanelOpen,
    setSearchTerm,
    setSelectedProjectId,
  } = useArticlesLibraryPage();

  usePageTitle({ title: "Biblioteca de Artigos" });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--syn-text-secondary)]" />
          <Input
            placeholder="Pesquisar artigos..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-full sm:w-[200px] sm:max-w-[200px]">
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
          <SelectTrigger className="w-full sm:w-[140px] sm:max-w-[140px]">
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

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
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
              <div
                key={article.id}
                onClick={() => openDetail(article)}
                className="group flex cursor-pointer items-center gap-4 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4 shadow-[var(--syn-shadow-card)] syn-transition hover:shadow-[var(--syn-shadow-card-hover)] dark:bg-[var(--syn-bg-primary)]"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--syn-badge-blue-bg)]">
                  <FileText className="h-5 w-5 text-[var(--syn-badge-blue-text)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-[var(--syn-text-primary)]">
                    {article.title}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[var(--syn-text-secondary)]">
                    {article.authors} • {article.year} • {article.journal}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {article.hasPdf && (
                    <Paperclip className="h-3.5 w-3.5 text-[var(--syn-text-secondary)]" />
                  )}
                  {article.aiRelevanceScore != null && (
                    <Bot className="h-3.5 w-3.5 text-[var(--syn-badge-blue-text)]" />
                  )}
                  {article.notas && (
                    <MessageSquare className="h-3.5 w-3.5 text-[var(--syn-text-secondary)]" />
                  )}
                  <StatusBadge status={article.status} />
                  <ChevronRight className="h-4 w-4 text-[var(--syn-text-secondary)] opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
