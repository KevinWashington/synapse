function ArticleGraphNodeDetails({ selectedNode }) {
  if (!selectedNode) {
    return null;
  }

  const kind = String(selectedNode.kind || "article");
  const kindLabel =
    kind === "author"
      ? "Autor"
      : kind === "keyword"
        ? "Keyword"
        : kind === "venue"
          ? "Venue"
          : "Artigo";

  return (
    <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--syn-text-secondary)]">
        {kindLabel}
      </p>
      <p className="truncate text-sm font-semibold text-[var(--syn-text-primary)]">
        {selectedNode.title}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--syn-text-secondary)]">
        {kind === "article" && selectedNode.authors ? (
          <span>Autores: {selectedNode.authors}</span>
        ) : null}
        {selectedNode.year ? <span>Ano: {selectedNode.year}</span> : null}
        {kind === "article" && selectedNode.methodology ? (
          <span>Metodologia: {selectedNode.methodology}</span>
        ) : null}
        {kind === "article" && selectedNode.domain ? (
          <span>Domínio: {selectedNode.domain}</span>
        ) : null}
      </div>
    </div>
  );
}

export default ArticleGraphNodeDetails;
