import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AlertTriangleIcon, ArrowLeftIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { EmptyState, LoadingState } from "@/components/layout";
import {
  EditProjectPanel,
  ProjectDetailsHeader,
  ProjectOverview,
  useProjectDetailsPage,
} from "@/features/projects";
import { usePageTitle } from "@hooks/usePageTitle";
import { articleService } from "@features/articles/services/articleService";
import { useSearchParams } from "react-router-dom";
import { useProjectCollaboration } from "@features/collaboration/hooks/useProjectCollaboration";
import ProjectNotifications from "@features/collaboration/components/ProjectNotifications";

const ProjectTeam = lazy(
  () => import("@features/collaboration/components/ProjectTeam"),
);

const ProjectArticles = lazy(
  () => import("@features/articles/components/ProjectArticles"),
);
const ProjectPrismaFlow = lazy(
  () => import("@features/articles/components/ProjectPrismaFlow"),
);
const ProjectAnalytics = lazy(
  () => import("@features/projects/components/ProjectAnalytics"),
);
const ProjectPlanning = lazy(
  () => import("@features/projects/components/ProjectPlanning"),
);
const SynthesisReportPanel = lazy(
  () => import("@features/articles/components/SynthesisReportPanel"),
);

const PROJECT_TAB_LABELS = {
  overview: "Visão Geral",
  planejamento: "Planejamento",
  artigos: "Artigos",
  fluxo: "Fluxo",
  sintese: "Síntese",
  grafo: "Gráficos",
  equipe: "Equipe",
};

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
  const collaboration = useProjectCollaboration(project);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!project?.title) {
      return;
    }

    updateTitle({
      title: "",
      badge: null,
      breadcrumbs: [
        { label: "Projetos", href: "/projetos" },
        { label: project.title, href: `/projetos/${project.id}` },
        { label: PROJECT_TAB_LABELS[activeTab] || "Visão Geral" },
      ],
    });
  }, [activeTab, project?.id, project?.title, updateTitle]);

  const [synthesisData, setSynthesisData] = useState(null);
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [planningDirty, setPlanningDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const requestNavigation = (destination) => {
    if (activeTab === "planejamento" && planningDirty)
      setPendingNavigation(destination);
    else navigate(destination);
  };

  const requestTabChange = useCallback(
    (nextTab) => {
      if (nextTab === activeTab) {
        return;
      }

      if (activeTab === "planejamento" && planningDirty) {
        setPendingTab(nextTab);
        return;
      }

      setActiveTab(nextTab);
    },
    [activeTab, planningDirty, setActiveTab],
  );

  useEffect(() => {
    if (!planningDirty) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [planningDirty]);

  const loadSynthesis = useCallback(async () => {
    if (!project?.id) {
      return;
    }
    try {
      setSynthesisLoading(true);
      const report = await articleService.getProjectSynthesisReport(project.id);
      setSynthesisData(report);
    } catch (err) {
      console.error("Erro ao carregar sintese:", err);
    } finally {
      setSynthesisLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    if (activeTab === "sintese") {
      loadSynthesis();
    }
  }, [activeTab, loadSynthesis]);

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
    <div className="flex h-full min-w-0 flex-col">
      <ProjectDetailsHeader
        activeTab={activeTab}
        project={project}
        capabilities={collaboration.capabilities}
        notifications={
          <ProjectNotifications
            key={project.id}
            projectId={project.id}
            collaboration={collaboration}
            onNavigate={requestNavigation}
          />
        }
        onContinueScreening={() =>
          navigate(`/projetos/${project.id}?tab=artigos&flow=screening`)
        }
        onEditProject={handleEditProject}
        onTabChange={requestTabChange}
      />

      <div className="min-h-0 min-w-0 flex-1">
        <Suspense fallback={<ProjectTabLoader />}>
          {activeTab === "equipe" && (
            <ProjectTeam
              key={project.id}
              collaboration={collaboration}
              conflictId={searchParams.get("conflict")}
              onConflictClose={() =>
                setSearchParams(
                  (current) => {
                    const next = new URLSearchParams(current);
                    next.delete("conflict");
                    return next;
                  },
                  { replace: true },
                )
              }
            />
          )}
          {activeTab === "overview" && (
            <ProjectOverview
              project={project}
              onGoToScreening={() =>
                navigate(`/projetos/${project.id}?tab=artigos&flow=screening`)
              }
              onImportArticles={() =>
                navigate(
                  `/projetos/${project.id}?tab=artigos&flow=identification&action=import`,
                )
              }
              onOpenArticle={(articleId) =>
                navigate(`/projetos/${project.id}/artigos/${articleId}`)
              }
              onOpenPlanning={() => requestTabChange("planejamento")}
              onViewFlow={() => navigate(`/projetos/${project.id}?tab=fluxo`)}
            />
          )}
          {activeTab === "planejamento" && (
            <ProjectPlanning
              project={project}
              onDirtyChange={setPlanningDirty}
              onProjectUpdated={handleProjectUpdated}
            />
          )}
          {activeTab === "artigos" && (
            <ProjectArticles
              project={project}
              collaboration={collaboration}
              onNavigate={navigate}
              onGraphNeedsRefresh={handleGraphNeedsRefresh}
              onViewFlow={() => navigate(`/projetos/${project.id}?tab=fluxo`)}
            />
          )}
          {activeTab === "fluxo" && (
            <ProjectPrismaFlow
              project={project}
              onEditFlow={() =>
                navigate(
                  `/projetos/${project.id}?tab=artigos&flow=identification`,
                )
              }
            />
          )}
          {activeTab === "sintese" && (
            <SynthesisReportPanel
              data={synthesisData}
              isLoading={synthesisLoading}
              onRefresh={loadSynthesis}
              onOpenArticle={(articleId) =>
                navigate(
                  `/projetos/${project.id}/artigos/${articleId}?flow=included&workspace=extracao`,
                )
              }
            />
          )}
          {activeTab === "grafo" && (
            <ProjectAnalytics
              project={project}
              graphRefreshToken={graphRefreshToken}
              onGoToScreening={() =>
                navigate(`/projetos/${project.id}?tab=artigos&flow=screening`)
              }
              onOpenArticle={(articleId) =>
                navigate(
                  `/projetos/${project.id}/artigos/${articleId}?flow=included&workspace=extracao`,
                )
              }
            />
          )}
        </Suspense>
      </div>

      {collaboration.capabilities.includes("edit_project") && (
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
      )}

      <ConfirmationDialog
        open={Boolean(pendingTab || pendingNavigation)}
        title="Sair sem salvar?"
        description="As alterações feitas no planejamento serão perdidas se você mudar de aba agora."
        confirmLabel="Sair sem salvar"
        cancelLabel="Continuar editando"
        tone="destructive"
        onConfirm={() => {
          const nextTab = pendingTab;
          setPendingTab(null);
          const destination = pendingNavigation;
          setPendingNavigation(null);
          setPlanningDirty(false);
          if (nextTab) {
            setActiveTab(nextTab);
          }
          if (destination) navigate(destination);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTab(null);
            setPendingNavigation(null);
          }
        }}
      />
    </div>
  );
}

export default ProjectDetails;
