const phases = new Set(["identification", "screening", "eligibility", "included"]);
const tabs = new Set(["notas", "chat", "extracao"]);
const key = (userId) => `synapse:last-reading:v1:${userId}`;
const validId = (id) => /^\d+$/.test(String(id)) && Number(id) > 0;
function valid(reference) {
  return reference && validId(reference.projectId) && validId(reference.articleId) && phases.has(reference.phase) && tabs.has(reference.workspace);
}
export function saveReadingResume(userId, reference) {
  if (!userId || !valid(reference)) return;
  const { projectId, articleId, phase, workspace } = reference;
  try { localStorage.setItem(key(userId), JSON.stringify({ projectId, articleId, phase, workspace, savedAt: new Date().toISOString() })); } catch { /* Storage is optional. */ }
}
export function readReadingResume(userId) {
  if (!userId) return null;
  try {
    const reference = JSON.parse(localStorage.getItem(key(userId)));
    return valid(reference) && Number.isFinite(Date.parse(reference.savedAt)) ? reference : null;
  } catch { return null; }
}
export function clearReadingResume(userId) {
  try { localStorage.removeItem(key(userId)); } catch { /* Storage is optional. */ }
}
export function readingUrl(article, workspace = "notas", assigned = false) {
  const phase = article.reviewOutcome === "included" ? "included" : phases.has(article.currentPhase || article.phase) ? article.currentPhase || article.phase : "identification";
  const params = new URLSearchParams({ flow: phase, workspace: phase === "included" ? "extracao" : tabs.has(workspace) && workspace !== "extracao" ? workspace : "notas" });
  if (assigned) params.set("assignedToMe", "1");
  return `/projetos/${article.projectId}/artigos/${article.id ?? article.articleId}?${params}`;
}
