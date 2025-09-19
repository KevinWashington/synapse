import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import ArtigoCard from "./ArtigoCard";
import NovoArtigoModal from "./NovoArtigoModal";
import {
  PlusIcon,
  SearchIcon,
  FilterIcon,
  FileTextIcon,
  LoaderIcon,
} from "lucide-react";
import { articleService } from "../services/artigosService.js";

function ArtigosProjeto({ projeto, onNavigate }) {
  const [loadingArtigos, setLoadingArtigos] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [artigos, setArtigos] = useState([]);
  const [showNovoArtigoModal, setShowNovoArtigoModal] = useState(false);
  const [pagination, setPagination] = useState({});

  const fetchArtigos = async (filters = {}) => {
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
  };

  useEffect(() => {
    if (projeto) {
      fetchArtigos();
    }
  }, [projeto]);

  useEffect(() => {
    if (projeto) {
      const timeoutId = setTimeout(() => {
        fetchArtigos();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, filterStatus]);

  const handleArtigoClick = (artigo) => {
    onNavigate(`/projetos/${projeto._id}/artigos/${artigo._id}`);
  };

  const handleAdicionarArtigo = () => {
    setShowNovoArtigoModal(true);
  };

  const handleNovoArtigoSuccess = () => {
    fetchArtigos();
  };

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

  const statusList = [
    { value: "todos", label: "Todos" },
    { value: "pendente", label: "Pendentes" },
    { value: "analisado", label: "Analisados" },
    { value: "excluido", label: "Excluídos" },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Artigos do Projeto
            {pagination.totalDocuments > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({pagination.totalDocuments}{" "}
                {pagination.totalDocuments === 1 ? "artigo" : "artigos"})
              </span>
            )}
          </h2>
        </div>
      </div>

      {/* Barra de pesquisa e filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Pesquisar artigos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filtrar por..." />
            </SelectTrigger>
            <SelectContent>
              {statusList.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="flex items-center gap-2"
          onClick={handleAdicionarArtigo}
        >
          <PlusIcon className="h-4 w-4" />
          Adicionar Artigo
        </Button>
      </div>

      {/* Loading para artigos */}
      {loadingArtigos && (
        <div className="flex justify-center items-center py-8">
          <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Carregando artigos...</span>
        </div>
      )}

      {/* Grid de artigos */}
      {!loadingArtigos && artigos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
          {artigos.map((artigo) => (
            <ArtigoCard
              key={artigo._id}
              artigo={artigo}
              onClick={() => handleArtigoClick(artigo)}
              onChangeStatus={(status) =>
                handleAtualizarStatusArtigo(artigo, status)
              }
              onDelete={() => handleDeletarArtigo(artigo)}
            />
          ))}
        </div>
      )}

      {/* Janela vazia */}
      {!loadingArtigos && artigos.length === 0 && (
        <div className="text-center py-12">
          <FileTextIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhum artigo encontrado
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || filterStatus !== "todos"
              ? "Tente ajustar os filtros de pesquisa"
              : "Comece adicionando artigos a este projeto"}
          </p>
          <Button
            className="flex items-center gap-2 mx-auto"
            onClick={handleAdicionarArtigo}
          >
            <PlusIcon className="h-4 w-4" />
            Adicionar {artigos.length === 0 ? "Primeiro " : ""}Artigo
          </Button>
        </div>
      )}

      {/* Modal para adicionar artigo */}
      <NovoArtigoModal
        isOpen={showNovoArtigoModal}
        onClose={() => setShowNovoArtigoModal(false)}
        onSuccess={handleNovoArtigoSuccess}
        projectId={projeto._id}
      />
    </div>
  );
}

export default ArtigosProjeto;
