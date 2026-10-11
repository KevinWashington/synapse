import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { articleService } from "@features/articles/services/articleService";
import { toggleVisibleSelection } from "@features/articles/utils/reviewFlow";
import { useRemoteResource } from "@/hooks/useRemoteResource";
import { toast } from "@/lib/toast";

const PHASE_FILTERS = {
  identification: { phase: "identification", outcome: "active" },
  screening: { phase: "screening", outcome: "active" },
  eligibility: { phase: "eligibility", outcome: "active" },
  included: { outcome: "included" },
};
const FLOW_TABS = new Set(["identification", "screening", "eligibility", "included"]);
const ARTICLE_PAGE_SIZE = 20;

export const useProjectArticles = (project, onGraphNeedsRefresh, collaboration) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFlowTab, setActiveFlowTabState] = useState(() => {
    const requestedFlow = searchParams.get("flow");
    return FLOW_TABS.has(requestedFlow) ? requestedFlow : "identification";
  });
  const [articlePage, setArticlePage] = useState(1);
  const [assignedToMe, setAssignedToMeState] = useState(false);
  const [searchTermsByFlow, setSearchTermsByFlow] = useState({});
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const [isBatchEvaluating, setIsBatchEvaluating] = useState(false);
  const [isPromotingUnique, setIsPromotingUnique] = useState(false);
  const [selectedIdentificationIds, setSelectedIdentificationIds] = useState([]);
  const [selectedDuplicateMap, setSelectedDuplicateMap] = useState({});
  useEffect(() => {
    setSelectedIdentificationIds([]);
    setSelectedDuplicateMap({});
    setArticlePage(1);
  }, [project?.id]);
  const searchTerm = searchTermsByFlow[activeFlowTab] || "";
  const articleContext = useRef(null);
  articleContext.current = {
    activeFlowTab,
    articlePage,
    assignedToMe,
    searchTermsByFlow,
  };

  useEffect(() => {
    const requestedFlow = searchParams.get("flow");
    const nextFlow = FLOW_TABS.has(requestedFlow) ? requestedFlow : "identification";

    if (activeFlowTab !== nextFlow) {
      setActiveFlowTabState(nextFlow);
      setAssignedToMeState(false);
      setArticlePage(1);
    }
  }, [activeFlowTab, searchParams]);

  const setActiveFlowTab = useCallback(
    (nextFlowTab) => {
      const resolvedFlowTab = FLOW_TABS.has(nextFlowTab) ? nextFlowTab : "identification";

      setActiveFlowTabState(resolvedFlowTab);
      setArticlePage(1);
      setAssignedToMeState(false);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);

        next.set("tab", "artigos");
        next.set("flow", resolvedFlowTab);

        return next;
      });
    },
    [setSearchParams]
  );

  const setSearchTerm = useCallback(
    (value) => {
      setArticlePage(1);
      setSearchTermsByFlow((current) => ({
        ...current,
        [activeFlowTab]: value,
      }));
    },
    [activeFlowTab]
  );

  const setAssignedToMe = useCallback((value) => {
    setAssignedToMeState(value);
    setArticlePage(1);
  }, []);

  const fetchSummary = useCallback(() => articleService.getSelectionSummary(project.id), [project?.id]);
  const summaryResource = useRemoteResource({ key: project?.id, enabled: Boolean(project?.id), load: fetchSummary });
  const { data: summary, loading: isLoadingSummary, reload: loadSummary } = summaryResource;
  const fetchReport = useCallback(() => articleService.getSelectionReport(project.id), [project?.id]);
  const reportResource = useRemoteResource({ key: project?.id, enabled: Boolean(project?.id), load: fetchReport });
  const { data: report, loading: isLoadingReport, reload: loadReport } = reportResource;
  const fetchDuplicates = useCallback(() => articleService.getDuplicateCandidates(project.id), [project?.id]);
  const duplicatesResource = useRemoteResource({ key: project?.id, enabled: Boolean(project?.id), load: fetchDuplicates });
  const duplicateCandidates = useMemo(() => duplicatesResource.data || [], [duplicatesResource.data]);
  const loadDuplicateCandidates = duplicatesResource.reload;
  const setDuplicateCandidates = duplicatesResource.setData;
  useEffect(() => {
    setSelectedDuplicateMap((current) => Object.fromEntries((duplicatesResource.data || []).map((group) => [group.groupKey, current[group.groupKey] || group.candidateIds?.[0] || null])));
  }, [duplicatesResource.data]);
  const fetchArticles = useCallback(async (flowOverride, pageOverride) => {
    const context = articleContext.current;
    const flow = FLOW_TABS.has(flowOverride) ? flowOverride : context.activeFlowTab;
    const page = pageOverride ?? context.articlePage;
    const response = await articleService.getArticlesByProject(project.id, {
      ...PHASE_FILTERS[flow], search: context.searchTermsByFlow[flow] || undefined,
      page, limit: ARTICLE_PAGE_SIZE,
      ...(context.assignedToMe && ["screening", "eligibility"].includes(flow) ? { assignedToMe: true } : {}),
    });
    return response;
  }, [project?.id]);
  const articlesResource = useRemoteResource({ key: JSON.stringify([project?.id, activeFlowTab, articlePage, assignedToMe, searchTerm]), enabled: Boolean(project?.id), load: fetchArticles });
  const articles = useMemo(() => articlesResource.data?.articles || [], [articlesResource.data]);
  const articleTotal = articlesResource.data?.total || 0;
  const isLoadingArticles = articlesResource.loading;
  const loadArticles = articlesResource.reload;
  useEffect(() => {
    const response = articlesResource.data;
    if (!response) return;
    const lastPage = Math.max(1, Math.ceil((response.total || 0) / ARTICLE_PAGE_SIZE));
    if (response.total > 0 && !response.articles?.length && articlePage > lastPage) setArticlePage(lastPage);
    if (activeFlowTab !== "identification") setSelectedIdentificationIds([]);
  }, [activeFlowTab, articlePage, articlesResource.data]);

  const refreshAll = useCallback(
    async ({ targetFlowTab } = {}) => {
      const context = articleContext.current;
      const flowToLoad = targetFlowTab || context.activeFlowTab;
      const pageToLoad = targetFlowTab ? 1 : context.articlePage;

      if (targetFlowTab) {
        setActiveFlowTab(targetFlowTab);
      }

      await Promise.all([
        loadSummary(),
        loadReport(),
        loadDuplicateCandidates(),
        loadArticles(flowToLoad, pageToLoad),
      ]);
    },
    [
      loadArticles,
      loadDuplicateCandidates,
      loadReport,
      loadSummary,
      setActiveFlowTab,
    ]
  );

  const identificationArticles = useMemo(
    () => articles.filter((article) => article.currentPhase === "identification"),
    [articles]
  );

  const toggleIdentificationSelection = useCallback((articleId) => {
    setSelectedIdentificationIds((current) =>
      current.includes(articleId)
        ? current.filter((value) => value !== articleId)
        : [...current, articleId]
    );
  }, []);

  const toggleAllIdentificationSelection = useCallback((articleIds) => {
    setSelectedIdentificationIds((current) => toggleVisibleSelection(current, articleIds));
  }, []);

  const changeArticlePage = useCallback((nextPage) => {
    setArticlePage(Math.max(1, nextPage));
    setSelectedIdentificationIds([]);
  }, []);

  const runDedupAnalysis = useCallback(async () => {
    if (!project?.id) {
      return;
    }
    try {
      setIsLoadingDuplicates(true);
      const response = await articleService.analyzeDuplicates(project.id);
      setDuplicateCandidates(response.candidates || []);
      toast.success(`${response.candidateCount || 0} grupo(s) de duplicata detectado(s).`);
      await refreshAll();
    } catch (error) {
      toast.error("Erro ao analisar duplicatas: " + error.message);
    } finally {
      setIsLoadingDuplicates(false);
    }
  }, [project?.id, refreshAll, setDuplicateCandidates]);

  const applyDuplicateReview = useCallback(async () => {
    if (!project?.id || duplicateCandidates.length === 0) {
      return;
    }
    try {
      setIsLoadingDuplicates(true);
      const decisions = duplicateCandidates
        .map((group) => {
          const canonicalArticleId = selectedDuplicateMap[group.groupKey];
          if (!canonicalArticleId) {
            return null;
          }
          return {
            groupKey: group.groupKey,
            canonicalArticleId,
            duplicateArticleIds: group.candidateIds.filter((id) => id !== canonicalArticleId),
            reasonCode: group.reasonCode,
            reasonText: group.reasonText,
          };
        })
        .filter(Boolean);

      if (!decisions.length) {
        toast.warning("Selecione pelo menos um artigo canônico para aplicar a deduplicacao.");
        return;
      }

      const response = await articleService.applyDuplicateDecisions(project.id, decisions);
      toast.success(`${response.removedDuplicates || 0} duplicata(s) consolidadas.`);
      await refreshAll();
    } catch (error) {
      toast.error("Erro ao aplicar revisao de duplicatas: " + error.message);
    } finally {
      setIsLoadingDuplicates(false);
    }
  }, [duplicateCandidates, project?.id, refreshAll, selectedDuplicateMap]);

  const promoteSelectedToScreening = useCallback(async () => {
    if (!project?.id || !selectedIdentificationIds.length) {
      toast.warning("Selecione registros de identificacao para enviar para triagem.");
      return;
    }

    try {
      const response = await articleService.promoteToScreening(project.id, selectedIdentificationIds);
      toast.success(`${response.movedCount || 0} registro(s) enviados para triagem.`);
      setSelectedIdentificationIds([]);
      await refreshAll({ targetFlowTab: "screening" });
    } catch (error) {
      toast.error("Erro ao enviar registros para triagem: " + error.message);
    }
  }, [project?.id, refreshAll, selectedIdentificationIds]);

  const promoteAllUniqueToScreening = useCallback(async () => {
    if (!project?.id) {
      return;
    }

    try {
      setIsPromotingUnique(true);
      const response = await articleService.promoteAllUniqueToScreening(project.id);
      const movedCount = response.movedCount || 0;
      const unresolvedRecords = response.unresolvedDuplicateRecords || 0;
      const unresolvedGroups = response.unresolvedDuplicateGroups || 0;
      if (unresolvedRecords) {
        toast.success(
          `${movedCount} registro(s) único(s) enviados. ${unresolvedRecords} registro(s) em ${unresolvedGroups} grupo(s) ficaram para revisão.`
        );
      } else {
        toast.success(`${movedCount} registro(s) único(s) enviados para triagem.`);
      }
      setSelectedIdentificationIds([]);
      setArticlePage(1);
      await refreshAll({ targetFlowTab: "identification" });
    } catch (error) {
      if (error?.status === 0) {
        toast.error(
          "Servidor indisponível. Verifique se o backend está em execução e tente novamente."
        );
      } else {
        toast.error("Erro ao enviar registros únicos para triagem: " + error.message);
      }
    } finally {
      setIsPromotingUnique(false);
    }
  }, [project?.id, refreshAll]);

  const submitScreeningDecision = useCallback(
    async (articleId, payload) => {
      if (!project?.id || !articleId) {
        return false;
      }
      try {
        setIsSavingDecision(true);
        await articleService.submitScreeningDecision(project.id, articleId, payload);
        toast.success("Decisão de triagem registrada.");
        await refreshAll();
        await collaboration?.refreshAssignments?.();
        return true;
      } catch (error) {
        toast.error("Erro ao salvar triagem: " + error.message);
        throw error;
      } finally {
        setIsSavingDecision(false);
      }
    },
    [collaboration, project?.id, refreshAll]
  );

  const submitEligibilityDecision = useCallback(
    async (articleId, payload) => {
      if (!project?.id || !articleId) {
        return false;
      }
      try {
        setIsSavingDecision(true);
        await articleService.submitEligibilityDecision(project.id, articleId, payload);
        toast.success("Decisão de elegibilidade registrada.");
        onGraphNeedsRefresh?.();
        await refreshAll();
        await collaboration?.refreshAssignments?.();
        return true;
      } catch (error) {
        toast.error("Erro ao salvar elegibilidade: " + error.message);
        throw error;
      } finally {
        setIsSavingDecision(false);
      }
    },
    [collaboration, onGraphNeedsRefresh, project?.id, refreshAll]
  );

  const updateFullTextStatus = useCallback(
    async (article, fullTextStatus) => {
      if (!project?.id || !article?.id) {
        return;
      }
      try {
        await articleService.updateFullTextStatus(project.id, article.id, {
          fullTextStatus,
          reasonText: null,
        });
        toast.success("Status do texto completo atualizado.");
        await refreshAll();
      } catch (error) {
        toast.error("Erro ao atualizar status do texto completo: " + error.message);
      }
    },
    [project?.id, refreshAll]
  );

  const runBatchEvaluate = useCallback(async () => {
    if (!project?.id) {
      return;
    }
    try {
      setIsBatchEvaluating(true);
      const response = await articleService.batchEvaluateScreening(project.id, {
        onlyPending: true,
        forceReevaluate: false,
      });
      toast.success(
        `Triagem IA: ${response.summary?.evaluated || 0} avaliados, ${response.summary?.suggestedIncluded || 0} sugeridos para inclusao e ${response.summary?.suggestedExcluded || 0} para exclusao.`
      );
      await refreshAll();
    } catch (error) {
      toast.error("Erro ao executar triagem IA: " + error.message);
    } finally {
      setIsBatchEvaluating(false);
    }
  }, [project?.id, refreshAll]);

  return {
    activeFlowTab,
    applyDuplicateReview,
    articlePage,
    articlePageSize: ARTICLE_PAGE_SIZE,
    articleTotal,
    assignedToMe,
    articles,
    changeArticlePage,
    duplicateCandidates,
    identificationArticles,
    isBatchEvaluating,
    isLoadingArticles,
    isLoadingDuplicates: isLoadingDuplicates || duplicatesResource.loading,
    remoteErrors: [articlesResource.error, summaryResource.error, reportResource.error, duplicatesResource.error].filter(Boolean),
    isLoadingReport,
    isLoadingSummary,
    isPromotingUnique,
    isSavingDecision,
    promoteAllUniqueToScreening,
    promoteSelectedToScreening,
    report,
    refreshAll,
    runBatchEvaluate,
    runDedupAnalysis,
    searchTerm,
    selectedDuplicateMap,
    selectedIdentificationIds,
    setActiveFlowTab,
    setAssignedToMe,
    setSearchTerm,
    setSelectedDuplicateMap,
    submitEligibilityDecision,
    submitScreeningDecision,
    summary,
    toggleIdentificationSelection,
    toggleAllIdentificationSelection,
    updateFullTextStatus,
  };
};
