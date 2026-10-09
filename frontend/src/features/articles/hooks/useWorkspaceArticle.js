import { useCallback, useEffect, useRef, useState } from "react";
import { articleService } from "@features/articles/services/articleService";

const DETAIL_STAGES = new Set(["eligibility", "included"]);

export function useWorkspaceArticle({ projectId, article, activeStage }) {
  const [loadedDetail, setLoadedDetail] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const requestSequence = useRef(0);
  const articleRef = useRef(article);
  articleRef.current = article;

  const refreshArticle = useCallback(async () => {
    const requestId = ++requestSequence.current;
    const sourceArticle = articleRef.current;
    setLoadedDetail(null);
    setPdfData(null);
    setIsLoadingPdf(false);

    if (!sourceArticle?.id || !projectId || !DETAIL_STAGES.has(activeStage)) {
      setIsLoadingArticle(false);
      return sourceArticle || null;
    }

    setIsLoadingArticle(true);
    try {
      const detail = await articleService.getArticleById(projectId, sourceArticle.id);
      if (requestSequence.current !== requestId) return null;

      const mergedArticle = { ...sourceArticle, ...detail };
      setLoadedDetail(detail);
      setIsLoadingArticle(false);

      if (activeStage !== "eligibility" || !mergedArticle.hasPdf) {
        return mergedArticle;
      }

      setIsLoadingPdf(true);
      try {
        const buffer = await articleService.getPdfData(projectId, sourceArticle.id);
        if (requestSequence.current === requestId) setPdfData(buffer || null);
      } catch (error) {
        if (requestSequence.current === requestId) {
          console.error("Erro ao carregar PDF no workspace:", error);
        }
      } finally {
        if (requestSequence.current === requestId) setIsLoadingPdf(false);
      }
      return mergedArticle;
    } catch (error) {
      if (requestSequence.current === requestId) {
        console.error("Erro ao carregar artigo no workspace:", error);
        setIsLoadingArticle(false);
      }
      return null;
    }
  }, [activeStage, article?.id, projectId]);

  useEffect(() => {
    refreshArticle();
    return () => {
      requestSequence.current += 1;
    };
  }, [refreshArticle]);

  return {
    article: article && loadedDetail && String(loadedDetail.id) === String(article.id)
      ? { ...article, ...loadedDetail }
      : article || null,
    pdfData,
    isLoadingArticle,
    isLoadingPdf,
    refreshArticle,
  };
}
