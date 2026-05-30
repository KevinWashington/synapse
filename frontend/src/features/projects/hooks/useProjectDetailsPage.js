import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { projectService } from "@features/projects/services/projectService";
import { toast } from "@/lib/toast";

const INITIAL_EDIT_DATA = {
  title: "",
  objetivo: "",
  status: "",
};
const PROJECT_DETAIL_TABS = new Set(["overview", "planejamento", "artigos", "fluxo", "grafo", "sintese"]);

function useProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTabState] = useState(() => {
    const requestedTab = searchParams.get("tab");
    return PROJECT_DETAIL_TABS.has(requestedTab) ? requestedTab : "overview";
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(INITIAL_EDIT_DATA);
  const [editLoading, setEditLoading] = useState(false);
  const [graphRefreshToken, setGraphRefreshToken] = useState(0);

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const projectData = await projectService.getProjectById(id);
      setProject(projectData);
    } catch (currentError) {
      setError(currentError.message || "Erro ao carregar projeto");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    const nextTab = PROJECT_DETAIL_TABS.has(requestedTab)
      ? requestedTab
      : "overview";

    setActiveTabState((current) => (current === nextTab ? current : nextTab));
  }, [searchParams]);

  const setActiveTab = useCallback(
    (nextTab) => {
      const resolvedTab = PROJECT_DETAIL_TABS.has(nextTab) ? nextTab : "overview";
      const defaultTab = "overview";

      setActiveTabState(resolvedTab);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);

        if (resolvedTab === defaultTab) {
          next.delete("tab");
        } else {
          next.set("tab", resolvedTab);
        }

        if (resolvedTab !== "fluxo") {
          next.delete("flow");
        }

        return next;
      });
    },
    [setSearchParams]
  );

  const handleEditProject = useCallback(() => {
    setEditData({
      title: project?.title || "",
      objetivo: project?.objetivo || "",
      status: project?.status || "ideia",
    });
    setEditOpen(true);
  }, [project]);

  const handleSaveEdit = useCallback(async () => {
    if (!project) {
      return;
    }

    try {
      setEditLoading(true);
      await projectService.updateProject(project.id, editData);
      setProject((current) => ({ ...current, ...editData }));
      setEditOpen(false);
      toast.success("Projeto atualizado com sucesso!");
    } catch (currentError) {
      toast.error("Erro ao atualizar: " + currentError.message);
    } finally {
      setEditLoading(false);
    }
  }, [editData, project]);

  const handleDeleteProject = useCallback(async () => {
    if (!project) {
      return;
    }

    if (!confirm(`Tem certeza que deseja deletar o projeto "${project.title}"?`)) {
      return;
    }

    try {
      await projectService.deleteProject(project.id);
      navigate("/projetos");
    } catch (currentError) {
      toast.error("Erro ao deletar projeto: " + currentError.message);
    }
  }, [navigate, project]);

  const handleGraphNeedsRefresh = useCallback(() => {
    setGraphRefreshToken((current) => current + 1);
  }, []);

  const handleProjectUpdated = useCallback((updatedProject) => {
    setProject(updatedProject);
  }, []);

  return {
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
  };
}

export default useProjectDetailsPage;
