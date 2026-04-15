import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import ArticleListEmptyState from "@features/articles/components/ArticleListEmptyState";
import ArticleListFilters from "@features/articles/components/ArticleListFilters";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ClockIcon,
  EditIcon,
  EyeIcon,
  FileIcon,
  LoaderIcon,
  MoreVerticalIcon,
  Sparkles,
  TrashIcon,
  XIcon,
} from "lucide-react";

function SortIcon({ column, sortColumn, sortDirection }) {
  if (sortColumn !== column) {
    return <ArrowUpDownIcon className="ml-1 h-3 w-3 opacity-40" />;
  }

  return sortDirection === "asc" ? (
    <ArrowUpIcon className="ml-1 h-3 w-3" />
  ) : (
    <ArrowDownIcon className="ml-1 h-3 w-3" />
  );
}

function ArticleSortHeader({
  children,
  column,
  onSort,
  sortColumn,
  sortDirection,
  widthClassName,
}) {
  return (
    <TableHead
      className={`${widthClassName} cursor-pointer select-none transition-colors hover:bg-[var(--syn-bg-secondary)]`}
      onClick={() => onSort(column)}
    >
      <span className="flex items-center">
        {children}
        <SortIcon
          column={column}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
        />
      </span>
    </TableHead>
  );
}

function ArticleStatusMenuItems({ article, onUpdateStatus }) {
  return (
    <>
      <DropdownMenuItem>
        <span className="mr-2">Status:</span>
      </DropdownMenuItem>

      {article.status !== "analisado" ? (
        <DropdownMenuItem onClick={() => onUpdateStatus(article, "analisado")}>
          <CheckIcon className="mr-2 h-4 w-4 text-green-600" />
          Marcar como analisado
        </DropdownMenuItem>
      ) : null}

      {article.status !== "pendente" ? (
        <DropdownMenuItem onClick={() => onUpdateStatus(article, "pendente")}>
          <ClockIcon className="mr-2 h-4 w-4 text-amber-600" />
          Marcar como pendente
        </DropdownMenuItem>
      ) : null}

      {article.status !== "excluido" ? (
        <DropdownMenuItem onClick={() => onUpdateStatus(article, "excluido")}>
          <XIcon className="mr-2 h-4 w-4 text-red-600" />
          Marcar como excluído
        </DropdownMenuItem>
      ) : null}
    </>
  );
}

function ArticleDecisionMenuItems({ article, onManualDecision }) {
  return (
    <>
      <DropdownMenuItem>
        <span className="mr-2">Triagem manual:</span>
      </DropdownMenuItem>

      <DropdownMenuItem onClick={() => onManualDecision(article, "incluido")}>
        <CheckIcon className="mr-2 h-4 w-4 text-green-600" />
        Incluir no estudo
      </DropdownMenuItem>

      <DropdownMenuItem onClick={() => onManualDecision(article, "excluido")}>
        <XIcon className="mr-2 h-4 w-4 text-red-600" />
        Excluir do estudo
      </DropdownMenuItem>

      <DropdownMenuItem onClick={() => onManualDecision(article, "pendente")}>
        <ClockIcon className="mr-2 h-4 w-4 text-amber-600" />
        Manter como pendente
      </DropdownMenuItem>
    </>
  );
}

