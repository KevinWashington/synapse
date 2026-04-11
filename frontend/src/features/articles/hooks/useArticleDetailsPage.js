import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { articleService } from "@features/articles/services/articleService";
import { toast } from "@/lib/toast";

function useArticleDetailsPage() {
  const { projectId, articleId } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [rightTab, setRightTab] = useState("notas");

  const fetchArticle = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const articleData = await articleService.getArticleById(projectId, articleId);
      setArticle(articleData);
    } catch (currentError) {
      setError(currentError.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [articleId, projectId]);

  const fetchPdfData = useCallback(async () => {
    if (!article || article.hasPdf === false || pdfData) {
      return;
    }

    try {
      const pdfBuffer = await articleService.getPdfData(projectId, articleId);
      if (!pdfBuffer) {
        setArticle((current) =>
          current ? { ...current, hasPdf: false } : current
        );
        return;
      }
      setPdfData(pdfBuffer);
    } catch (currentError) {
      console.error("Erro inesperado ao obter PDF:", currentError);
    }
  }, [article, articleId, pdfData, projectId]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  useEffect(() => {
    if (article) {
      fetchPdfData();
    }
  }, [article, fetchPdfData]);

  const handleChangeStatus = useCallback(
    async (nextStatus) => {
      try {
        await articleService.updateArticleStatus(projectId, articleId, nextStatus);
        setArticle((current) => ({ ...current, status: nextStatus }));
        toast.success(`Status atualizado para ${nextStatus}`);
      } catch (currentError) {
        toast.error("Erro ao atualizar status: " + currentError.message);
      }
    },
    [articleId, projectId]
  );

  const handleSaveNotes = useCallback(
    async (notes) => {
      try {
        await articleService.updateArticleNotes(projectId, articleId, notes);
        setArticle((current) => ({ ...current, notas: notes }));
        toast.success("Notas salvas com sucesso!");
      } catch (currentError) {
        toast.error("Erro ao salvar notas: " + currentError.message);
      }
    },
    [articleId, projectId]
  );

  const handleDeleteArticle = useCallback(async () => {
    if (!article) {
      return;
    }

    if (!confirm(`Tem certeza que deseja deletar o artigo "${article.title}"?`)) {
      return;
    }

    try {
      await articleService.deleteArticle(projectId, articleId);
      toast.success("Artigo deletado com sucesso!");
      navigate(`/projetos/${projectId}`);
    } catch (currentError) {
      toast.error("Erro ao deletar artigo: " + currentError.message);
    }
  }, [article, articleId, navigate, projectId]);

  const handleAddNote = useCallback((note) => {
    setArticle((current) => ({
      ...current,
      notas: current?.notas ? `${current.notas}\n${note}` : note,
    }));
  }, []);

  return {
    article,
    articleId,
    error,
    handleAddNote,
    handleChangeStatus,
    handleDeleteArticle,
    handleSaveNotes,
    loading,
    navigate,
    pdfData,
    projectId,
    rightTab,
    setRightTab,
  };
}

export default useArticleDetailsPage;
