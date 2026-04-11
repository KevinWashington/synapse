import { useState, useEffect, useCallback } from "react";
import { articleService } from "@features/articles/services/articleService";
import { toast } from "@/lib/toast";

export const useProjectArticles = (project) => {
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [articles, setArticles] = useState([]);
  const [pagination, setPagination] = useState({});

  const fetchArticles = useCallback(
    async (filters = {}) => {
      if (!project?.id) return;

      try {
        setIsLoadingArticles(true);

        const params = {
          page: 1,
          limit: 50,
          ...filters,
        };

        if (searchTerm) params.search = searchTerm;
        if (filterStatus !== "todos") params.status = filterStatus;

        const response = await articleService.getArticlesByProject(
          project.id,
          params
        );

        setArticles(response.articles || []);
        setPagination({
          totalDocuments: response.total || 0,
          page: response.page || 1,
          limit: response.limit || 50,
        });
      } catch (error) {
        console.error("Erro ao carregar artigos:", error);
      } finally {
        setIsLoadingArticles(false);
      }
    },
    [project?.id, searchTerm, filterStatus]
  );

  useEffect(() => {
    if (!project?.id) return;

    const shouldDebounce = searchTerm || filterStatus !== "todos";
    const timeoutId = setTimeout(() => {
      fetchArticles();
    }, shouldDebounce ? 500 : 0);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, filterStatus, project?.id, fetchArticles]);

  const handleUpdateArticleStatus = async (article, newStatus) => {
    try {
      await articleService.updateArticleStatus(project.id, article.id, newStatus);
      fetchArticles();
      toast.success(`Status do artigo atualizado para ${newStatus}`);
    } catch (error) {
      console.error("Erro ao atualizar status do artigo:", error);
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const handleDeleteArticle = async (article) => {
    if (!confirm(`Tem certeza que deseja deletar o artigo "${article.title}"?`)) {
      return;
    }

    try {
      await articleService.deleteArticle(project.id, article.id);
      toast.success("Artigo deletado com sucesso!");
      fetchArticles();
    } catch (error) {
      console.error("Erro ao deletar artigo:", error);
      toast.error("Erro ao deletar artigo: " + error.message);
    }
  };

  const handleNewArticleSuccess = () => {
    fetchArticles();
  };

  const handleImportSuccess = () => {
    fetchArticles();
  };

  const handleEditSuccess = () => {
    fetchArticles();
  };

  const handleUploadPdfSuccess = () => {
    fetchArticles();
  };

  const statusList = [
    { value: "todos", label: "Todos" },
    { value: "pendente", label: "Pendentes" },
    { value: "analisado", label: "Analisados" },
    { value: "excluido", label: "Excluídos" },
  ];

  return {
    isLoadingArticles,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    articles,
    pagination,
    fetchArticles,
    handleUpdateArticleStatus,
    handleDeleteArticle,
    handleNewArticleSuccess,
    handleImportSuccess,
    handleEditSuccess,
    handleUploadPdfSuccess,
    statusList,
  };
};
