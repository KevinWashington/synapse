import { useState, useEffect, useCallback } from "react";
import { articleService } from "../services/artigosService.js";

export const useArtigos = (projeto) => {
  const [loadingArtigos, setLoadingArtigos] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [artigos, setArtigos] = useState([]);
  const [pagination, setPagination] = useState({});

  const fetchArtigos = useCallback(
    async (filters = {}) => {
      if (!projeto?._id) return;

      try {
        setLoadingArtigos(true);

        const params = {
          page: 1,
          limit: 50,
          ...filters,
        };

        if (searchTerm) params.search = searchTerm;
        if (filterStatus !== "todos") params.status = filterStatus;

        const response = await articleService.getArticlesByProject(
          projeto._id,
          params
        );

        setArtigos(response.articles || []);
        setPagination(response.pagination || {});
      } catch (err) {
        console.error("Erro ao carregar artigos:", err);
      } finally {
        setLoadingArtigos(false);
      }
    },
    [projeto?._id, searchTerm, filterStatus]
  );

  // Buscar artigos quando o projeto muda
  useEffect(() => {
    if (projeto) {
      fetchArtigos();
    }
  }, [projeto, fetchArtigos]);

  // Debounce para busca e filtros
  useEffect(() => {
    if (projeto) {
      const timeoutId = setTimeout(() => {
        fetchArtigos();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, filterStatus, projeto, fetchArtigos]);

  const handleAtualizarStatusArtigo = async (artigo, novoStatus) => {
    try {
      await articleService.updateArticleStatus(
        projeto._id,
        artigo._id,
        novoStatus
      );
      fetchArtigos();
      alert(`Status do artigo atualizado para ${novoStatus}`);
    } catch (err) {
      console.error("Erro ao atualizar status do artigo:", err);
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  const handleDeletarArtigo = async (artigo) => {
    if (
      !confirm(`Tem certeza que deseja deletar o artigo "${artigo.title}"?`)
    ) {
      return;
    }

    try {
      await articleService.deleteArticle(projeto._id, artigo._id);
      alert("Artigo deletado com sucesso!");
      fetchArtigos();
    } catch (err) {
      console.error("Erro ao deletar artigo:", err);
      alert("Erro ao deletar artigo: " + err.message);
    }
  };

  const handleNovoArtigoSuccess = () => {
    fetchArtigos();
  };

  const handleImportarSuccess = () => {
    fetchArtigos();
  };

  const handleEditarSuccess = () => {
    fetchArtigos();
  };

  const handleUploadPDFSuccess = () => {
    fetchArtigos();
  };

  const statusList = [
    { value: "todos", label: "Todos" },
    { value: "pendente", label: "Pendentes" },
    { value: "analisado", label: "Analisados" },
    { value: "excluido", label: "Excluídos" },
  ];

  return {
    // Estados
    loadingArtigos,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    artigos,
    pagination,

    // Funções
    fetchArtigos,
    handleAtualizarStatusArtigo,
    handleDeletarArtigo,
    handleNovoArtigoSuccess,
    handleImportarSuccess,
    handleEditarSuccess,
    handleUploadPDFSuccess,

    // Constantes
    statusList,
  };
};
