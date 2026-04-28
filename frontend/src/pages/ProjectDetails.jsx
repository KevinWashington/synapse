import { lazy, Suspense, useEffect } from "react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  FileTextIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/layout";
import {
  EditProjectPanel,
  ProjectDetailsHeader,
  ProjectOverview,
  useProjectDetailsPage,
} from "@/features/projects";
import { usePageTitle } from "@hooks/usePageTitle";

const ProjectArticles = lazy(() => import("@features/articles/components/ProjectArticles"));
const ProjectPrismaFlow = lazy(() => import("@features/articles/components/ProjectPrismaFlow"));
const ProjectAnalytics = lazy(() =>
  import("@features/projects/components/ProjectAnalytics")
);
const ProjectPlanning = lazy(() =>
  import("@features/projects/components/ProjectPlanning")
);

function ProjectTabLoader() {
  return <LoadingState message="Carregando conteúdo..." />;
}

function ProjectDetails() {
  const updateTitle = usePageTitle({ title: "" });
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
    handleProjectUpdated,
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
      title: "",
      badge: (
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => navigate("/projetos")}
            className="text-[#6259ff] hover:text-[#5148ee]"
          >
            Projetos
          </button>
          <span className="text-[#a4adc2]">/</span>
          <span className="truncate text-[#667391]">{project.title}</span>
        </div>
      ),
    });
  }, [navigate, project?.title, updateTitle]);

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
        project={project}
        onContinueScreening={() => navigate(`/projetos/${project.id}?tab=artigos&flow=screening`)}
        onDeleteProject={handleDeleteProject}
        onEditProject={handleEditProject}
        onTabChange={setActiveTab}
      />

      <div className="min-h-0 flex-1">
        <Suspense fallback={<ProjectTabLoader />}>
          {activeTab === "overview" && (
            <ProjectOverview
              project={project}
              onGoToScreening={() => navigate(`/projetos/${project.id}?tab=artigos&flow=screening`)}
              onImportArticles={() => navigate(`/projetos/${project.id}?tab=artigos&flow=identification&action=import`)}
              onOpenArticle={(articleId) => navigate(`/projetos/${project.id}/artigos/${articleId}`)}
              onOpenPlanning={() => setActiveTab("planejamento")}
              onViewFlow={() => navigate(`/projetos/${project.id}?tab=fluxo`)}
            />
          )}
          {activeTab === "planejamento" && (
            <ProjectPlanning project={project} onProjectUpdated={handleProjectUpdated} />
          )}
          {activeTab === "artigos" && (
            <ProjectArticles
              project={project}
              onNavigate={navigate}
              onGraphNeedsRefresh={handleGraphNeedsRefresh}
              onViewFlow={() => navigate(`/projetos/${project.id}?tab=fluxo`)}
            />
          )}
          {activeTab === "fluxo" && (
            <ProjectPrismaFlow
              project={project}
              onEditFlow={() => navigate(`/projetos/${project.id}?tab=artigos&flow=identification`)}
            />
          )}
          {activeTab === "grafo" && (
            <ProjectAnalytics
              project={project}
              graphRefreshToken={graphRefreshToken}
              onGoToScreening={() => navigate(`/projetos/${project.id}?tab=artigos&flow=screening`)}
              onOpenArticle={(articleId) => navigate(`/projetos/${project.id}/artigos/${articleId}?flow=included&workspace=extracao`)}
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