function ArticlesTable({
  articles,
  filterStatus,
  handleDeleteArticle,
  handleEditArticle,
  handleManualDecision,
  handleReviewArticle,
  handleUpdateArticleStatus,
  isLoadingArticles,
  searchTerm,
  setFilterStatus,
  setSearchTerm,
  statusList,
}) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  function handleSort(column) {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }

      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  }

  const sortedArticles = useMemo(() => {
    if (!sortColumn) {
      return articles;
    }

    return [...articles].sort((articleA, articleB) => {
      let valueA;
      let valueB;

      switch (sortColumn) {
        case "title":
          valueA = (articleA.title || "").toLowerCase();
          valueB = (articleB.title || "").toLowerCase();
          break;
        case "authors":
          valueA = (articleA.authors || "").toLowerCase();
          valueB = (articleB.authors || "").toLowerCase();
          break;
        case "year":
          valueA = articleA.year || 0;
          valueB = articleB.year || 0;
          break;
        case "journal":
          valueA = (articleA.journal || "").toLowerCase();
          valueB = (articleB.journal || "").toLowerCase();
          break;
        case "status":
          valueA = articleA.status || "";
          valueB = articleB.status || "";
          break;
        case "aiRelevanceScore":
          valueA = articleA.aiRelevanceScore ?? -1;
          valueB = articleB.aiRelevanceScore ?? -1;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) {
        return sortDirection === "asc" ? -1 : 1;
      }

      if (valueA > valueB) {
        return sortDirection === "asc" ? 1 : -1;
      }

      return 0;
    });
  }, [articles, sortColumn, sortDirection]);

  return (
    <div className="space-y-4">
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
        <div className="overflow-x-auto rounded-[var(--syn-radius-card)] border border-[var(--syn-border)]">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <ArticleSortHeader
                  column="title"
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  widthClassName="w-[300px] min-w-[250px]"
                >
                  Título
                </ArticleSortHeader>
                <ArticleSortHeader
                  column="authors"
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  widthClassName="w-[200px] min-w-[150px]"
                >
                  Autores
                </ArticleSortHeader>
                <ArticleSortHeader
                  column="year"
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  widthClassName="w-[80px]"
                >
                  Ano
                </ArticleSortHeader>
                <ArticleSortHeader
                  column="journal"
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  widthClassName="w-[200px] min-w-[150px]"
                >
                  Revista/Conferência
                </ArticleSortHeader>
                <ArticleSortHeader
                  column="status"
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  widthClassName="w-[120px]"
                >
                  Status
                </ArticleSortHeader>
                <ArticleSortHeader
                  column="aiRelevanceScore"
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  widthClassName="w-[100px]"
                >
                  Relevância IA
                </ArticleSortHeader>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {sortedArticles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="max-w-[300px] font-medium">
                    <div className="flex items-center gap-2">
                      <FileIcon
                        className={`h-4 w-4 flex-shrink-0 ${
                          article.hasPdf
                            ? "text-blue-500"
                            : "text-[var(--syn-text-secondary)]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block line-clamp-2" title={article.title}>
                          {article.title}
                        </span>
                      </div>
                      {!article.hasPdf ? (
                        <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-600">
                          Sem PDF
                        </span>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="max-w-[200px]">
                    <span className="block truncate line-clamp-1" title={article.authors}>
                      {article.authors}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">{article.year}</TableCell>

                  <TableCell className="max-w-[200px]">
                    <span className="block truncate line-clamp-1" title={article.journal}>
                      {article.journal}
                    </span>
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={article.status} />
                  </TableCell>

                  <TableCell>
                    {article.aiRelevanceScore !== undefined &&
                    article.aiRelevanceScore !== null ? (
                      <div className="space-y-1">
                        <div
                          className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold transition-colors ${
                            article.aiSuggestedStatus === "incluido"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                          title={`Sugestão: ${
                            article.aiSuggestedStatus === "incluido"
                              ? "Incluir"
                              : "Excluir"
                          }\nRQs sugeridas: ${(article.aiSuggestedRQs || []).join(", ") || "nenhuma"}\n${article.aiEvaluation}`}
                        >
                          <Sparkles className="h-3 w-3" />
                          {article.aiRelevanceScore}%
                        </div>

                        {(article.aiSuggestedRQs || []).length ? (
                          <div className="flex flex-wrap gap-1">
                            {article.aiSuggestedRQs.map((rqNumber) => (
                              <span
                                key={`rq-suggested-${article.id}-${rqNumber}`}
                                className="rounded bg-[var(--syn-bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--syn-text-secondary)]"
                              >
                                {`RQ ${rqNumber}`}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {article.manualDecision ? (
                          <div className="text-[11px] text-[var(--syn-text-secondary)]">
                            Manual: {article.manualDecision}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs italic text-[var(--syn-text-secondary)]">
                        N/A
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleReviewArticle(article)}>
                          <EyeIcon className="mr-2 h-4 w-4" />
                          Revisar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditArticle(article)}>
                          <EditIcon className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>

                        <ArticleStatusMenuItems
                          article={article}
                          onUpdateStatus={handleUpdateArticleStatus}
                        />

                        <ArticleDecisionMenuItems
                          article={article}
                          onManualDecision={handleManualDecision}
                        />

                        <DropdownMenuItem
                          onClick={() => handleDeleteArticle(article)}
                          className="text-red-600"
                        >
                          <TrashIcon className="mr-2 h-4 w-4" />
                          Deletar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {!isLoadingArticles && articles.length === 0 ? (
        <ArticleListEmptyState
          filterStatus={filterStatus}
          searchTerm={searchTerm}
        />
      ) : null}
    </div>
  );
}

export default ArticlesTable;
