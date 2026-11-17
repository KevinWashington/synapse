// Keep in sync with backend/app/schemas/article.py (ARTICLE_*_MAX).
export const ARTICLE_FIELD_LIMITS = {
  title: 1000,
  authors: 5000,
  journal: 500,
  doi: 255,
  abstract: 20000,
  keywords: 2000,
  pages: 50,
  volume: 50,
  number: 50,
  issn: 50,
};

/**
 * Trim an imported record to the server limits instead of rejecting the whole batch.
 * Returns the fitted record and the names of the fields that were shortened.
 */
export function fitArticleToLimits(article) {
  const fitted = { ...article };
  const truncated = [];
  for (const [field, limit] of Object.entries(ARTICLE_FIELD_LIMITS)) {
    const value = fitted[field];
    if (typeof value === "string" && value.length > limit) {
      fitted[field] = value.slice(0, limit).trimEnd();
      truncated.push(field);
    }
  }
  return { article: fitted, truncated };
}
