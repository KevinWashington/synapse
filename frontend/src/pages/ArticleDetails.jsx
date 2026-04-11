import { lazy, Suspense, useEffect } from "react";
import { AlertTriangleIcon, ArrowLeftIcon, FileIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState } from "@/components/layout";
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
    handleChangeStatus,
    handleDeleteArticle,
    handleSaveNotes,
    loading,
    navigate,
    pdfData,
    projectId,
    rightTab,
    setRightTab,
  } = useArticleDetailsPage();
  const updateTitle = usePageTitle({ title: "", backUrl: `/projetos/${projectId}` });

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

  return (
    <div className="flex h-full flex-col">
      <ArticleStatusActions
        onChangeStatus={handleChangeStatus}
        onDeleteArticle={handleDeleteArticle}
      />

      <ArticleAIBanner
        article={article}
        onAccept={() => handleChangeStatus("analisado")}
        onExclude={() => handleChangeStatus("excluido")}
      />

      <div className="flex h-[calc(100vh-200px)] min-h-0 flex-1 gap-4">
        <div className="min-h-0 w-[58%] shrink-0">
          <Suspense fallback={<ArticlePanelLoader />}>
            <PdfViewer
              article={article}
              articleId={articleId}
              projectId={projectId}
            />
          </Suspense>
        </div>

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
  );
}

export default ArticleDetails;

