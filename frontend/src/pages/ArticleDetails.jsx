import { lazy, Suspense, useEffect, useState } from "react";
import { AlertTriangleIcon, ArrowLeftIcon, FileIcon, LoaderIcon, TrashIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState } from "@/components/layout";
import { useArticleDetailsPage } from "@/features/articles";
import ArticleAIBanner from "@/features/articles/components/ArticleAIBanner";
import EligibilityDecisionDialog from "@/features/articles/components/EligibilityDecisionDialog";
import ScreeningDecisionDialog from "@/features/articles/components/ScreeningDecisionDialog";
import UploadPDFModal from "@/features/articles/components/UploadPDFModal";
import { usePageTitle } from "@hooks/usePageTitle";

const ArticleWorkspacePanel = lazy(() =>
  import("@features/articles/components/ArticleWorkspacePanel")
);
const PdfViewer = lazy(() => import("@features/articles/components/PdfViewer"));

function ArticlePanelLoader() {
  return <LoadingState message="Carregando conteudo..." />;
}

function ArticleDetails() {
  const {
    article,
    articleId,
    error,
    handleAddNote,
    handleDeleteArticle,
    handleEligibilityDecision,
    handleSaveNotes,
    handleScreeningDecision,
    loading,
    navigate,
    pdfData,
    project,
    projectId,
    refreshArticle,
    rightTab,
    setRightTab,
  } = useArticleDetailsPage();
  const updateTitle = usePageTitle({ title: "", backUrl: `/projetos/${projectId}` });
  const [screeningDialogOpen, setScreeningDialogOpen] = useState(false);
  const [eligibilityDialogOpen, setEligibilityDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isSavingDecision, setIsSavingDecision] = useState(false);

  useEffect(() => {
    if (!article?.title) {
      return;
    }
    updateTitle({
      title: article.title,
      badge: (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={article.currentPhase} />
          <StatusBadge status={article.reviewOutcome} />
        </div>
      ),
    });
  }, [article, updateTitle]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center gap-2 text-[var(--syn-text-secondary)]">
        <LoaderIcon className="h-6 w-6 animate-spin" />
        <span>Carregando artigo...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <AlertTriangleIcon className="mb-3 h-12 w-12 text-[var(--syn-badge-high-text)]" />
        <h2 className="mb-1 text-lg font-semibold text-[var(--syn-text-primary)]">Erro ao carregar artigo</h2>
        <p className="mb-4 text-sm text-[var(--syn-text-secondary)]">{error}</p>
        <Button onClick={() => navigate(`/projetos/${projectId}`)} className="gap-2">
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
        <h2 className="mb-1 text-lg font-semibold text-[var(--syn-text-primary)]">Artigo nao encontrado</h2>
        <Button onClick={() => navigate(`/projetos/${projectId}`)} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para o Projeto
        </Button>
      </div>
    );
  }

  async function handleScreeningSubmit(payload) {
    try {
      setIsSavingDecision(true);
      await handleScreeningDecision(payload);
      setScreeningDialogOpen(false);
    } finally {
      setIsSavingDecision(false);
    }
  }

  async function handleEligibilitySubmit(payload) {
    try {
      setIsSavingDecision(true);
      await handleEligibilityDecision(payload);
      setEligibilityDialogOpen(false);
    } finally {
      setIsSavingDecision(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={article.currentPhase} />
          <StatusBadge status={article.reviewOutcome} />
          <span className="text-xs text-[var(--syn-text-secondary)]">{article.sourceName}</span>
          <span className="text-xs text-[var(--syn-text-secondary)]">
            Full text: {article.fullTextStatus || "not_requested"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {article.currentPhase === "screening" ? (
            <Button size="sm" className="gap-2" onClick={() => setScreeningDialogOpen(true)}>
              Screening
            </Button>
          ) : null}
          {article.currentPhase === "eligibility" ? (
            <>
              {!article.hasPdf ? (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setUploadDialogOpen(true)}>
                  <UploadIcon className="h-3.5 w-3.5" />
                  Upload PDF
                </Button>
              ) : null}
              <Button size="sm" className="gap-2" onClick={() => setEligibilityDialogOpen(true)}>
                Elegibilidade
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" className="gap-2 text-red-500" onClick={handleDeleteArticle}>
            <TrashIcon className="h-3.5 w-3.5" />
            Remover
          </Button>
        </div>
      </div>

      {article.currentPhase !== "included" ? (
        <ArticleAIBanner
          article={article}
          onAccept={() => setScreeningDialogOpen(true)}
          onExclude={() => setScreeningDialogOpen(true)}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-[1.2_1_0%]">
          <Suspense fallback={<ArticlePanelLoader />}>
            <PdfViewer article={article} articleId={articleId} pdfData={pdfData} projectId={projectId} />
          </Suspense>
        </div>

        <div className="min-h-0 min-w-0 flex-1">
          <Suspense fallback={<ArticlePanelLoader />}>
            <ArticleWorkspacePanel
              article={article}
              articleId={articleId}
              onAddNote={handleAddNote}
              onSaveNotes={handleSaveNotes}
              pdfData={pdfData}
              projectId={projectId}
              rightTab={rightTab}
              setRightTab={setRightTab}
            />
          </Suspense>
        </div>
      </div>

      <ScreeningDecisionDialog
        article={article}
        isOpen={screeningDialogOpen}
        isSaving={isSavingDecision}
        onClose={() => setScreeningDialogOpen(false)}
        onSubmit={handleScreeningSubmit}
      />

      <EligibilityDecisionDialog
        article={article}
        checklist={project?.eligibilityChecklist || []}
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
    </div>
  );
}

export default ArticleDetails;
