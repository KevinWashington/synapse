import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectService } from "@features/projects/services/projectService";
import { toast } from "@/lib/toast";

const INITIAL_EDIT_DATA = {
  title: "",
  objetivo: "",
  status: "",
};

function useProjectsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [editData, setEditData] = useState(INITIAL_EDIT_DATA);
  const [editLoading, setEditLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page: 1, limit: 50 };
      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }

      const response = await projectService.getAllProjects(params);
      setProjects(response.projects || []);
    } catch (currentError) {
      console.error("Erro ao carregar projetos:", currentError);
      setError(currentError.message || "Erro ao carregar projetos");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleDeleteProject = useCallback(
    async (project) => {
      if (!confirm(`Tem certeza que deseja deletar o projeto "${project.title}"?`)) {
        return;
      }

      try {
        await projectService.deleteProject(project.id);
        toast.success("Projeto deletado com sucesso!");
        await loadProjects();
      } catch (currentError) {
        console.error("Erro ao deletar projeto:", currentError);
        toast.error("Erro ao deletar projeto");
      }
    },
    [loadProjects]
  );

  const handleProjectClick = useCallback((project) => {
    setSelectedProject(project);
    setDetailOpen(true);
  }, []);

  const handleExpandProject = useCallback(() => {
    if (selectedProject?.id) {
      navigate(`/projetos/${selectedProject.id}`);
    }
  }, [navigate, selectedProject?.id]);

  const handleEditProject = useCallback((project) => {
    setEditProject(project);
    setEditData({
      title: project.title || "",
      objetivo: project.objetivo || "",
      status: project.status || "ideia",
    });
    setEditOpen(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editProject) {
      return;
    }

    try {
      setEditLoading(true);
      await projectService.updateProject(editProject.id, editData);
      toast.success("Projeto atualizado com sucesso!");
      setEditOpen(false);
      await loadProjects();
    } catch (currentError) {
      toast.error("Erro ao atualizar: " + currentError.message);
    } finally {
      setEditLoading(false);
    }
  }, [editData, editProject, loadProjects]);

  return {
    detailOpen,
    editData,
    editLoading,
    editOpen,
    error,
    handleDeleteProject,
    handleEditProject,
    handleExpandProject,
    handleProjectClick,
    handleSaveEdit,
    loadProjects,
    loading,
    projects,
    searchTerm,
    selectedProject,
    setDetailOpen,
    setEditData,
    setEditOpen,
    setSearchTerm,
    setShowNewProjectModal,
    showNewProjectModal,
  };
}

export default useProjectsPage;
