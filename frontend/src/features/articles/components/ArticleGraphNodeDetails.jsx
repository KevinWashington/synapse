function ArticleGraphNodeDetails({ selectedNode }) {
  if (!selectedNode) {
    return null;
  }

  return (
    <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-4 py-3">
      <p className="truncate text-sm font-semibold text-[var(--syn-text-primary)]">
        {selectedNode.title}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--syn-text-secondary)]">
        {selectedNode.authors ? <span>Autores: {selectedNode.authors}</span> : null}
        {selectedNode.year ? <span>Ano: {selectedNode.year}</span> : null}
        {selectedNode.methodology ? (
          <span>Metodologia: {selectedNode.methodology}</span>
        ) : null}
        {selectedNode.domain ? <span>Domínio: {selectedNode.domain}</span> : null}
      </div>
    </div>
  );
}

export default ArticleGraphNodeDetails;
