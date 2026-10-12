import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth";
import { saveReadingResume } from "@/features/dashboard";
import { AlertTriangleIcon, ArrowLeftIcon, FileIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { useArticleDetailsPage } from "@features/articles/public/hooks";
import { useArticleChat } from "@features/ai/public/hooks";
import { EligibilityDecisionDialog } from "@features/articles/public/components";
import { ScreeningDecisionDialog } from "@features/articles/public/components";
import { UploadPDFModal } from "@features/articles/public/components";
import { collaborativeReview } from "@features/articles/public/utils";
import { PrismaExtractionWorkspace } from "@features/articles/public/components";
import { PrismaArticleReviewWorkspace } from "@features/articles/public/components";
function mapSuggestedDecision(aiSuggestedStatus) {
  return aiSuggestedStatus === "excluido" ? "excluded" : "included";
}

function ArticleDetails() {
  const { user } = useAuth();
  const {
    article,
    articleList,
    articleListTotal,
    articleListLoading,
    articleId,
    articlePending,
    backUrl,
    error,
    projectError,
    articleListError,
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
    selectionSummary,
    setRightTab,
  } = useArticleDetailsPage();
  const chatSession = useArticleChat({ article, pdfData, enabled: rightTab === "chat" });
  useEffect(() => {
    if (!user?.id || loading || articlePending || error || projectError || !article || !project || String(article.id) !== String(articleId) || String(project.id) !== String(projectId)) return;
    saveReadingResume(user.id, { projectId, articleId, phase: article.reviewOutcome === "included" ? "included" : article.currentPhase, workspace: rightTab });
  }, [user?.id, loading, articlePending, error, projectError, article, project, projectId, articleId, rightTab]);
  const [screeningDialogOpen, setScreeningDialogOpen] = useState(false);
  const [screeningInitialDecision, setScreeningInitialDecision] = useState("included");
  const [eligibilityDialogOpen, setEligibilityDialogOpen] = useState(false);
  const [eligibilityInitialDecision, setEligibilityInitialDecision] = useState("included");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSavingDecision, setIsSavingDecision] = useState(false);

  useEffect(() => {
    setScreeningDialogOpen(false);
    setEligibilityDialogOpen(false);
    setUploadDialogOpen(false);
    setDeleteConfirmOpen(false);
  }, [projectId, articleId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldUseExtractionWorkspace =
      article?.reviewOutcome === "included" &&
      rightTab === "extracao" &&
      params.get("flow") === "included";
    if (!shouldUseExtractionWorkspace) {
      return;
    }

    if (params.get("workspace") === "extracao") {
      return;
    }

    params.set("flow", "included");
    params.set("workspace", "extracao");
    navigate(`/projetos/${projectId}/artigos/${articleId}?${params.toString()}`, { replace: true });
  }, [article?.reviewOutcome, articleId, navigate, projectId, rightTab]);

  if (loading && !article) {
    return (
      <div className="flex min-h-[400px] items-center justify-center gap-2 text-[var(--syn-text-secondary)]">
        <LoaderIcon className="h-6 w-6 animate-spin" />
        <span>Carregando artigo...</span>
      </div>
    );
  }

  if (error && !article) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <AlertTriangleIcon className="mb-3 h-12 w-12 text-[var(--syn-badge-high-text)]" />
        <h2 className="mb-1 text-lg font-semibold text-[var(--syn-text-primary)]">Erro ao carregar artigo</h2>
        <p className="mb-4 text-sm text-[var(--syn-text-secondary)]">{error}</p>
        <Button onClick={() => navigate(backUrl)} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para o Projeto
        </Button>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <FileIcon className="mb-3 h-12 w-12 text-[var(--syn-text-secondary)]" />
        <h2 className="mb-1 text-lg font-semibold text-[var(--syn-text-primary)]">Artigo não encontrado</h2>
        <Button onClick={() => navigate(backUrl)} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para o Projeto
        </Button>
      </div>
    );
  }

  async function handleScreeningSubmit(payload) {
    if (loading || error || String(article.id) !== String(articleId)) return;
    try {
      setIsSavingDecision(true);
      await handleScreeningDecision(payload);
      setScreeningDialogOpen(false);
    } finally {
      setIsSavingDecision(false);
    }
  }

  async function handleEligibilitySubmit(payload) {
    if (loading || error || String(article.id) !== String(articleId)) return;
    try {
      setIsSavingDecision(true);
      await handleEligibilityDecision(payload);
      setEligibilityDialogOpen(false);
    } finally {
      setIsSavingDecision(false);
    }
  }

  function openScreeningDialog(initialDecision = "included") {
    if (loading || error || String(article.id) !== String(articleId)) return;
    if (!collaborativeReview(article).canDecide) return;
    setScreeningInitialDecision(initialDecision);
    setScreeningDialogOpen(true);
  }

  function openEligibilityDialog(initialDecision = "included") {
    if (loading || error || String(article.id) !== String(articleId)) return;
    if (!collaborativeReview(article).canDecide) return;
    setEligibilityInitialDecision(initialDecision);
    setEligibilityDialogOpen(true);
  }

  const isIncluded = article.reviewOutcome === "included";
  const articleRouteParams = new URLSearchParams(window.location.search);
  const routeFlow = articleRouteParams.get("flow");
  const activeFlow = routeFlow || (isIncluded ? "included" : article.currentPhase || "screening");
  const isIncludedFlow = routeFlow === "included";
  const showExtractionWorkspace = isIncluded && isIncludedFlow && rightTab === "extracao";
  const suggestedDecision = mapSuggestedDecision(article.aiSuggestedStatus);
  const articleState = { pending: articlePending ?? (loading || Boolean(error)), error, retry: refreshArticle };

  const content = showExtractionWorkspace ? (
    <PrismaExtractionWorkspace
      key={projectId}
      articleState={articleState}
      article={article}
      articleId={articleId}
      articleList={articleList}
      articleListTotal={articleListTotal}
      articleListLoading={articleListLoading}
      backUrl={backUrl}
      isSavingEvidence={isSavingEvidence}
      navigate={navigate}
      onSaveEvidence={handleSaveEvidence}
      onSaveNotes={handleSaveNotes}
      pdfData={pdfData}
      project={project}
      projectId={projectId}
      selectionSummary={selectionSummary}
    />
  ) : (
    <PrismaArticleReviewWorkspace
      articleState={articleState}
      chatSession={chatSession}
      key={projectId}
      activeFlow={activeFlow}
      article={article}
      articleId={articleId}
      articleList={articleList}
      articleListTotal={articleListTotal}
      articleListLoading={articleListLoading}
      backUrl={backUrl}
      onRequestDelete={() => setDeleteConfirmOpen(true)}
      isSavingEvidence={isSavingEvidence}
      navigate={navigate}
      onOpenEligibility={openEligibilityDialog}
      onOpenScreening={openScreeningDialog}
      onOpenUpload={() => setUploadDialogOpen(true)}
      onSaveEvidence={handleSaveEvidence}
      onSaveNotes={handleSaveNotes}
      pdfData={pdfData}
      project={project}
      projectId={projectId}
      rightTab={rightTab}
      setRightTab={setRightTab}
      suggestedDecision={suggestedDecision}
    />
  );

  return (
    <>
      {projectError || articleListError || (error && !articleState.pending) ? <div role="alert">{projectError?.message || articleListError?.message || error}</div> : null}
      {content}
      {!articleState.pending ? <>
      <ScreeningDecisionDialog
        article={article}
        initialDecision={screeningInitialDecision}
        isOpen={screeningDialogOpen}
        isSaving={isSavingDecision}
        onClose={() => setScreeningDialogOpen(false)}
        onSubmit={handleScreeningSubmit}
      />

      <EligibilityDecisionDialog
        article={article}
        checklist={project?.eligibilityChecklist || []}
        initialDecision={eligibilityInitialDecision}
        pdfData={pdfData}
        projectId={projectId}
        researchQuestions={project?.researchQuestions || []}
        isOpen={eligibilityDialogOpen}
        isSaving={isSavingDecision}
        onClose={() => setEligibilityDialogOpen(false)}
        onSubmit={handleEligibilitySubmit}
      />

      <UploadPDFModal
        isOpen={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={() => {
          setUploadDialogOpen(false);
          refreshArticle();
        }}
        project={project}
        article={article}
      />

      <ConfirmationDialog
        open={deleteConfirmOpen}
        title="Remover artigo?"
        description={`O artigo “${article.title}” será removido permanentemente deste projeto.`}
        confirmLabel="Remover artigo"
        tone="destructive"
        onConfirm={async () => {
          if (loading || error || String(article.id) !== String(articleId)) return;
          setDeleteConfirmOpen(false);
          await handleDeleteArticle();
        }}
        onOpenChange={setDeleteConfirmOpen}
      />
      </> : null}
    </>
  );
}

export default ArticleDetails;
