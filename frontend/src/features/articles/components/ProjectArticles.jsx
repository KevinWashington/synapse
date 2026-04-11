import { useCallback, useState } from "react";
import { GridIcon, LoaderIcon, PlusIcon, TableIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ArticleListEmptyState from "@features/articles/components/ArticleListEmptyState";
import ArticleListFilters from "@features/articles/components/ArticleListFilters";
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
  const [articleToEdit, setArticleToEdit] = useState(null);
  const [articleToUploadPdf, setArticleToUploadPdf] = useState(null);

  const {
    articles,
    filterStatus,
    handleDeleteArticle,
    handleEditSuccess,
    handleImportSuccess,
    handleNewArticleSuccess,
    handleUpdateArticleStatus,
    handleUploadPdfSuccess,
    isLoadingArticles,
    pagination,
    searchTerm,
    setFilterStatus,
    setSearchTerm,
    statusList,
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

      {viewMode === "tabela" ? (
        <ArticlesTable
          articles={articles}
          filterStatus={filterStatus}
          handleDeleteArticle={handleDeleteArticle}
          handleEditArticle={handleEditArticle}
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
    </div>
  );
}

export default ProjectArticles;
