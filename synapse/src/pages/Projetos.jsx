import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import ProjetoCard from "../components/ProjetoCard";
import NovoProjetoModal from "../components/NovoProjetoModal";
import {
  FolderIcon,
  PlusIcon,
  SearchIcon,
  FilterIcon,
  LoaderIcon,
  RefreshCwIcon,
} from "lucide-react";
import { projectService } from "../services/projetosService.js";

function Projetos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [showNovoProjetoModal, setShowNovoProjetoModal] = useState(false);

  const loadProjects = useCallback(
    async (filters = {}) => {
      try {
        setLoading(true);
        setError(null);

        const params = {
          page: 1,
          limit: 20,
          ...filters,
        };

        if (debouncedSearchTerm) params.search = debouncedSearchTerm;
        if (filterStatus !== "todos") params.status = filterStatus;

        const response = await projectService.getAllProjects(params);

        setProjetos(response.projects || []);
        setPagination(response.pagination || {});
      } catch (err) {
        console.error("Erro ao carregar projetos:", err);
        setError(err.message || "Erro ao carregar projetos");
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearchTerm, filterStatus]
  );

  useEffect(() => {
    loadProjects().then((r) => r);
  }, [loadProjects]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // Atraso de 500ms

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const handleEditarProjeto = async (projeto) => {
    console.log("Editar projeto:", projeto);
  };

  const handleDeletarProjeto = async (projeto) => {
    if (
      !confirm(`Tem certeza que deseja deletar o projeto "${projeto.title}"?`)
    ) {
      return;
    }

    try {
      await projectService.deleteProject(projeto._id);
      alert("Projeto deletado com sucesso!");
      loadProjects().then((r) => r);
    } catch (err) {
      console.error("Erro ao deletar projeto:", err);
      alert("Erro ao deletar projeto");
    }
  };

  const handleProjetoClick = (projeto) => {
    navigate(`/projetos/${projeto._id}`);
  };

  const handleNovoProjeto = () => {
    setShowNovoProjetoModal(true);
  };

  const handleNovoProjetoSuccess = () => {
    loadProjects();
  };

  const handleRefresh = () => {
    loadProjects();
  };

  if (loading && projetos.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <LoaderIcon className="h-6 w-6 animate-spin" />
          <span>Carregando projetos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCwIcon
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
          <Button
            className="flex items-center gap-2"
            onClick={handleNovoProjeto}
          >
            <PlusIcon className="h-4 w-4" />
            Novo Projeto
          </Button>
        </div>
      </div>

      {/* Barra de pesquisa e filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Pesquisar projetos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ideia">Ideia</SelectItem>
              <SelectItem value="em-progresso">Em Progresso</SelectItem>
              <SelectItem value="completado">Completado</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Erro ao carregar projetos</p>
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="mt-2"
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Grid de projetos */}
      {projetos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projetos.map((projeto) => (
            <ProjetoCard
              key={projeto._id}
              projeto={projeto}
              onEditar={handleEditarProjeto}
              onDeletar={handleDeletarProjeto}
              onClick={handleProjetoClick}
            />
          ))}
        </div>
      )}

      {/* Loading adicional */}
      {loading && projetos.length > 0 && (
        <div className="flex justify-center py-4">
          <LoaderIcon className="h-6 w-6 animate-spin" />
        </div>
      )}

      {/* Mensagem quando não há projetos */}
      {!loading && projetos.length === 0 && (
        <div className="text-center py-12">
          <FolderIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {error
              ? "Não foi possível carregar os projetos"
              : "Nenhum projeto encontrado"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || filterStatus !== "todos"
              ? "Tente ajustar os filtros de pesquisa"
              : "Comece criando seu primeiro projeto de revisão literária"}
          </p>
          <Button
            className="flex items-center gap-2 mx-auto"
            onClick={handleNovoProjeto}
          >
            <PlusIcon className="h-4 w-4" />
            Criar Primeiro Projeto
          </Button>
        </div>
      )}

      {/* Paginação (se necessário) */}
      {pagination.total > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <span className="text-sm text-muted-foreground">
            Página {pagination.current} de {pagination.total}
          </span>
        </div>
      )}

      {/* Modal Novo Projeto */}
      <NovoProjetoModal
        isOpen={showNovoProjetoModal}
        onClose={() => setShowNovoProjetoModal(false)}
        onSuccess={handleNovoProjetoSuccess}
      />
    </div>
  );
}

export default Projetos;
