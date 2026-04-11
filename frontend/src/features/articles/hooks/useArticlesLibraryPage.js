import { useCallback, useEffect, useState } from "react";
import { projectService } from "@features/projects/services/projectService";
import { articleService } from "@features/articles/services/articleService";

function useArticlesLibraryPage() {
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
      setSelectedProjectId((current) =>
        current === "all" && response.projects?.length > 0
          ? response.projects[0].id.toString()
          : current
      );
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  }, []);

  const loadArticles = useCallback(async () => {
    if (!selectedProjectId || selectedProjectId === "all") {
      setArticles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = {};
      if (filterStatus !== "todos") {
        params.status = filterStatus;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await articleService.getArticlesByProject(selectedProjectId, params);
      setArticles(response.articles || []);
    } catch (error) {
      console.error("Error loading articles:", error);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchTerm, selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const openDetail = useCallback((article) => {
    setSelectedArticle(article);
    setPanelOpen(true);
  }, []);

  return {
    articles,
    filterStatus,
    loading,
    openDetail,
    panelOpen,
    projects,
    searchTerm,
    selectedArticle,
    selectedProjectId,
    setFilterStatus,
    setPanelOpen,
    setSearchTerm,
    setSelectedProjectId,
  };
}

export default useArticlesLibraryPage;
