export function resolveSelectedArticle(articles, selectedArticleId) {
  if (!articles.length) {
    return null;
  }

  return articles.find((article) => article.id === selectedArticleId) || articles[0];
}

export function toggleVisibleSelection(selectedIds, visibleIds) {
  const visible = new Set(visibleIds);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  if (allVisibleSelected) {
    return selectedIds.filter((id) => !visible.has(id));
  }

  return [...new Set([...selectedIds, ...visibleIds])];
}
