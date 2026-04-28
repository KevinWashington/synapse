import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { articleService } from "@features/articles/services/articleService";
import { toast } from "@/lib/toast";

const PHASE_FILTERS = {
  identification: { phase: "identification" },
  screening: { phase: "screening" },
  eligibility: { phase: "eligibility" },
  included: { outcome: "included" },
};
const FLOW_TABS = new Set([
  "overview",
  "identification",
  "screening",
  "eligibility",
  "included",
  "report",
]);

export const useProjectArticles = (project, onGraphNeedsRefresh) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFlowTab, setActiveFlowTabState] = useState(() => {
    const requestedFlow = searchParams.get("flow");
    return FLOW_TABS.has(requestedFlow) ? requestedFlow : "overview";
  });
  const [articles, setArticles] = useState([]);
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
  const [isLoadingSynthesisReport, setIsLoadingSynthesisReport] = useState(false);
  const [synthesisReportData, setSynthesisReportData] = useState(null);
  const [selectedIdentificationIds, setSelectedIdentificationIds] = useState([]);
  const [selectedDuplicateMap, setSelectedDuplicateMap] = useState({});
  const [screeningArticle, setScreeningArticle] = useState(null);
  const [eligibilityArticle, setEligibilityArticle] = useState(null);
  const searchTerm = searchTermsByFlow[activeFlowTab] || "";

  useEffect(() => {
    const requestedFlow = searchParams.get("flow");
    const nextFlow = FLOW_TABS.has(requestedFlow) ? requestedFlow : "overview";

    setActiveFlowTabState((current) => (current === nextFlow ? current : nextFlow));
  }, [searchParams]);

  const setActiveFlowTab = useCallback(
    (nextFlowTab) => {
      const resolvedFlowTab = FLOW_TABS.has(nextFlowTab) ? nextFlowTab : "overview";

      setActiveFlowTabState(resolvedFlowTab);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);

        if (resolvedFlowTab === "overview") {
          next.delete("flow");
        } else {
          next.set("flow", resolvedFlowTab);
        }

        return next;
      });
    },
    [setSearchParams]
  );

  const setSearchTerm = useCallback(
    (value) => {
      setSearchTermsByFlow((current) => ({
        ...current,
        [activeFlowTab]: value,
      }));
    },
    [activeFlowTab]
  );

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

  const loadArticles = useCallback(async (flowOverride = activeFlowTab) => {
    if (!project?.id) {
      return;
    }
    const resolvedFlowTab = FLOW_TABS.has(flowOverride) ? flowOverride : activeFlowTab;
    const currentSearchTerm = searchTermsByFlow[resolvedFlowTab] || "";

    if (!PHASE_FILTERS[resolvedFlowTab]) {
      setArticles([]);
      return;
    }

    try {
      setIsLoadingArticles(true);
      const response = await articleService.getArticlesByProject(project.id, {
        ...PHASE_FILTERS[resolvedFlowTab],
        search: currentSearchTerm || undefined,
        limit: 100,
      });
      setArticles(response.articles || []);
      if (resolvedFlowTab !== "identification") {
        setSelectedIdentificationIds([]);
      }
    } catch (error) {
      console.error("Erro ao carregar artigos:", error);
      setArticles([]);
    } finally {
      setIsLoadingArticles(false);
    }
  }, [activeFlowTab, project?.id, searchTermsByFlow]);

  useEffect(() => {
    loadSummary();
    loadReport();
    loadDuplicateCandidates();
  }, [loadDuplicateCandidates, loadReport, loadSummary]);

  useEffect(() => {
    loadArticles(activeFlowTab);
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
        loadArticles(flowToLoad),
      ]);
      if (refreshSynthesisReport && synthesisReportData) {
        const synthesis = await articleService.getProjectSynthesisReport(project.id);
        setSynthesisReportData(synthesis);
      }
    },
    [
      activeFlowTab,
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

  const submitScreeningDecision = useCallback(
    async (payload) => {
      if (!project?.id || !screeningArticle?.id) {
        return;
      }
      try {
        setIsSavingDecision(true);
        await articleService.submitScreeningDecision(project.id, screeningArticle.id, payload);
        toast.success("Decisao de triagem registrada.");
        setScreeningArticle(null);
        await refreshAll();
      } catch (error) {
        toast.error("Erro ao salvar triagem: " + error.message);
        throw error;
      } finally {
        setIsSavingDecision(false);
      }
    },
    [project?.id, refreshAll, screeningArticle]
  );

  const submitEligibilityDecision = useCallback(
    async (payload) => {
      if (!project?.id || !eligibilityArticle?.id) {
        return;
      }
      try {
        setIsSavingDecision(true);
        await articleService.submitEligibilityDecision(project.id, eligibilityArticle.id, payload);
        toast.success("Decisao de elegibilidade registrada.");
        onGraphNeedsRefresh?.();
        setEligibilityArticle(null);
        await refreshAll({ refreshSynthesisReport: true });
      } catch (error) {
        toast.error("Erro ao salvar elegibilidade: " + error.message);
        throw error;
      } finally {
        setIsSavingDecision(false);
      }
    },
    [eligibilityArticle, onGraphNeedsRefresh, project?.id, refreshAll]
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

  const handleDeleteArticle = useCallback(
    async (article) => {
      if (!project?.id || !article?.id) {
        return;
      }
      if (!confirm(`Deseja remover o registro "${article.title}"?`)) {
        return;
      }
      try {
        await articleService.deleteArticle(project.id, article.id);
        toast.success("Registro removido com sucesso.");
        await refreshAll({ refreshSynthesisReport: true });
      } catch (error) {
        toast.error("Erro ao remover registro: " + error.message);
      }
    },
    [project?.id, refreshAll]
  );

  return {
    activeFlowTab,
    applyDuplicateReview,
    articles,
    duplicateCandidates,
    eligibilityArticle,
    handleDeleteArticle,
    identificationArticles,
    isBatchEvaluating,
    isLoadingArticles,
    isLoadingDuplicates,
    isLoadingReport,
    isLoadingSynthesisReport,
    isLoadingSummary,
    isSavingDecision,
    loadSynthesisReport,
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
    setEligibilityArticle,
    setScreeningArticle,
    setSearchTerm,
    setSelectedDuplicateMap,
    submitEligibilityDecision,
    submitScreeningDecision,
    summary,
    toggleIdentificationSelection,
    updateFullTextStatus,
  };
};
