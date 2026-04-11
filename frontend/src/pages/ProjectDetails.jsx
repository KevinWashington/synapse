import { lazy, Suspense, useEffect } from "react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  FileTextIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, LoadingState } from "@/components/layout";
import {
  EditProjectPanel,
  ProjectDetailsHeader,
  ProjectFrameworkBadge,
  useProjectDetailsPage,
} from "@/features/projects";
import { usePageTitle } from "@hooks/usePageTitle";

const ProjectArticles = lazy(() => import("@features/articles/components/ProjectArticles"));
const ArticleGraph = lazy(() => import("@features/articles/components/ArticleGraph"));
const ProjectPlanning = lazy(() =>
  import("@features/projects/components/ProjectPlanning")
);

function ProjectTabLoader() {
  return <LoadingState message="Carregando conteúdo..." />;
}

function ProjectDetails() {
  const updateTitle = usePageTitle({ title: "", backUrl: "/projetos" });
  const {
    activeTab,
    editData,
    editLoading,
    editOpen,
    error,
    graphRefreshToken,
    handleDeleteProject,
    handleEditProject,
    handleGraphNeedsRefresh,
    handleSaveEdit,
    loading,
    navigate,
    project,
    setActiveTab,
    setEditData,
    setEditOpen,
  } = useProjectDetailsPage();

  useEffect(() => {
    if (!project?.title) {
      return;
    }

    updateTitle({
      title: project.title,
      badge: (
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          <ProjectFrameworkBadge framework={project.framework} />
        </div>
      ),
    });
  }, [project, updateTitle]);

  if (loading) {
    return <LoadingState message="Carregando projeto..." fullPage />;
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <AlertTriangleIcon className="mb-3 h-12 w-12 text-[var(--syn-badge-high-text)]" />
        <h2 className="mb-1 text-lg font-semibold text-[var(--syn-text-primary)]">
          Erro ao carregar projeto
        </h2>
        <p className="mb-4 text-sm text-[var(--syn-text-secondary)]">{error}</p>
        <Button onClick={() => navigate("/projetos")} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para Projetos
        </Button>
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title="Projeto não encontrado"
        description="O projeto que você está procurando não existe ou foi removido."
        actionLabel="Voltar para Projetos"
        onAction={() => navigate("/projetos")}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ProjectDetailsHeader
        activeTab={activeTab}
        onDeleteProject={handleDeleteProject}
        onEditProject={handleEditProject}
        onTabChange={setActiveTab}
      />

      <div className="min-h-0 flex-1">
        <Suspense fallback={<ProjectTabLoader />}>
          {activeTab === "planejamento" && <ProjectPlanning project={project} />}
          {activeTab === "artigos" && (
            <ProjectArticles
              project={project}
              onNavigate={navigate}
              onGraphNeedsRefresh={handleGraphNeedsRefresh}
            />
          )}
          {activeTab === "grafo" && (
            <ArticleGraph
              projectId={project.id}
              graphRefreshToken={graphRefreshToken}
            />
          )}
        </Suspense>
      </div>

      <EditProjectPanel
        isOpen={editOpen}
        loading={editLoading}
        value={editData}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveEdit}
        onFieldChange={(field, value) =>
          setEditData((current) => ({ ...current, [field]: value }))
        }
      />
    </div>
  );
}

export default ProjectDetails;

