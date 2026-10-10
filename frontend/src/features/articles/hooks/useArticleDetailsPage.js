import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { articleService } from "@features/articles/services/articleService";
import { projectService } from "@features/projects/services/projectService";
import { collaborationService } from "@features/collaboration/services/collaborationService";
import { toast } from "@/lib/toast";

const WORKSPACE_TABS = new Set(["notas", "extracao", "chat"]);

function useArticleDetailsPage() {
  const { projectId, articleId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [article, setArticle] = useState(null);
  const articleRequestRef = useRef(0);
  const [project, setProject] = useState(null);
  const [articleList, setArticleList] = useState([]);
  const [articleListTotal, setArticleListTotal] = useState(0);
  const [selectionSummary, setSelectionSummary] = useState(null);
  const [myAssignments, setMyAssignments] = useState([]);
  const [articleListLoading, setArticleListLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfResource, setPdfResource] = useState(null);
  const pdfRequestRef = useRef(0);
  const pdfKey = `${projectId}:${articleId}`;
  const pdfData = pdfResource?.key === pdfKey ? pdfResource.data : null;
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

  const fetchArticle = useCallback(async (showLoading = true) => {
    const request = ++articleRequestRef.current;
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const articleData = await articleService.getArticleById(projectId, articleId);
      if (request !== articleRequestRef.current) return;
      setArticle(articleData);
      return articleData;
    } catch (currentError) {
      if (request === articleRequestRef.current) setError(currentError.message || "Erro ao carregar artigo");
    } finally {
      if (request === articleRequestRef.current) setLoading(false);
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
      setArticleListTotal(0);
      setSelectionSummary(null);
      return;
    }

    const filters = {
      limit: 1000,
    };

    if (listFlow === "included") {
      filters.outcome = "included";
    } else if (["identification", "screening", "eligibility"].includes(listFlow)) {
      filters.phase = listFlow;
      if (listFlow === "screening" || listFlow === "eligibility") {
        filters.outcome = "active";
      }
    } else {
      setArticleList([]);
      return;
    }

    try {
      setArticleListLoading(true);
      const [response, summary] = await Promise.all([
        articleService.getArticlesByProject(projectId, filters),
        articleService.getSelectionSummary(projectId),
      ]);
      setArticleList(response.articles || []);
      setArticleListTotal(response.total || 0);
      setSelectionSummary(summary || null);
    } catch (currentError) {
      console.error("Erro ao carregar lista do workspace:", currentError);
      setArticleList([]);
      setArticleListTotal(0);
      setSelectionSummary(null);
    } finally {
      setArticleListLoading(false);
    }
  }, [listFlow, projectId]);

  const fetchPdfData = useCallback(async () => {
    const request = ++pdfRequestRef.current;
    if (!article || String(article.id) !== String(articleId) || article.hasPdf === false) {
      setPdfResource(null);
      return;
    }
    try {
      const buffer = await articleService.getPdfData(projectId, articleId);
      if (request === pdfRequestRef.current) setPdfResource({ key: `${projectId}:${articleId}`, data: buffer });
    } catch (currentError) {
      console.error("Erro ao obter PDF:", currentError);
    }
  }, [article, articleId, projectId]);

  useEffect(() => {
    fetchArticle();
    fetchProject();
    return () => { articleRequestRef.current += 1; };
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

  const refreshAfterDecision = useCallback(async (updated) => {
    setArticle(updated);
    if (!article?.hasActiveReviewAssignments && !updated.hasActiveReviewAssignments) return updated;
    const [reloaded, assignments] = await Promise.all([
      fetchArticle(false),
      collaborationService.getMyAssignments(projectId),
      fetchArticleList(),
    ]);
    setMyAssignments(assignments || []);
    return reloaded || updated;
  }, [article?.hasActiveReviewAssignments, fetchArticle, fetchArticleList, projectId]);

  const handleScreeningDecision = useCallback(
    async (payload) => {
      try {
        const updated = await articleService.submitScreeningDecision(projectId, articleId, payload);
        const reloaded = await refreshAfterDecision(updated);
        toast.success("Decisão de triagem registrada.");
        return reloaded;
      } catch (currentError) {
        toast.error("Erro ao registrar screening: " + currentError.message);
        throw currentError;
      }
    },
    [articleId, projectId, refreshAfterDecision]
  );

  const handleEligibilityDecision = useCallback(
    async (payload) => {
      try {
        const updated = await articleService.submitEligibilityDecision(projectId, articleId, payload);
        const reloaded = await refreshAfterDecision(updated);
        toast.success("Decisão de elegibilidade registrada.");
        return reloaded;
      } catch (currentError) {
        toast.error("Erro ao registrar elegibilidade: " + currentError.message);
        throw currentError;
      }
    },
    [articleId, projectId, refreshAfterDecision]
  );

  const handleSaveNotes = useCallback(
    async (notes) => {
      try {
        const updated = await articleService.updateArticleNotes(projectId, articleId, notes);
        setArticle((current) => String(current?.id) === String(updated.id) ? updated : current);
        return updated;
      } catch (currentError) {
        toast.error("Erro ao salvar notas: " + currentError.message);
        throw currentError;
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
        try {
          const summary = await articleService.getSelectionSummary(projectId);
          setSelectionSummary(summary || null);
        } catch (summaryError) {
          console.error("Erro ao atualizar progresso da extracao:", summaryError);
        }
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
    try {
      await articleService.deleteArticle(projectId, articleId);
      toast.success("Artigo deletado com sucesso!");
      navigate(backUrl);
    } catch (currentError) {
      toast.error("Erro ao deletar artigo: " + currentError.message);
    }
  }, [article, articleId, backUrl, navigate, projectId]);

  return {
    article,
    articleList,
    articleListTotal,
    articleListLoading,
    articleId,
    backUrl,
    error,
    handleDeleteArticle,
    handleEligibilityDecision,
    handleSaveEvidence,
    handleSaveNotes,
    handleScreeningDecision,
    isSavingEvidence,
    loading: loading || Boolean(!error && article && String(article.id) !== String(articleId)),
    myAssignments,
    navigate,
    pdfData,
    project,
    projectId,
    refreshArticle,
    rightTab,
    selectionSummary,
    setRightTab,
  };
}

export default useArticleDetailsPage;
