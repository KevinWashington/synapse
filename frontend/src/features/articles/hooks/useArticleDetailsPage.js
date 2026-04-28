import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { articleService } from "@features/articles/services/articleService";
import { projectService } from "@features/projects/services/projectService";
import { toast } from "@/lib/toast";

const WORKSPACE_TABS = new Set(["notas", "extracao", "chat"]);

function useArticleDetailsPage() {
  const { projectId, articleId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [article, setArticle] = useState(null);
  const [project, setProject] = useState(null);
  const [articleList, setArticleList] = useState([]);
  const [articleListLoading, setArticleListLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [rightTab, setRightTab] = useState(() => {
    const requestedTab = searchParams.get("workspace");
    const requestedFlow = searchParams.get("flow");
    if (requestedTab === "extracao" && requestedFlow !== "included") {
      return "notas";
    }
    return WORKSPACE_TABS.has(requestedTab) ? requestedTab : "notas";
  });
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);
  const returnFlow = searchParams.get("flow");
  const requestedWorkspace = searchParams.get("workspace");
  const backUrl = returnFlow
    ? `/projetos/${projectId}?tab=artigos&flow=${returnFlow}`
    : `/projetos/${projectId}?tab=artigos`;

  const listFlow = returnFlow || (requestedWorkspace === "extracao" ? "included" : null);

  const fetchArticle = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const articleData = await articleService.getArticleById(projectId, articleId);
      setArticle(articleData);
    } catch (currentError) {
      setError(currentError.message || "Erro ao carregar artigo");
    } finally {
      setLoading(false);
    }
  }, [articleId, projectId]);

  const fetchProject = useCallback(async () => {
    try {
      const projectData = await projectService.getProjectById(projectId);
      setProject(projectData);
    } catch (currentError) {
      console.error("Erro ao carregar contexto do projeto:", currentError);
    }
  }, [projectId]);

  const fetchArticleList = useCallback(async () => {
    if (!projectId || !listFlow) {
      setArticleList([]);
      return;
    }

    const filters = {
      limit: 1000,
    };

    if (listFlow === "included") {
      filters.outcome = "included";
    } else if (["identification", "screening", "eligibility"].includes(listFlow)) {
      filters.phase = listFlow;
    } else {
      setArticleList([]);
      return;
    }

    try {
      setArticleListLoading(true);
      const response = await articleService.getArticlesByProject(projectId, filters);
      setArticleList(response.articles || []);
    } catch (currentError) {
      console.error("Erro ao carregar lista do workspace:", currentError);
      setArticleList([]);
    } finally {
      setArticleListLoading(false);
    }
  }, [listFlow, projectId]);

  const fetchPdfData = useCallback(async () => {
    if (!article || article.hasPdf === false) {
      setPdfData(null);
      return;
    }
    try {
      const buffer = await articleService.getPdfData(projectId, articleId);
      setPdfData(buffer);
    } catch (currentError) {
      console.error("Erro ao obter PDF:", currentError);
    }
  }, [article, articleId, projectId]);

  useEffect(() => {
    fetchArticle();
    fetchProject();
  }, [fetchArticle, fetchProject]);

  useEffect(() => {
    fetchArticleList();
  }, [fetchArticleList]);

  useEffect(() => {
    fetchPdfData();
  }, [fetchPdfData]);

  useEffect(() => {
    const requestedTab = searchParams.get("workspace");
    if (requestedTab === "extracao" && returnFlow !== "included") {
      setRightTab("notas");
      return;
    }

    if (!WORKSPACE_TABS.has(requestedTab)) {
      return;
    }

    setRightTab(requestedTab);
  }, [returnFlow, searchParams]);

  useEffect(() => {
    const requestedTab = searchParams.get("workspace");
    if (requestedTab || !article) {
      return;
    }

    setRightTab((current) => {
      if (current !== "notas") {
        return current;
      }

      if (
        returnFlow === "included" &&
        (article.reviewOutcome === "included" || article.manualDecision === "incluido")
      ) {
        return "extracao";
      }

      if (article.currentPhase === "eligibility" && article.hasPdf) {
        return "chat";
      }

      return current;
    });
  }, [article, returnFlow, searchParams]);

  const refreshArticle = useCallback(async () => {
    await fetchArticle();
    await fetchPdfData();
  }, [fetchArticle, fetchPdfData]);

  const handleScreeningDecision = useCallback(
    async (payload) => {
      try {
        const updated = await articleService.submitScreeningDecision(projectId, articleId, payload);
        setArticle(updated);
        toast.success("Decisao de screening registrada.");
        return updated;
      } catch (currentError) {
        toast.error("Erro ao registrar screening: " + currentError.message);
        throw currentError;
      }
    },
    [articleId, projectId]
  );

  const handleEligibilityDecision = useCallback(
    async (payload) => {
      try {
        const updated = await articleService.submitEligibilityDecision(projectId, articleId, payload);
        setArticle(updated);
        toast.success("Decisao de elegibilidade registrada.");
        return updated;
      } catch (currentError) {
        toast.error("Erro ao registrar elegibilidade: " + currentError.message);
        throw currentError;
      }
    },
    [articleId, projectId]
  );

  const handleSaveNotes = useCallback(
    async (notes) => {
      try {
        const updated = await articleService.updateArticleNotes(projectId, articleId, notes);
        setArticle(updated);
        toast.success("Notas salvas com sucesso!");
      } catch (currentError) {
        toast.error("Erro ao salvar notas: " + currentError.message);
      }
    },
    [articleId, projectId]
  );

  const handleSaveEvidence = useCallback(
    async (payload) => {
      try {
        setIsSavingEvidence(true);
        const updated = await articleService.updateArticleEvidence(projectId, articleId, payload);
        setArticle(updated);
        setArticleList((current) =>
          current.map((item) => (String(item.id) === String(articleId) ? updated : item))
        );
        toast.success("Extracao e qualidade salvas com sucesso!");
        return updated;
      } catch (currentError) {
        toast.error("Erro ao salvar extracao: " + currentError.message);
        throw currentError;
      } finally {
        setIsSavingEvidence(false);
      }
    },
    [articleId, projectId]
  );

  const handleDeleteArticle = useCallback(async () => {
    if (!article) {
      return;
    }
    if (!confirm(`Tem certeza que deseja deletar o artigo "${article.title}"?`)) {
      return;
    }
    try {
      await articleService.deleteArticle(projectId, articleId);
      toast.success("Artigo deletado com sucesso!");
      navigate(backUrl);
    } catch (currentError) {
      toast.error("Erro ao deletar artigo: " + currentError.message);
    }
  }, [article, articleId, backUrl, navigate, projectId]);

  const handleAddNote = useCallback((note) => {
    setArticle((current) => ({
      ...current,
      notas: current?.notas ? `${current.notas}\n${note}` : note,
    }));
  }, []);

  return {
    article,
    articleList,
    articleListLoading,
    articleId,
    backUrl,
    error,
    handleAddNote,
    handleDeleteArticle,
    handleEligibilityDecision,
    handleSaveEvidence,
    handleSaveNotes,
    handleScreeningDecision,
    isSavingEvidence,
    loading,
    navigate,
    pdfData,
    project,
    projectId,
    refreshArticle,
    rightTab,
    setRightTab,
  };
}

export default useArticleDetailsPage;
