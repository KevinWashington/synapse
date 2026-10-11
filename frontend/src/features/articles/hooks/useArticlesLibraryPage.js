import { useCallback, useEffect, useRef, useState } from "react";
import { projectService } from "@features/projects/public/services";
import { articleService } from "@features/articles/services/articleService";

const ARTICLE_PAGE_SIZE = 20;

function useArticlesLibraryPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [articles, setArticles] = useState([]);
  const [articlePage, setArticlePage] = useState(1);
  const [articleTotal, setArticleTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const latestArticleRequest = useRef(0);

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
    const requestId = ++latestArticleRequest.current;

    if (!selectedProjectId || selectedProjectId === "all") {
      setArticles([]);
      setArticleTotal(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = { page: articlePage, limit: ARTICLE_PAGE_SIZE };
      if (filterStatus !== "todos") {
        params.status = filterStatus;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await articleService.getArticlesByProject(selectedProjectId, params);
      if (requestId !== latestArticleRequest.current) {
        return;
      }
      setArticles(response.articles || []);
      setArticleTotal(response.total || 0);
    } catch (error) {
      if (requestId !== latestArticleRequest.current) {
        return;
      }
      console.error("Error loading articles:", error);
      setArticles([]);
      setArticleTotal(0);
    } finally {
      if (requestId === latestArticleRequest.current) {
        setLoading(false);
      }
    }
  }, [articlePage, filterStatus, searchTerm, selectedProjectId]);

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

  const changeProject = useCallback((projectId) => {
    setArticlePage(1);
    setSelectedProjectId(projectId);
  }, []);

  const changeStatus = useCallback((status) => {
    setArticlePage(1);
    setFilterStatus(status);
  }, []);

  const changeSearch = useCallback((value) => {
    setArticlePage(1);
    setSearchTerm(value);
  }, []);

  return {
    articlePage,
    articlePageSize: ARTICLE_PAGE_SIZE,
    articleTotal,
    articles,
    filterStatus,
    loading,
    openDetail,
    panelOpen,
    projects,
    searchTerm,
    selectedArticle,
    selectedProjectId,
    setArticlePage,
    setFilterStatus: changeStatus,
    setPanelOpen,
    setSearchTerm: changeSearch,
    setSelectedProjectId: changeProject,
  };
}

export default useArticlesLibraryPage;
