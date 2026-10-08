import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { articleService } from "@features/articles/services/articleService";
import { toggleVisibleSelection } from "@features/articles/utils/reviewFlow";
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
  const [articles, setArticles] = useState([]);
  const [articlePage, setArticlePage] = useState(1);
  const [articleTotal, setArticleTotal] = useState(0);
  const [assignedToMe, setAssignedToMeState] = useState(false);
  const articleRequest = useRef(0);
  const [searchTermsByFlow, setSearchTermsByFlow] = useState({});
  const [summary, setSummary] = useState(null);
  const [report, setReport] = useState(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const [isBatchEvaluating, setIsBatchEvaluating] = useState(false);
  const [isPromotingUnique, setIsPromotingUnique] = useState(false);
  const [isLoadingSynthesisReport, setIsLoadingSynthesisReport] = useState(false);
  const [synthesisReportData, setSynthesisReportData] = useState(null);
  const [selectedIdentificationIds, setSelectedIdentificationIds] = useState([]);
  const [selectedDuplicateMap, setSelectedDuplicateMap] = useState({});
  const [screeningArticle, setScreeningArticle] = useState(null);
  const [eligibilityArticle, setEligibilityArticle] = useState(null);
  const searchTerm = searchTermsByFlow[activeFlowTab] || "";

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

  const loadSummary = useCallback(async () => {
    if (!project?.id) {
      return;
    }
    try {
      setIsLoadingSummary(true);
      const response = await articleService.getSelectionSummary(project.id);
      setSummary(response);
    } catch (error) {
      console.error("Erro ao carregar resumo do funil:", error);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [project?.id]);

  const loadReport = useCallback(async () => {
    if (!project?.id) {
      return;
    }
    try {
      setIsLoadingReport(true);
      const response = await articleService.getSelectionReport(project.id);
      setReport(response);
    } catch (error) {
      console.error("Erro ao carregar relatorio:", error);
    } finally {
      setIsLoadingReport(false);
    }
  }, [project?.id]);

  const loadDuplicateCandidates = useCallback(async () => {
    if (!project?.id) {
      return;
    }
    try {
      setIsLoadingDuplicates(true);
      const response = await articleService.getDuplicateCandidates(project.id);
      setDuplicateCandidates(response || []);
      setSelectedDuplicateMap((current) => {
        const next = {};
        (response || []).forEach((group) => {
          next[group.groupKey] = current[group.groupKey] || group.candidateIds?.[0] || null;
        });
        return next;
      });
    } catch (error) {
      console.error("Erro ao carregar duplicatas:", error);
      setDuplicateCandidates([]);
    } finally {
      setIsLoadingDuplicates(false);
    }
  }, [project?.id]);

  const loadArticles = useCallback(async (flowOverride = activeFlowTab, pageOverride = articlePage) => {
    if (!project?.id) {
      return;
    }
    const resolvedFlowTab = FLOW_TABS.has(flowOverride) ? flowOverride : activeFlowTab;
    const request = ++articleRequest.current;
    const currentSearchTerm = searchTermsByFlow[resolvedFlowTab] || "";

    if (!PHASE_FILTERS[resolvedFlowTab]) {
      setArticles([]);
      setArticleTotal(0);
      return;
    }

    try {
      setIsLoadingArticles(true);
      const response = await articleService.getArticlesByProject(project.id, {
        ...PHASE_FILTERS[resolvedFlowTab],
        search: currentSearchTerm || undefined,
        page: pageOverride,
        limit: ARTICLE_PAGE_SIZE,
        ...(assignedToMe && ["screening", "eligibility"].includes(resolvedFlowTab) ? { assignedToMe: true } : {}),
      });
      if (request !== articleRequest.current) return;
      const nextArticles = response.articles || [];
      const nextTotal = response.total || 0;
      const lastPage = Math.max(1, Math.ceil(nextTotal / ARTICLE_PAGE_SIZE));

      setArticleTotal(nextTotal);
      if (nextTotal > 0 && nextArticles.length === 0 && pageOverride > lastPage) {
        setArticlePage(lastPage);
        return;
      }

      setArticles(nextArticles);
      if (resolvedFlowTab !== "identification") {
        setSelectedIdentificationIds([]);
      }
    } catch (error) {
      if (request !== articleRequest.current) return;
      console.error("Erro ao carregar artigos:", error);
      setArticles([]);
      setArticleTotal(0);
    } finally {
      if (request === articleRequest.current) setIsLoadingArticles(false);
    }
  }, [activeFlowTab, articlePage, assignedToMe, project?.id, searchTermsByFlow]);

  useEffect(() => {
    loadSummary();
    loadReport();
    loadDuplicateCandidates();
  }, [loadDuplicateCandidates, loadReport, loadSummary]);

  useEffect(() => {
    loadArticles(activeFlowTab);
    return () => { articleRequest.current += 1; };
  }, [activeFlowTab, loadArticles]);

  const refreshAll = useCallback(
    async ({ refreshSynthesisReport = false, targetFlowTab } = {}) => {
      const flowToLoad = targetFlowTab || activeFlowTab;

      if (targetFlowTab) {
        setActiveFlowTab(targetFlowTab);
      }

      await Promise.all([
        loadSummary(),
        loadReport(),
        loadDuplicateCandidates(),
        loadArticles(flowToLoad, targetFlowTab ? 1 : articlePage),
      ]);
      if (refreshSynthesisReport && synthesisReportData) {
        const synthesis = await articleService.getProjectSynthesisReport(project.id);
        setSynthesisReportData(synthesis);
      }
    },
    [
      activeFlowTab,
      articlePage,
      loadArticles,
      loadDuplicateCandidates,
      loadReport,
      loadSummary,
      project?.id,
      setActiveFlowTab,
      synthesisReportData,
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
  }, [project?.id, refreshAll]);

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
    async (payload) => {
      if (!project?.id || !screeningArticle?.id) {
        return;
      }
      try {
        setIsSavingDecision(true);
        await articleService.submitScreeningDecision(project.id, screeningArticle.id, payload);
        toast.success("Decisão de triagem registrada.");
        setScreeningArticle(null);
        await refreshAll();
        await collaboration?.refreshAssignments?.();
      } catch (error) {
        toast.error("Erro ao salvar triagem: " + error.message);
        throw error;
      } finally {
        setIsSavingDecision(false);
      }
    },
    [collaboration, project?.id, refreshAll, screeningArticle]
  );

  const submitEligibilityDecision = useCallback(
    async (payload) => {
      if (!project?.id || !eligibilityArticle?.id) {
        return;
      }
      try {
        setIsSavingDecision(true);
        await articleService.submitEligibilityDecision(project.id, eligibilityArticle.id, payload);
        toast.success("Decisão de elegibilidade registrada.");
        onGraphNeedsRefresh?.();
        setEligibilityArticle(null);
        await refreshAll({ refreshSynthesisReport: true });
        await collaboration?.refreshAssignments?.();
      } catch (error) {
        toast.error("Erro ao salvar elegibilidade: " + error.message);
        throw error;
      } finally {
        setIsSavingDecision(false);
      }
    },
    [collaboration, eligibilityArticle, onGraphNeedsRefresh, project?.id, refreshAll]
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

  const loadSynthesisReport = useCallback(async () => {
    if (!project?.id) {
      return;
    }
    try {
      setIsLoadingSynthesisReport(true);
      const response = await articleService.getProjectSynthesisReport(project.id);
      setSynthesisReportData(response || null);
    } catch (error) {
      toast.error("Erro ao carregar sintese estruturada: " + error.message);
    } finally {
      setIsLoadingSynthesisReport(false);
    }
  }, [project?.id]);

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
    eligibilityArticle,
    identificationArticles,
    isBatchEvaluating,
    isLoadingArticles,
    isLoadingDuplicates,
    isLoadingReport,
    isLoadingSynthesisReport,
    isLoadingSummary,
    isPromotingUnique,
    isSavingDecision,
    loadSynthesisReport,
    promoteAllUniqueToScreening,
    promoteSelectedToScreening,
    report,
    refreshAll,
    synthesisReportData,
    runBatchEvaluate,
    runDedupAnalysis,
    screeningArticle,
    searchTerm,
    selectedDuplicateMap,
    selectedIdentificationIds,
    setActiveFlowTab,
    setAssignedToMe,
    setEligibilityArticle,
    setScreeningArticle,
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
