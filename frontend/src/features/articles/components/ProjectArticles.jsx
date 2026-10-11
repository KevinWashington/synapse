import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpenIcon, CheckCircle2Icon, DownloadIcon, FileTextIcon, LoaderIcon, PlusIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { useReviewWorkspaceActions } from "../hooks/useReviewWorkspaceActions";
import { useProjectArticles } from "@features/articles/hooks/useProjectArticles";
import { useWorkspaceArticle } from "@features/articles/hooks/useWorkspaceArticle";
import { resolveSelectedArticle } from "@features/articles/utils/reviewFlow";
import { getExtractionProgress } from "@features/articles/utils/reviewWorkspace";
import { toast } from "@/lib/toast";
import ImportBibTeXModal from "@/features/articles/components/ImportBibTeXModal";
import NewArticleModal from "@/features/articles/components/NewArticleModal";
import UploadPDFModal from "@/features/articles/components/UploadPDFModal";
import AdaptiveReviewWorkspace from "@/features/articles/components/review/AdaptiveReviewWorkspace";
import ArticleReadingPane from "@/features/articles/components/review/ArticleReadingPane";
import EligibilityDecisionTool from "@/features/articles/components/review/EligibilityDecisionTool";
import IdentificationTool from "@/features/articles/components/review/IdentificationTool";
import IncludedExtractionTool from "@/features/articles/components/review/IncludedExtractionTool";
import ReviewQueuePanel, { getArticleBadge, getFilterOptions } from "@/features/articles/components/review/ReviewQueuePanel";
import ReviewStageNavigator from "@/features/articles/components/review/ReviewStageNavigator";
import ScreeningDecisionTool from "@/features/articles/components/review/ScreeningDecisionTool";
import { useReviewDraftGuard } from "@/features/articles/components/review/useReviewDraftGuard";
import DuplicateReviewPanel from "./review/DuplicateReviewPanel";
export { DuplicateReviewPanel };
import ArticleDetailPanel from "./review/ArticleDetailPanel";
export { ArticleDetailPanel };
import StageSidebar from "./review/StageSidebar";
export { StageSidebar };
const STAGES = [
  {
    key: "identification",
    number: 1,
    label: "Identificação",
    description: "Registros importados de diferentes bases de dados. Remova duplicatas antes de seguir para a triagem.",
    icon: FileTextIcon,
  },
  {
    key: "screening",
    number: 2,
    label: "Triagem",
    description: "Classifique os estudos com base nos critérios de elegibilidade definidos.",
    icon: ShieldCheckIcon,
  },
  {
    key: "eligibility",
    number: 3,
    label: "Elegibilidade",
    description: "Avalie o texto completo dos estudos quanto a elegibilidade.",
    icon: BookOpenIcon,
  },
  {
    key: "included",
    number: 4,
    label: "Inclusão",
    description: "Estudos que atendem a todos os critérios e serão incluídos na revisão.",
    icon: CheckCircle2Icon,
  },
];



function normalizeText(value) {
  return String(value || "").toLowerCase();
}



function filterArticles({ articles, duplicateIds, extractionSchema, filter, searchTerm, stageKey }) {
  const normalizedSearch = normalizeText(searchTerm);

  return articles.filter((article) => {
    const searchable = normalizeText(`${article.title} ${article.authors} ${article.journal} ${article.sourceName}`);
    if (normalizedSearch && !searchable.includes(normalizedSearch)) {
      return false;
    }

    const badge = getArticleBadge(article, stageKey, duplicateIds).label;
    if (filter === "duplicates") return duplicateIds.has(article.id) || Boolean(article.duplicateGroupKey);
    if (filter === "unique") return !duplicateIds.has(article.id) && !article.duplicateGroupKey;
    if (filter === "exclude") return badge === "Excluido";
    if (filter === "pending") return badge === "Pendente";
    if (filter === "pending_extraction") return getExtractionProgress(article, extractionSchema).state !== "completed";
    return true;
  });
}

