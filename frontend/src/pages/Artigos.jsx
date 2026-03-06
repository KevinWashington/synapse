import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Search,
  Filter,
  Bot,
  MessageSquare,
  Paperclip,
  ChevronRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { SlidePanel } from "@/components/ui/slide-panel";
import { LoadingState, EmptyState } from "@/components/layout";
import { usePageTitle } from "@/context/pageTitleContext";
import { projectService } from "@/features/projects";
import { articleService } from "@/features/articles";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function Artigos() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const response = await projectService.getAllProjects({ limit: 100 });
      setProjects(response.projects || []);
      if (response.projects?.length > 0 && selectedProjectId === "all") {
        setSelectedProjectId(response.projects[0].id.toString());
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    }
  }, []);

  const loadArticles = useCallback(async (projectId) => {
    if (!projectId || projectId === "all") return;
    try {
      setLoading(true);
      const params = {};
      if (filterStatus !== "todos") params.status = filterStatus;
      if (searchTerm) params.search = searchTerm;
      const response = await articleService.getArticlesByProject(projectId, params);
      setArticles(response.articles || []);
    } catch (err) {
      console.error("Error loading articles:", err);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchTerm]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProjectId && selectedProjectId !== "all") {
      loadArticles(selectedProjectId);
    }
  }, [selectedProjectId, loadArticles]);

  const openDetail = (article) => {
    setSelectedArticle(article);
    setPanelOpen(true);
  };

  const getStatusVariant = (status) => {
    const map = { pendente: "medium", analisado: "low", excluido: "high" };
    return map[status] || "neutral";
  };

  usePageTitle({ title: "Biblioteca de Artigos" });

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--syn-text-secondary)]" />
          <Input
            placeholder="Pesquisar artigos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selecionar projeto" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
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

      {/* Articles list */}
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
              className="flex items-center gap-4 p-4 rounded-[var(--syn-radius-card)] bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)] border border-[var(--syn-border)] shadow-[var(--syn-shadow-card)] cursor-pointer hover:shadow-[var(--syn-shadow-card-hover)] syn-transition group"
            >
              <div className="h-10 w-10 rounded-lg bg-[var(--syn-badge-blue-bg)] flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-[var(--syn-badge-blue-text)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--syn-text-primary)] truncate">
                  {article.title}
                </h3>
                <p className="text-xs text-[var(--syn-text-secondary)] truncate mt-0.5">
                  {article.authors} • {article.year} • {article.journal}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
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
                <ChevronRight className="h-4 w-4 text-[var(--syn-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Article Detail Panel */}
      <SlidePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={selectedArticle?.title || ""}
        breadcrumb="Artigos › Biblioteca"
        badge={selectedArticle && <StatusBadge status={selectedArticle.status} />}
        onExpand={
          selectedArticle
            ? () =>
                navigate(
                  `/projetos/${selectedProjectId}/artigos/${selectedArticle.id}`
                )
            : undefined
        }
      >
        {selectedArticle && (
          <div className="p-6 space-y-6">
            {/* Metadata */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                Metadados
              </h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-[var(--syn-text-secondary)]">Autores</dt>
                  <dd className="text-[var(--syn-text-primary)] font-medium">
                    {selectedArticle.authors}
                  </dd>
                </div>
                <div className="flex gap-8">
                  <div>
                    <dt className="text-[var(--syn-text-secondary)]">Ano</dt>
                    <dd className="text-[var(--syn-text-primary)] font-medium">
                      {selectedArticle.year}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--syn-text-secondary)]">Journal</dt>
                    <dd className="text-[var(--syn-text-primary)] font-medium">
                      {selectedArticle.journal}
                    </dd>
                  </div>
                </div>
                {selectedArticle.doi && (
                  <div>
                    <dt className="text-[var(--syn-text-secondary)]">DOI</dt>
                    <dd className="text-[var(--syn-text-primary)] font-medium">
                      {selectedArticle.doi}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Abstract */}
            {selectedArticle.abstract && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                  Abstract
                </h3>
                <p className="text-sm text-[var(--syn-text-primary)] leading-relaxed">
                  {selectedArticle.abstract}
                </p>
              </div>
            )}

            {/* AI Analysis */}
            {selectedArticle.aiRelevanceScore != null && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                  Análise IA
                </h3>
                <div className="p-3 rounded-lg bg-[var(--syn-bg-secondary)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--syn-text-secondary)]">Relevância</span>
                    <span className="text-sm font-bold text-[var(--syn-text-primary)]">
                      {selectedArticle.aiRelevanceScore}%
                    </span>
                  </div>
                  {selectedArticle.aiEvaluation && (
                    <p className="text-xs text-[var(--syn-text-secondary)] leading-relaxed">
                      {selectedArticle.aiEvaluation}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {selectedArticle.aiMethodology && (
                      <StatusBadge variant="blue" label={selectedArticle.aiMethodology} />
                    )}
                    {selectedArticle.aiDomain && (
                      <StatusBadge variant="neutral" label={selectedArticle.aiDomain} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedArticle.notas && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                  Notas
                </h3>
                <p className="text-sm text-[var(--syn-text-primary)] leading-relaxed whitespace-pre-wrap">
                  {selectedArticle.notas}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() =>
                  navigate(
                    `/projetos/${selectedProjectId}/artigos/${selectedArticle.id}`
                  )
                }
              >
                Revisar Artigo
              </Button>
              <Button variant="outline" size="sm">
                Exportar
              </Button>
            </div>
          </div>
        )}
      </SlidePanel>
    </div>
  );
}

export default Artigos;
