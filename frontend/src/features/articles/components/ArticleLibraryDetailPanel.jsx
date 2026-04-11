import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { StatusBadge } from "@/components/ui/StatusBadge";

function ArticleLibraryDetailPanel({
  article,
  isOpen,
  onClose,
  projectId,
}) {
  const navigate = useNavigate();

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={article?.title || ""}
      breadcrumb="Artigos > Biblioteca"
      badge={article && <StatusBadge status={article.status} />}
      onExpand={
        article
          ? () => navigate(`/projetos/${projectId}/artigos/${article.id}`)
          : undefined
      }
    >
      {article && (
        <div className="space-y-6 p-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
              Metadados
            </h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[var(--syn-text-secondary)]">Autores</dt>
                <dd className="font-medium text-[var(--syn-text-primary)]">
                  {article.authors}
                </dd>
              </div>
              <div className="flex gap-8">
                <div>
                  <dt className="text-[var(--syn-text-secondary)]">Ano</dt>
                  <dd className="font-medium text-[var(--syn-text-primary)]">
                    {article.year}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--syn-text-secondary)]">Journal</dt>
                  <dd className="font-medium text-[var(--syn-text-primary)]">
                    {article.journal}
                  </dd>
                </div>
              </div>
              {article.doi && (
                <div>
                  <dt className="text-[var(--syn-text-secondary)]">DOI</dt>
                  <dd className="font-medium text-[var(--syn-text-primary)]">
                    {article.doi}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {article.abstract && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                Abstract
              </h3>
              <p className="text-sm leading-relaxed text-[var(--syn-text-primary)]">
                {article.abstract}
              </p>
            </div>
          )}

          {article.aiRelevanceScore != null && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                Análise IA
              </h3>
              <div className="space-y-2 rounded-lg bg-[var(--syn-bg-secondary)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--syn-text-secondary)]">Relevância</span>
                  <span className="text-sm font-bold text-[var(--syn-text-primary)]">
                    {article.aiRelevanceScore}%
                  </span>
                </div>
                {article.aiEvaluation && (
                  <p className="text-xs leading-relaxed text-[var(--syn-text-secondary)]">
                    {article.aiEvaluation}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {article.aiMethodology && (
                    <StatusBadge variant="blue" label={article.aiMethodology} />
                  )}
                  {article.aiDomain && (
                    <StatusBadge variant="neutral" label={article.aiDomain} />
                  )}
                </div>
              </div>
            </div>
          )}

          {article.notas && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                Notas
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--syn-text-primary)]">
                {article.notas}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => navigate(`/projetos/${projectId}/artigos/${article.id}`)}
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
  );
}

export default ArticleLibraryDetailPanel;
