import { useCallback, useMemo } from "react";
import { useRemoteResource } from "@/hooks/useRemoteResource";
import { articleService } from "../services/articleService";

const DETAIL_STAGES = new Set(["eligibility", "included"]);
export function useWorkspaceArticle({ projectId, article, activeStage }) {
  const selectedArticleId = article?.id;
  const needsDetail = Boolean(projectId && selectedArticleId && DETAIL_STAGES.has(activeStage));
  const loadDetail = useCallback(() => articleService.getArticleById(projectId, selectedArticleId), [projectId, selectedArticleId]);
  const detail = useRemoteResource({ key: `${projectId}:${selectedArticleId}:${activeStage}`, enabled: needsDetail, load: loadDetail });
  const resolvedArticle = useMemo(() => article && detail.data ? { ...article, ...detail.data } : article || null, [article, detail.data]);
  const loadPdf = useCallback(() => articleService.getPdfData(projectId, selectedArticleId), [projectId, selectedArticleId]);
  const pdf = useRemoteResource({ key: `${projectId}:${selectedArticleId}`, enabled: needsDetail && activeStage === "eligibility" && Boolean(detail.data?.hasPdf), load: loadPdf });
  const reloadDetail = detail.reload;
  const reloadPdf = pdf.reload;
  const refreshArticle = useCallback(async () => {
    if (!needsDetail) return article || null;
    const updated = await reloadDetail();
    if (updated?.hasPdf && activeStage === "eligibility") await reloadPdf();
    return updated ? { ...article, ...updated } : null;
  }, [activeStage, article, needsDetail, reloadDetail, reloadPdf]);
  return {
    article: resolvedArticle, pdfData: pdf.data, isLoadingArticle: detail.loading,
    isLoadingPdf: pdf.loading, error: detail.error || pdf.error,
    isReady: !needsDetail || Boolean(detail.data && !detail.loading && !detail.error && !pdf.error), refreshArticle,
  };
}
