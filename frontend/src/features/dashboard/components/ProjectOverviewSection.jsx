import { Clock, FileText, FolderIcon } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";

function ProjectCard({ project, onOpenProject }) {
  return (
    <div
      onClick={() => onOpenProject(project.id)}
      className="cursor-pointer rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4 shadow-[var(--syn-shadow-card)] syn-transition hover:shadow-[var(--syn-shadow-card-hover)] dark:bg-[var(--syn-bg-primary)]"
    >
      <div className="mb-2 flex items-start justify-between">
        <h4 className="line-clamp-1 text-sm font-semibold text-[var(--syn-text-primary)]">
          {project.title}
        </h4>
        <StatusBadge status={project.status} />
      </div>
      <p className="mb-3 line-clamp-2 text-xs text-[var(--syn-text-secondary)]">
        {project.objetivo}
      </p>
      <div className="flex items-center gap-4 text-xs text-[var(--syn-text-secondary)]">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(project.updatedAt || project.created_at).toLocaleDateString("pt-BR")}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {project.articleCount || 0}
        </span>
      </div>
    </div>
  );
}

function ProjectOverviewSection({
  activeTab,
  filteredProjects,
  loading,
  onOpenProject,
  onTabChange,
  tabs,
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-1 border-b border-[var(--syn-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-[var(--syn-sidebar-accent)]"
                : "text-[var(--syn-text-secondary)] hover:text-[var(--syn-text-primary)]"
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                activeTab === tab.key
                  ? "bg-[var(--syn-sidebar-accent)] text-white"
                  : "bg-[var(--syn-badge-neutral-bg)] text-[var(--syn-badge-neutral-text)]"
              }`}
            >
              {tab.count}
            </span>
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--syn-sidebar-accent)]" />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Carregando projetos..." />
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.slice(0, 6).map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpenProject={onOpenProject}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderIcon}
          title="Nenhum projeto"
          description="Comece criando seu primeiro projeto."
          actionLabel="Criar Projeto"
          onAction={() => onOpenProject()}
        />
      )}
    </div>
  );
}

export default ProjectOverviewSection;
