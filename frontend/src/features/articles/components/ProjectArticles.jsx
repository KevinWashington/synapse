import { useCallback, useState } from "react";
import { GridIcon, LoaderIcon, PlusIcon, SparklesIcon, TableIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ArticleListEmptyState from "@features/articles/components/ArticleListEmptyState";
import ArticleListFilters from "@features/articles/components/ArticleListFilters";
import ArticleDecisionDialog from "@features/articles/components/ArticleDecisionDialog";
import RQSynthesisPanel from "@features/articles/components/RQSynthesisPanel";
import ArticleCard from "./ArticleCard";
import ArticlesTable from "./ArticlesTable";
import NewArticleModal from "./NewArticleModal";
import ImportBibTeXModal from "./ImportBibTeXModal";
import EditArticleModal from "./EditArticleModal";
import UploadPDFModal from "./UploadPDFModal";
import { useProjectArticles } from "@features/articles/hooks/useProjectArticles";

function ViewModeToggleButton({ icon, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        isActive
          ? "bg-[var(--syn-sidebar-bg)] text-white"
          : "text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)]"
      }`}
    >
      {icon}
    </button>
  );
}

function ProjectArticles({ project, onNavigate, onGraphNeedsRefresh }) {
  const [viewMode, setViewMode] = useState("tabela");
  const [showNewArticleModal, setShowNewArticleModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadPdfModal, setShowUploadPdfModal] = useState(false);
  const [showRQSynthesis, setShowRQSynthesis] = useState(false);
  const [articleToEdit, setArticleToEdit] = useState(null);
  const [articleToUploadPdf, setArticleToUploadPdf] = useState(null);

  const {
    articles,
    closeDecisionDialog,
    decisionArticle,
    decisionInitialValue,
    filterStatus,
    filterSummary,
    handleDeleteArticle,
    handleEditSuccess,
    handleImportSuccess,
    handleNewArticleSuccess,
    handleUpdateArticleStatus,
    handleUploadPdfSuccess,
    isBatchEvaluating,
    isDecisionDialogOpen,
    isLoadingRQSynthesis,
    isLoadingArticles,
    isSavingDecision,
    loadRQSynthesis,
    openDecisionDialog,
    pagination,
    rqSynthesisData,
    runBatchEvaluate,
    searchTerm,
    setFilterStatus,
    setSearchTerm,
    statusList,
    submitDecision,
  } = useProjectArticles(project);

  function handleAddArticle() {
    setShowNewArticleModal(true);
  }

  function handleImportBibTeX() {
    setShowImportModal(true);
  }

  function handleEditArticle(article) {
    setArticleToEdit(article);
    setShowEditModal(true);
  }

  function handleReviewArticle(article) {
    onNavigate(`/projetos/${project.id}/artigos/${article.id}`);
  }

  const handleNewArticleComplete = useCallback(
    (...args) => {
      handleNewArticleSuccess(...args);
      onGraphNeedsRefresh?.();
    },
    [handleNewArticleSuccess, onGraphNeedsRefresh]
  );

  const handleImportComplete = useCallback(
    (...args) => {
      handleImportSuccess(...args);
      onGraphNeedsRefresh?.();
    },
    [handleImportSuccess, onGraphNeedsRefresh]
  );

  async function handleToggleRQSynthesis() {
    const nextValue = !showRQSynthesis;
    setShowRQSynthesis(nextValue);

    if (nextValue && !rqSynthesisData && !isLoadingRQSynthesis) {
      await loadRQSynthesis();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--syn-border)] p-0.5">
            <ViewModeToggleButton
              icon={<TableIcon className="h-3.5 w-3.5" />}
              isActive={viewMode === "tabela"}
              onClick={() => setViewMode("tabela")}
            />
            <ViewModeToggleButton
              icon={<GridIcon className="h-3.5 w-3.5" />}
              isActive={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
            />
          </div>

          {pagination.totalDocuments > 0 ? (
            <span className="text-xs text-[var(--syn-text-secondary)]">
              {pagination.totalDocuments}{" "}
              {pagination.totalDocuments === 1 ? "artigo" : "artigos"}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() =>
              runBatchEvaluate({
                onlyPending: true,
                onlyUnscored: true,
                forceReevaluate: false,
              })
            }
            disabled={isBatchEvaluating}
            title="Avalia apenas artigos pendentes que ainda não têm score da IA"
          >
            {isBatchEvaluating ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SparklesIcon className="h-3.5 w-3.5" />
            )}
            Triagem IA (novos)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={handleToggleRQSynthesis}
            disabled={isLoadingRQSynthesis}
          >
            {isLoadingRQSynthesis ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SparklesIcon className="h-3.5 w-3.5" />
            )}
            Síntese RQ
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={handleImportBibTeX}
          >
            <UploadIcon className="h-3.5 w-3.5" />
            Importar BibTeX
          </Button>
          <Button size="sm" className="gap-2 text-xs" onClick={handleAddArticle}>
            <PlusIcon className="h-3.5 w-3.5" />
            Adicionar Artigo
          </Button>
        </div>
      </div>

      {filterSummary ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--syn-text-secondary)]">
          <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1">
            Total: {filterSummary.totalArticles || 0}
          </span>
          <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1">
            Pendentes: {filterSummary.status?.pendente || 0}
          </span>
          <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1">
            Analisados: {filterSummary.status?.analisado || 0}
          </span>
          <span className="rounded-md bg-[var(--syn-bg-secondary)] px-2 py-1">
            Excluídos: {filterSummary.status?.excluido || 0}
          </span>
        </div>
      ) : null}

      {showRQSynthesis ? (
        <RQSynthesisPanel
          data={rqSynthesisData}
          isLoading={isLoadingRQSynthesis}
          onRefresh={loadRQSynthesis}
          onOpenArticle={(articleId) =>
            onNavigate(`/projetos/${project.id}/artigos/${articleId}`)
          }
        />
      ) : null}

      {viewMode === "tabela" ? (
        <ArticlesTable
          articles={articles}
          filterStatus={filterStatus}
          handleDeleteArticle={handleDeleteArticle}
          handleEditArticle={handleEditArticle}
          handleManualDecision={openDecisionDialog}
          handleReviewArticle={handleReviewArticle}
          handleUpdateArticleStatus={handleUpdateArticleStatus}
          isLoadingArticles={isLoadingArticles}
          searchTerm={searchTerm}
          setFilterStatus={setFilterStatus}
          setSearchTerm={setSearchTerm}
          statusList={statusList}
        />
      ) : (
        <>
          <ArticleListFilters
            filterStatus={filterStatus}
            searchTerm={searchTerm}
            setFilterStatus={setFilterStatus}
            setSearchTerm={setSearchTerm}
            statusList={statusList}
          />

          {isLoadingArticles ? (
            <div className="flex items-center justify-center py-8">
              <LoaderIcon className="h-5 w-5 animate-spin text-[var(--syn-text-secondary)]" />
              <span className="ml-2 text-sm text-[var(--syn-text-secondary)]">
                Carregando artigos...
              </span>
            </div>
          ) : null}

          {!isLoadingArticles && articles.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => handleReviewArticle(article)}
                  onChangeStatus={(status) =>
                    handleUpdateArticleStatus(article, status)
                  }
                  onManualDecision={openDecisionDialog}
                  onDelete={() => handleDeleteArticle(article)}
                  onEdit={() => handleEditArticle(article)}
                  onUploadPDF={() => {
                    setArticleToUploadPdf(article);
                    setShowUploadPdfModal(true);
                  }}
                />
              ))}
            </div>
          ) : null}

          {!isLoadingArticles && articles.length === 0 ? (
            <ArticleListEmptyState
              filterStatus={filterStatus}
              searchTerm={searchTerm}
            />
          ) : null}
        </>
      )}

      <NewArticleModal
        isOpen={showNewArticleModal}
        onClose={() => setShowNewArticleModal(false)}
        onSuccess={handleNewArticleComplete}
        projectId={project.id}
      />

      <ImportBibTeXModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportComplete}
        projectId={project.id}
      />

      <EditArticleModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setArticleToEdit(null);
        }}
        onSuccess={handleEditSuccess}
        project={project}
        article={articleToEdit}
      />

      <UploadPDFModal
        isOpen={showUploadPdfModal}
        onClose={() => {
          setShowUploadPdfModal(false);
          setArticleToUploadPdf(null);
        }}
        onSuccess={handleUploadPdfSuccess}
        project={project}
        article={articleToUploadPdf}
      />

      <ArticleDecisionDialog
        article={decisionArticle}
        researchQuestions={project?.researchQuestions || []}
        initialDecision={decisionInitialValue}
        isOpen={isDecisionDialogOpen}
        isSaving={isSavingDecision}
        onClose={closeDecisionDialog}
        onSubmit={submitDecision}
      />
    </div>
  );
}

export default ProjectArticles;
