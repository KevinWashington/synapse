import { SlidePanel } from "@/components/ui/SlidePanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import ProjectFrameworkBadge from "@features/projects/components/ProjectFrameworkBadge";

function ProjectQuickViewPanel({ isOpen, onClose, onExpand, project }) {
  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={project?.title || ""}
      breadcrumb="Projetos"
      badge={
        project && (
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status} />
            <ProjectFrameworkBadge framework={project.framework} />
          </div>
        )
      }
      onExpand={project ? onExpand : undefined}
    >
      {project && (
        <div className="space-y-6 p-6">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
              Descrição
            </h3>
            <p className="text-sm leading-relaxed text-[var(--syn-text-primary)]">
              {project.objetivo || "Sem descrição"}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
              Artigos ({project.articleCount || 0})
            </h3>
            {(project.articleCount || 0) > 0 ? (
              <p className="text-sm text-[var(--syn-text-secondary)]">
                Clique em "Expandir" para ver os artigos vinculados.
              </p>
            ) : (
              <p className="text-sm text-[var(--syn-text-secondary)]">
                Nenhum artigo vinculado ainda.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
              Informações
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--syn-text-secondary)]">Status</dt>
                <dd>
                  <StatusBadge status={project.status} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--syn-text-secondary)]">Criado em</dt>
                <dd className="text-[var(--syn-text-primary)]">
                  {new Date(project.created_at || project.createdAt).toLocaleDateString("pt-BR")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--syn-text-secondary)]">Atualizado</dt>
                <dd className="text-[var(--syn-text-primary)]">
                  {new Date(project.updatedAt || project.updated_at).toLocaleDateString("pt-BR")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
              Comentários
            </h3>
            <div className="rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] p-3">
              <input
                type="text"
                placeholder="Adicionar um comentário..."
                className="w-full bg-transparent text-sm text-[var(--syn-text-primary)] outline-none placeholder:text-[var(--syn-text-secondary)]"
              />
            </div>
          </div>
        </div>
      )}
    </SlidePanel>
  );
}

export default ProjectQuickViewPanel;

