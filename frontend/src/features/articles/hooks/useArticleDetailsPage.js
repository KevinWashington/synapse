import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { articleService } from "@features/articles/services/articleService";
import { projectService } from "@features/projects/services/projectService";
import { toast } from "@/lib/toast";

function useArticleDetailsPage() {
  const { projectId, articleId } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [project, setProject] = useState(null);
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
      setError(currentError.message || "Erro ao carregar artigo");
    } finally {
      setLoading(false);
    }
  }, [articleId, projectId]);

  const fetchProject = useCallback(async () => {
    try {
      const projectData = await projectService.getProjectById(projectId);
      setProject(projectData);
    } catch (currentError) {
      console.error("Erro ao carregar contexto do projeto:", currentError);
    }
  }, [projectId]);

  const fetchPdfData = useCallback(async () => {
    if (!article || article.hasPdf === false) {
      return;
    }
    try {
      const buffer = await articleService.getPdfData(projectId, articleId);
      setPdfData(buffer);
    } catch (currentError) {
      console.error("Erro ao obter PDF:", currentError);
    }
  }, [article, articleId, projectId]);

  useEffect(() => {
    fetchArticle();
    fetchProject();
  }, [fetchArticle, fetchProject]);

  useEffect(() => {
    fetchPdfData();
  }, [fetchPdfData]);

  const refreshArticle = useCallback(async () => {
    await fetchArticle();
    await fetchPdfData();
  }, [fetchArticle, fetchPdfData]);

  const handleScreeningDecision = useCallback(
    async (payload) => {
      try {
        const updated = await articleService.submitScreeningDecision(projectId, articleId, payload);
        setArticle(updated);
        toast.success("Decisao de screening registrada.");
        return updated;
      } catch (currentError) {
        toast.error("Erro ao registrar screening: " + currentError.message);
        throw currentError;
      }
    },
    [articleId, projectId]
  );

  const handleEligibilityDecision = useCallback(
    async (payload) => {
      try {
        const updated = await articleService.submitEligibilityDecision(projectId, articleId, payload);
        setArticle(updated);
        toast.success("Decisao de elegibilidade registrada.");
        return updated;
      } catch (currentError) {
        toast.error("Erro ao registrar elegibilidade: " + currentError.message);
        throw currentError;
      }
    },
    [articleId, projectId]
  );

  const handleSaveNotes = useCallback(
    async (notes) => {
      try {
        const updated = await articleService.updateArticleNotes(projectId, articleId, notes);
        setArticle(updated);
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
    handleDeleteArticle,
    handleEligibilityDecision,
    handleSaveNotes,
    handleScreeningDecision,
    loading,
    navigate,
    pdfData,
    project,
    projectId,
    refreshArticle,
    rightTab,
    setRightTab,
  };
}

export default useArticleDetailsPage;
