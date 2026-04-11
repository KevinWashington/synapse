import { FileTextIcon } from "lucide-react";

function ArticleListEmptyState({ filterStatus, searchTerm }) {
  return (
    <div className="py-12 text-center">
      <FileTextIcon className="mx-auto mb-3 h-12 w-12 text-[var(--syn-text-secondary)]" />
      <h3 className="mb-1 text-sm font-medium text-[var(--syn-text-primary)]">
        Nenhum artigo encontrado
      </h3>
      <p className="text-xs text-[var(--syn-text-secondary)]">
        {searchTerm || filterStatus !== "todos"
          ? "Tente ajustar os filtros de pesquisa"
          : "Adicione artigos usando os botões acima"}
      </p>
    </div>
  );
}

export default ArticleListEmptyState;
