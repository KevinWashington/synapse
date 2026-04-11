import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projectService } from "@features/projects/services/projectService";
import { toast } from "@/lib/toast";

const INITIAL_EDIT_DATA = {
  title: "",
  objetivo: "",
  status: "",
};

function useProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("planejamento");
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
