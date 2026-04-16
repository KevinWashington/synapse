import { useState, useEffect, useCallback } from "react";
import { articleService } from "@features/articles/services/articleService";
import { toast } from "@/lib/toast";

export const useProjectArticles = (project) => {
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [isLoadingFilterSummary, setIsLoadingFilterSummary] = useState(false);
  const [isBatchEvaluating, setIsBatchEvaluating] = useState(false);
  const [isLoadingRQSynthesis, setIsLoadingRQSynthesis] = useState(false);
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decisionArticle, setDecisionArticle] = useState(null);
  const [decisionInitialValue, setDecisionInitialValue] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [articles, setArticles] = useState([]);
  const [pagination, setPagination] = useState({});
  const [filterSummary, setFilterSummary] = useState(null);
  const [rqSynthesisData, setRqSynthesisData] = useState(null);

  const loadFilterSummary = useCallback(async () => {
    if (!project?.id) return;

    try {
      setIsLoadingFilterSummary(true);
      const response = await articleService.getProjectFilterSummary(project.id);
      setFilterSummary(response || null);
    } catch (error) {
      console.error("Erro ao carregar resumo de triagem:", error);
      setFilterSummary(null);
    } finally {
      setIsLoadingFilterSummary(false);
    }
  }, [project?.id]);

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

        const response = await articleService.getArticlesByProject(project.id, params);

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

  useEffect(() => {
    if (!project?.id) return;
    loadFilterSummary();
  }, [project?.id, loadFilterSummary]);

  const loadRQSynthesis = useCallback(async () => {
    if (!project?.id) {
      return;
    }

    try {
      setIsLoadingRQSynthesis(true);
      const response = await articleService.getProjectRQSynthesis(project.id);
      setRqSynthesisData(response || null);
    } catch (error) {
      console.error("Erro ao carregar síntese por RQ:", error);
      setRqSynthesisData(null);
      toast.error("Erro ao carregar síntese por RQ: " + error.message);
    } finally {
      setIsLoadingRQSynthesis(false);
    }
  }, [project?.id]);

  const refreshProjectData = useCallback(
    async ({ refreshFilter = true, refreshSynthesis = Boolean(rqSynthesisData) } = {}) => {
      await fetchArticles();
      if (refreshFilter) {
        await loadFilterSummary();
      }
      if (refreshSynthesis && rqSynthesisData) {
        await loadRQSynthesis();
      }
    },
    [fetchArticles, loadFilterSummary, loadRQSynthesis, rqSynthesisData]
  );

  const runBatchEvaluate = async (options = {}) => {
    if (!project?.id) return;

    try {
      setIsBatchEvaluating(true);
      const response = await articleService.batchEvaluateArticles(project.id, options);
      const summary = response?.summary || {};
      const evaluated = summary.evaluated || 0;
      const skippedAlreadyEvaluated = summary.skippedAlreadyEvaluated || 0;
      if (evaluated === 0 && skippedAlreadyEvaluated > 0) {
        toast.success(
          "Nenhum artigo novo para triagem: os pendentes já tinham score da IA."
        );
      } else {
        toast.success(
          `Triagem concluída: ${evaluated} avaliados, ${summary.suggestedIncluded || 0} sugeridos para inclusão e ${summary.suggestedExcluded || 0} para exclusão.`
        );
      }
      await refreshProjectData();
    } catch (error) {
      console.error("Erro na triagem em lote:", error);
      toast.error("Erro ao executar triagem em lote: " + error.message);
    } finally {
      setIsBatchEvaluating(false);
    }
  };

  const handleUpdateArticleStatus = async (article, newStatus) => {
    try {
      await articleService.updateArticleStatus(project.id, article.id, newStatus);
      await refreshProjectData();
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
      await refreshProjectData();
    } catch (error) {
      console.error("Erro ao deletar artigo:", error);
      toast.error("Erro ao deletar artigo: " + error.message);
    }
  };

  const openDecisionDialog = useCallback((article, initialDecision = null) => {
    setDecisionArticle(article);
    setDecisionInitialValue(initialDecision);
    setIsDecisionDialogOpen(true);
  }, []);

  const closeDecisionDialog = useCallback(() => {
    setIsDecisionDialogOpen(false);
    setDecisionArticle(null);
    setDecisionInitialValue(null);
  }, []);

  const submitDecision = useCallback(
    async (decisionPayload) => {
      if (!project?.id || !decisionArticle?.id) {
        throw new Error("Artigo inválido para decisão manual.");
      }

      try {
        setIsSavingDecision(true);
        await articleService.updateArticleDecision(
          project.id,
          decisionArticle.id,
          decisionPayload
        );

        await refreshProjectData();

        toast.success("Decisão de triagem registrada com sucesso!");
        closeDecisionDialog();
      } catch (error) {
        console.error("Erro ao registrar decisão manual:", error);
        throw error;
      } finally {
        setIsSavingDecision(false);
      }
    },
    [closeDecisionDialog, decisionArticle?.id, project?.id, refreshProjectData]
  );

  const handleNewArticleSuccess = useCallback(() => {
    void refreshProjectData();
  }, [refreshProjectData]);

  const handleImportSuccess = useCallback(() => {
    void refreshProjectData();
  }, [refreshProjectData]);

  const handleEditSuccess = useCallback(() => {
    void refreshProjectData();
  }, [refreshProjectData]);

  const handleUploadPdfSuccess = useCallback(() => {
    void refreshProjectData({ refreshFilter: false });
  }, [refreshProjectData]);

  const statusList = [
    { value: "todos", label: "Todos" },
    { value: "pendente", label: "Pendentes" },
    { value: "analisado", label: "Analisados" },
    { value: "excluido", label: "Excluídos" },
  ];

  return {
    isLoadingArticles,
    isLoadingFilterSummary,
    isBatchEvaluating,
    isLoadingRQSynthesis,
    isSavingDecision,
    isDecisionDialogOpen,
    decisionArticle,
    decisionInitialValue,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    articles,
    pagination,
    filterSummary,
    rqSynthesisData,
    fetchArticles,
    runBatchEvaluate,
    loadRQSynthesis,
    openDecisionDialog,
    closeDecisionDialog,
    submitDecision,
    handleUpdateArticleStatus,
    handleDeleteArticle,
    handleNewArticleSuccess,
    handleImportSuccess,
    handleEditSuccess,
    handleUploadPdfSuccess,
    statusList,
  };
};
