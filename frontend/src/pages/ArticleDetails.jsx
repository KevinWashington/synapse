import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangleIcon, ArrowLeftIcon, FileIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState } from "@/components/layout";
import ArticleDecisionDialog from "@/features/articles/components/ArticleDecisionDialog";
import {
  ArticleAIBanner,
  ArticleStatusActions,
  useArticleDetailsPage,
} from "@/features/articles";
import { usePageTitle } from "@hooks/usePageTitle";

const ArticleWorkspacePanel = lazy(() =>
  import("@features/articles/components/ArticleWorkspacePanel")
);
const PdfViewer = lazy(() =>
  import("@features/articles/components/PdfViewer")
);

function ArticlePanelLoader() {
  return <LoadingState message="Carregando conteúdo..." />;
}

function ArticleDetails() {
  const {
    article,
    articleId,
    error,
    handleAddNote,
    handleApplyDecision,
    handleChangeStatus,
    handleDeleteArticle,
    handleSaveNotes,
    loading,
    navigate,
    pdfData,
    project,
    projectId,
    rightTab,
    setRightTab,
  } = useArticleDetailsPage();
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionInitialValue, setDecisionInitialValue] = useState(null);
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const updateTitle = usePageTitle({ title: "", backUrl: `/projetos/${projectId}` });

  const selectedRQLabels = useMemo(() => {
    const projectRQs = project?.researchQuestions || [];
    const selected = article?.answeringRQs || [];

    return selected
      .map((rqNumber) => {
        const question = projectRQs[rqNumber - 1];
        return question ? `RQ ${rqNumber}: ${question}` : `RQ ${rqNumber}`;
      })
      .filter(Boolean);
  }, [article?.answeringRQs, project?.researchQuestions]);

  const suggestedRQLabels = useMemo(() => {
    const projectRQs = project?.researchQuestions || [];
    const suggested = article?.aiSuggestedRQs || [];

    return suggested
      .map((rqNumber) => {
        const question = projectRQs[rqNumber - 1];
        return question ? `RQ ${rqNumber}: ${question}` : `RQ ${rqNumber}`;
      })
      .filter(Boolean);
  }, [article?.aiSuggestedRQs, project?.researchQuestions]);

  useEffect(() => {
    if (!article?.title) {
      return;
    }

    updateTitle({
      title: article.title,
      badge: <StatusBadge status={article.status} />,
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
        <h2 className="mb-1 text-lg font-semibold text-[var(--syn-text-primary)]">
          Erro ao carregar artigo
        </h2>
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
        <h2 className="mb-1 text-lg font-semibold text-[var(--syn-text-primary)]">
          Artigo não encontrado
        </h2>
        <p className="mb-4 text-sm text-[var(--syn-text-secondary)]">
          O artigo não existe ou foi removido.
        </p>
        <Button onClick={() => navigate(`/projetos/${projectId}`)} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para o Projeto
        </Button>
      </div>
    );
  }

  function openDecisionDialog(initialDecision = null) {
    setDecisionInitialValue(initialDecision);
    setDecisionDialogOpen(true);
  }

  async function handleSubmitDecision(payload) {
    try {
      setIsSavingDecision(true);
      await handleApplyDecision(payload);
      setDecisionDialogOpen(false);
      setDecisionInitialValue(null);
    } finally {
      setIsSavingDecision(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <ArticleStatusActions
        onChangeStatus={handleChangeStatus}
        onDeleteArticle={handleDeleteArticle}
        onOpenDecisionDialog={openDecisionDialog}
      />

      <ArticleAIBanner
        article={article}
        onAccept={() => openDecisionDialog("incluido")}
        onExclude={() => openDecisionDialog("excluido")}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-3 py-2 text-xs">
        <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1 text-[var(--syn-text-secondary)]">
          Decisão manual: {article.manualDecision || "não definida"}
        </span>
        {suggestedRQLabels.length ? (
          suggestedRQLabels.map((label) => (
            <span
              key={`suggested-${label}`}
              className="max-w-[320px] truncate rounded-md bg-[var(--syn-badge-blue-bg)] px-2 py-1 text-[var(--syn-badge-blue-text)]"
              title={`Sugestão IA: ${label}`}
            >
              IA: {label}
            </span>
          ))
        ) : null}
        {selectedRQLabels.length ? (
          selectedRQLabels.map((label) => (
            <span
              key={label}
              className="max-w-[320px] truncate rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1 text-[var(--syn-text-secondary)]"
              title={label}
            >
              {label}
            </span>
          ))
        ) : (
          <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1 text-[var(--syn-text-secondary)]">
            RQs marcadas: nenhuma
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-[1.4_1_0%]">
          <Suspense fallback={<ArticlePanelLoader />}>
            <PdfViewer
              article={article}
              articleId={articleId}
              projectId={projectId}
            />
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

      <ArticleDecisionDialog
        article={article}
        researchQuestions={project?.researchQuestions || []}
        initialDecision={decisionInitialValue}
        isOpen={decisionDialogOpen}
        isSaving={isSavingDecision}
        onClose={() => {
          if (isSavingDecision) {
            return;
          }
          setDecisionDialogOpen(false);
          setDecisionInitialValue(null);
        }}
        onSubmit={handleSubmitDecision}
      />
    </div>
  );
}

export default ArticleDetails;

