import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { articleService } from "@features/articles/services/articleService";
import { projectService } from "@features/projects/public/services";
import { collaborationService } from "@features/collaboration/public/services";
import { useRemoteResource } from "@/hooks/useRemoteResource";
import { toast } from "@/lib/toast";

const WORKSPACE_TABS = new Set(["notas", "extracao", "chat"]);

function useArticleDetailsPage() {
  const { projectId, articleId } = useParams();
  const routerNavigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignedToMe = searchParams.get("assignedToMe") === "1";
  const navigate = useCallback((target, options) => {
    if (assignedToMe && typeof target === "string" && target.startsWith(`/projetos/${projectId}/artigos/`)) {
      const [path, query] = target.split("?");
      const params = new URLSearchParams(query);
      params.set("assignedToMe", "1");
      routerNavigate(`${path}?${params}`, options);
    } else routerNavigate(target, options);
  }, [assignedToMe, projectId, routerNavigate]);
  const [assignmentResource, setAssignmentResource] = useState(null);
  const myAssignments = assignmentResource?.projectId === projectId ? assignmentResource.data : [];
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);
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
  const returnFlow = searchParams.get("flow");
  const requestedWorkspace = searchParams.get("workspace");
  const backUrl = returnFlow
    ? `/projetos/${projectId}?tab=artigos&flow=${returnFlow}`
    : `/projetos/${projectId}?tab=artigos`;

  const listFlow = returnFlow || (requestedWorkspace === "extracao" ? "included" : null);

  const loadArticle = useCallback(() => articleService.getArticleById(projectId, articleId), [projectId, articleId]);
  const articleResource = useRemoteResource({ key: `${projectId}:${articleId}`, enabled: Boolean(projectId && articleId), load: loadArticle });
  const { data: remoteArticle, setData: setArticle, reload: fetchArticle, loading, error: articleError } = articleResource;
  const error = articleError?.message || null;
  const loadProject = useCallback(() => projectService.getProjectById(projectId), [projectId]);
  const projectResource = useRemoteResource({ key: projectId, enabled: Boolean(projectId), load: loadProject });
  const project = projectResource.data;
  const loadList = useCallback(async () => {
    const filters = { limit: 1000 };
    if (assignedToMe) filters.assignedToMe = true;
    if (listFlow === "included") filters.outcome = "included";
    else { filters.phase = listFlow; if (["screening", "eligibility"].includes(listFlow)) filters.outcome = "active"; }
    const [response, summary] = await Promise.all([
      articleService.getArticlesByProject(projectId, filters), articleService.getSelectionSummary(projectId),
    ]);
    return { articles: response.articles || [], total: response.total || 0, summary };
  }, [assignedToMe, listFlow, projectId]);
  const queueResource = useRemoteResource({ key: `${projectId}:${listFlow}:${assignedToMe}`, enabled: Boolean(projectId && ["included", "identification", "screening", "eligibility"].includes(listFlow)), load: loadList });
  const articleList = queueResource.data?.articles || [];
  const article = remoteArticle || articleList.find((item) => String(item.id) === String(articleId)) || null;
  const articleListTotal = queueResource.data?.total || 0;
  const selectionSummary = queueResource.data?.summary || null;
  const articleListLoading = queueResource.loading;
  const fetchArticleList = queueResource.reload;
  const setQueueData = queueResource.setData;
  const setArticleList = useCallback((update) => setQueueData((current) => ({ ...current, articles: update(current?.articles || []) })), [setQueueData]);
  const setSelectionSummary = useCallback((summary) => setQueueData((current) => ({ ...current, summary })), [setQueueData]);

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
    fetchPdfData();
    return () => { pdfRequestRef.current += 1; };
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
    if (!article?.hasActiveReviewAssignments && !updated.hasActiveReviewAssignments) { await fetchArticleList(); return updated; }
    const [reloaded, assignments] = await Promise.all([
      fetchArticle(false),
      collaborationService.getMyAssignments(projectId),
      fetchArticleList(),
    ]);
    setAssignmentResource({ projectId, data: assignments || [] });
    return reloaded || updated;
  }, [article?.hasActiveReviewAssignments, fetchArticle, fetchArticleList, projectId, setArticle]);

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
    [articleId, projectId, setArticle]
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
    [articleId, projectId, setArticle, setArticleList, setSelectionSummary]
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
    assignedToMe,
    article,
    articleList,
    articleListTotal,
    articleListLoading,
    articleId,
    articlePending: !remoteArticle && (loading || Boolean(error)),
    backUrl,
    error,
    projectError: projectResource.error,
    articleListError: queueResource.error,
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