function ProjectArticles({ project, onNavigate, onGraphNeedsRefresh, onViewFlow, collaboration }) {
  const canManageArticles = (collaboration?.capabilities ?? project?.capabilities ?? []).includes("edit_project");
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNewArticleModal, setShowNewArticleModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUploadPdfModal, setShowUploadPdfModal] = useState(false);
  const [pdfTarget, setPdfTarget] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [isDetailClosed, setIsDetailClosed] = useState(false);
  const [isReviewDraftDirty, setIsReviewDraftDirty] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("");
  const draftGuard = useReviewDraftGuard({
    isDirty: isReviewDraftDirty,
    confirmDiscard: () => setIsReviewDraftDirty(false),
  });

  const {
    activeFlowTab,
    applyDuplicateReview,
    articlePage,
    articlePageSize,
    articleTotal,
    assignedToMe,
    articles,
    changeArticlePage,
    duplicateCandidates,
    identificationArticles,
    isBatchEvaluating,
    isLoadingArticles,
    remoteErrors = [],
    isLoadingDuplicates,
    isPromotingUnique,
    isSavingDecision,
    promoteAllUniqueToScreening,
    promoteSelectedToScreening,
    refreshAll,
    runBatchEvaluate,
    runDedupAnalysis,
    searchTerm,
    selectedIdentificationIds,
    selectedDuplicateMap,
    setActiveFlowTab,
    setAssignedToMe,
    setSearchTerm,
    setSelectedDuplicateMap,
    submitEligibilityDecision,
    submitScreeningDecision,
    summary,
    toggleAllIdentificationSelection,
    toggleIdentificationSelection,
  } = useProjectArticles(project, onGraphNeedsRefresh, collaboration);

  const activeStage = STAGES.some((stage) => stage.key === activeFlowTab)
    ? activeFlowTab
    : "identification";

  useEffect(() => {
    if (searchParams.get("action") !== "import") {
      return;
    }

    setShowImportModal(canManageArticles);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("action");
      return next;
    });
  }, [canManageArticles, searchParams, setSearchParams]);

  useEffect(() => {
    setActiveFilter("all");
    setSelectedArticleId(null);
    setIsDetailClosed(false);
  }, [activeStage]);

  const duplicateIds = useMemo(() => {
    const ids = new Set();
    duplicateCandidates.forEach((group) => {
      (group.candidateIds || []).forEach((id) => ids.add(id));
    });
    return ids;
  }, [duplicateCandidates]);

  const stageArticles = activeStage === "identification" ? identificationArticles : articles;

  const filterOptions = useMemo(
    () => getFilterOptions(activeStage, duplicateIds, stageArticles, articleTotal).map((option) => {
      if (assignedToMe && option.key === "all") return { ...option, count: undefined };
      if (assignedToMe && option.key === "assigned") return { ...option, count: articleTotal };
      return option;
    }),
    [activeStage, articleTotal, assignedToMe, duplicateIds, stageArticles]
  );

  const filteredArticles = useMemo(
    () => filterArticles({
      articles: stageArticles,
      duplicateIds,
      extractionSchema: project?.dataExtractionSchema || [],
      filter: activeFilter,
      searchTerm,
      stageKey: activeStage,
    }),
    [activeFilter, activeStage, duplicateIds, project?.dataExtractionSchema, searchTerm, stageArticles]
  );

  const selectedArticle = useMemo(
    () => isDetailClosed ? null : resolveSelectedArticle(filteredArticles, selectedArticleId),
    [filteredArticles, isDetailClosed, selectedArticleId]
  );

  const {
    article: workspaceArticle,
    pdfData: workspacePdfData,
    error: workspaceError,
    isReady: workspaceReady = true,
    refreshArticle: refreshWorkspaceArticle,
  } = useWorkspaceArticle({
    activeStage,
    article: selectedArticle,
    projectId: project?.id,
  });

  useEffect(() => {
    if (!isDetailClosed) {
      setSelectedArticleId((currentId) => resolveSelectedArticle(filteredArticles, currentId)?.id ?? null);
    }
  }, [filteredArticles, isDetailClosed]);

  const selectedIndex = selectedArticle
    ? filteredArticles.findIndex((article) => article.id === selectedArticle.id)
    : -1;
  const extractionFormId = `workspace-extraction-${workspaceArticle?.id || "none"}`;

  function openUploadPdf(article) {
    setPdfTarget(article);
    setShowUploadPdfModal(true);
  }

  function selectAdjacent(direction) {
    if (!filteredArticles.length) {
      return;
    }
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = (currentIndex + direction + filteredArticles.length) % filteredArticles.length;
    setIsDetailClosed(false);
    setSelectedArticleId(filteredArticles[nextIndex].id);
  }

  const workspaceActions = useReviewWorkspaceActions({ project, article: workspaceArticle, refreshArticle: refreshWorkspaceArticle, refreshQueue: refreshAll, onGraphNeedsRefresh });
  const isSavingEvidence = workspaceActions.isSavingEvidence;

  async function handleExportStage() {
    try {
      await workspaceActions.exportStage();
      toast.success("Dados exportados.");
    } catch (error) {
      toast.error(`Erro ao exportar: ${error.message}`);
    }
  }

  async function handleDedupAndRefresh() {
    await runDedupAnalysis();
  }

  function handleSkip() {
    if (!selectedArticle) {
      return;
    }
    selectAdjacent(1);
    toast.info("Artigo mantido pendente. Próximo item aberto.");
  }

  async function saveScreeningDecision(articleId, payload) {
    setReviewStatus("Salvando decisão de triagem.");
    try {
      const saved = await submitScreeningDecision(articleId, payload);
      if (saved) setReviewStatus("Decisão de triagem salva. Próximo artigo aberto.");
      return saved;
    } catch (error) {
      setReviewStatus("Não foi possível salvar a decisão de triagem.");
      throw error;
    }
  }

  async function saveEligibilityDecision(articleId, payload) {
    if (!workspaceReady) return false;
    setReviewStatus("Salvando decisão de elegibilidade.");
    try {
      const saved = await submitEligibilityDecision(articleId, payload);
      if (saved) setReviewStatus("Decisão de elegibilidade salva. Próximo artigo aberto.");
      return saved;
    } catch (error) {
      setReviewStatus("Não foi possível salvar a decisão de elegibilidade.");
      throw error;
    }
  }

  async function saveEvidence(payload) {
    if (!workspaceArticle?.id || !workspaceReady) return false;
    setReviewStatus("Salvando extração do estudo.");
    try {
      const updated = await workspaceActions.saveEvidence(payload);
      setIsReviewDraftDirty(false);
      setReviewStatus(payload.markExtractionComplete
        ? "Extração concluída."
        : "Rascunho da extração salvo.");
      toast.success(payload.markExtractionComplete ? "Extração concluída." : "Rascunho da extração salvo.");
      return updated;
    } catch (error) {
      setReviewStatus("Não foi possível salvar a extração.");
      toast.error("Erro ao salvar extração: " + error.message);
      throw error;
    }
  }

  return (
    <div className="space-y-5">
      {remoteErrors.length > 0 ? <div role="alert">{remoteErrors.map((error) => error.message).join("; ")} <Button variant="outline" onClick={() => refreshAll()}>Tentar novamente</Button></div> : null}
      {workspaceError ? <div role="alert">{workspaceError.message}<Button variant="outline" onClick={refreshWorkspaceArticle}>Tentar novamente</Button></div> : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{reviewStatus}</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" className="h-10 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={handleExportStage}>
          <DownloadIcon className="h-4 w-4" />
          Exportar dados
        </Button>
        {canManageArticles ? <><Button className="h-10 gap-2 rounded-lg bg-[#6259ff] px-4 text-white hover:bg-[#5148ee]" onClick={() => setShowImportModal(true)}>
          <PlusIcon className="h-4 w-4" />
          Importar artigos
        </Button>
        <Button className="h-10 gap-2 rounded-lg bg-[#6259ff] px-4 text-white hover:bg-[#5148ee]" onClick={() => setShowNewArticleModal(true)}>
          <PlusIcon className="h-4 w-4" />
          Adicionar artigo  
        </Button></> : null}
      </div>

      <ReviewStageNavigator
        activeStage={activeStage}
        onStageChange={(stage) => {
          if (stage !== activeStage) draftGuard.guard(() => setActiveFlowTab(stage));
        }}
        summary={summary}
      />

      {activeStage === "identification" && canManageArticles ? (
        <DuplicateReviewPanel
          candidates={duplicateCandidates}
          isApplying={isLoadingDuplicates}
          onApply={applyDuplicateReview}
          onSelectCanonical={(groupKey, articleId) => {
            setSelectedDuplicateMap((current) => ({ ...current, [groupKey]: articleId }));
          }}
          selectedDuplicateMap={selectedDuplicateMap}
        />
      ) : null}

      <AdaptiveReviewWorkspace
        activeStage={activeStage}
        queue={<ReviewQueuePanel
          activeFilter={activeFilter}
          activeStage={activeStage}
          articlePage={articlePage}
          articlePageSize={articlePageSize}
          articleTotal={articleTotal}
          articles={filteredArticles}
          canManageArticles={canManageArticles}
          duplicateIds={duplicateIds}
          extractionSchema={project?.dataExtractionSchema || []}
          filterOptions={filterOptions}
          isLoading={isLoadingArticles}
          isPromotingUnique={isPromotingUnique}
          onArticleSelect={(article) => {
            if (article.id === selectedArticle?.id) return;
            draftGuard.guard(() => {
              setIsDetailClosed(false);
              setSelectedArticleId(article.id);
            });
          }}
          onFilterChange={(filter) => {
            if (filter === activeFilter) return;
            draftGuard.guard(() => {
              setActiveFilter(filter);
              setAssignedToMe(filter === "assigned");
            });
          }}
          onOpenArticle={(articleId) => {
            draftGuard.guard(() => {
              const params = new URLSearchParams({ flow: activeStage });
              if (activeStage === "included") {
                params.set("workspace", "extracao");
              }
              onNavigate(`/projetos/${project.id}/artigos/${articleId}?${params.toString()}`);
            });
          }}
          onPageChange={(page) => {
            if (page !== articlePage) draftGuard.guard(() => changeArticlePage(page));
          }}
          onPromoteAllUnique={promoteAllUniqueToScreening}
          onPromoteSelected={promoteSelectedToScreening}
          onToggleAllIdentification={toggleAllIdentificationSelection}
          onToggleIdentification={toggleIdentificationSelection}
          searchTerm={searchTerm}
          selectedArticle={selectedArticle}
          selectedIdentificationIds={selectedIdentificationIds}
          setSearchTerm={(value) => {
            if (value !== searchTerm) draftGuard.guard(() => setSearchTerm(value));
          }}
          summary={summary}
        />}
        content={<fieldset disabled={!workspaceReady} className="contents"><ArticleReadingPane
          activeStage={activeStage}
          article={workspaceArticle}
          extractionFormId={extractionFormId}
          isSavingEvidence={isSavingEvidence}
          onNext={() => {
            if (filteredArticles.length > 1) draftGuard.guard(() => selectAdjacent(1));
          }}
          onOpenArticle={(articleId) => {
            draftGuard.guard(() => {
              const params = new URLSearchParams({ flow: activeStage });
              if (activeStage === "included") params.set("workspace", "extracao");
              onNavigate(`/projetos/${project.id}/artigos/${articleId}?${params.toString()}`);
            });
          }}
          onPrevious={() => {
            if (filteredArticles.length > 1) draftGuard.guard(() => selectAdjacent(-1));
          }}
          onDirtyChange={setIsReviewDraftDirty}
          onSaveEvidence={saveEvidence}
          onUploadPdf={openUploadPdf}
          pdfData={workspacePdfData}
          position={{ current: selectedIndex >= 0 ? selectedIndex + 1 : 0, total: filteredArticles.length }}
          project={project}
        /></fieldset>}
        tool={<fieldset disabled={!workspaceReady} className="contents">{activeStage === "identification" ? <IdentificationTool
          articleTotal={articleTotal}
          canManageArticles={canManageArticles}
          duplicateCandidates={duplicateCandidates}
          onExport={handleExportStage}
          onPromoteAllUnique={promoteAllUniqueToScreening}
          onRunDedup={handleDedupAndRefresh}
          summary={summary}
        /> : activeStage === "screening" ? <ScreeningDecisionTool
          article={workspaceArticle}
          isSaving={isSavingDecision}
          onAdvance={() => { setIsReviewDraftDirty(false); selectAdjacent(1); }}
          onDirtyChange={setIsReviewDraftDirty}
          onSkip={() => draftGuard.guard(handleSkip)}
          onSubmit={saveScreeningDecision}
        /> : activeStage === "eligibility" ? <EligibilityDecisionTool
          article={workspaceArticle}
          checklist={project?.eligibilityChecklist || []}
          isSaving={isSavingDecision}
          onAdvance={() => { setIsReviewDraftDirty(false); selectAdjacent(1); }}
          onDirtyChange={setIsReviewDraftDirty}
          onSubmit={saveEligibilityDecision}
          researchQuestions={project?.researchQuestions || []}
        /> : activeStage === "included" ? <IncludedExtractionTool
          article={workspaceArticle}
          extractionFormId={extractionFormId}
          isSaving={isSavingEvidence}
          onExport={handleExportStage}
          onOpenExtraction={(articleId) => {
            const params = new URLSearchParams({ flow: activeStage, workspace: "extracao" });
            onNavigate(`/projetos/${project.id}/artigos/${articleId}?${params.toString()}`);
          }}
          onViewFlow={onViewFlow}
          project={project}
          summary={summary}
        /> : <StageSidebar
          activeStage={activeStage}
          articleTotal={articleTotal}
          articles={stageArticles}
          canManageArticles={canManageArticles}
          duplicateCandidates={duplicateCandidates}
          onBatchEvaluate={runBatchEvaluate}
          onExportStage={handleExportStage}
          onRunDedup={handleDedupAndRefresh}
          onViewFlow={onViewFlow}
          summary={summary}
        />}</fieldset>}
      />

      {isBatchEvaluating || isLoadingDuplicates ? (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 rounded-lg border border-[#edf0f7] bg-white px-4 py-3 text-sm text-[#667391] shadow-lg">
          <LoaderIcon className="h-4 w-4 animate-spin" />
          Processando etapa...
        </div>
      ) : null}

      <NewArticleModal
        isOpen={canManageArticles && showNewArticleModal}
        onClose={() => setShowNewArticleModal(false)}
        onSuccess={() => refreshAll()}
        projectId={project.id}
      />

      <ImportBibTeXModal
        isOpen={canManageArticles && showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => refreshAll()}
        projectId={project.id}
      />

      <UploadPDFModal
        isOpen={showUploadPdfModal}
        onClose={() => {
          setShowUploadPdfModal(false);
          setPdfTarget(null);
        }}
        onSuccess={() => {
          setShowUploadPdfModal(false);
          setPdfTarget(null);
          return Promise.all([refreshAll(), refreshWorkspaceArticle()]);
        }}
        project={project}
        article={pdfTarget}
      />

      <ConfirmationDialog
        open={draftGuard.isConfirmOpen}
        title="Descartar alterações da decisão?"
        description="Você tem uma decisão ainda não salva. Ao continuar, essas alterações serão perdidas."
        confirmLabel="Descartar e continuar"
        tone="destructive"
        onConfirm={draftGuard.confirm}
        onOpenChange={(open) => { if (!open) draftGuard.cancel(); }}
      />

    </div>
  );
}

export default ProjectArticles;
