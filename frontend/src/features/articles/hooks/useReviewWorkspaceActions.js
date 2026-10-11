import { useCallback, useState } from "react";
import { articleService } from "../services/articleService";

export function useReviewWorkspaceActions({ project, article, refreshArticle, refreshQueue, onGraphNeedsRefresh }) {
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);
  const exportStage = useCallback(() => articleService.exportSelectionReport(project.id, "csv"), [project?.id]);
  const saveEvidence = useCallback(async (payload) => {
    if (!project?.id || !article?.id) return false;
    setIsSavingEvidence(true);
    try {
      const updated = await articleService.updateArticleEvidence(project.id, article.id, payload);
      await refreshQueue?.();
      await refreshArticle?.();
      onGraphNeedsRefresh?.();
      return updated;
    } finally { setIsSavingEvidence(false); }
  }, [article?.id, onGraphNeedsRefresh, project?.id, refreshArticle, refreshQueue]);
  return { exportStage, saveEvidence, isSavingEvidence };
}
