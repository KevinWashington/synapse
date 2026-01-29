import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjetoCard, NovoProjetoModal, projectService } from "@/features/projects";
import {
  FolderIcon,
  PlusIcon,
  SearchIcon,
  FilterIcon,
  RefreshCwIcon,
} from "lucide-react";
import { PageHeader, LoadingState, EmptyState } from "@/components/layout";
import { toast } from "@/lib/toast";

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
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleDeletarProjeto = async (projeto) => {
    if (!confirm(`Tem certeza que deseja deletar o projeto "${projeto.title}"?`)) {
      return;
    }
    try {
      await projectService.deleteProject(projeto.id);
      toast.success("Projeto deletado com sucesso!");
      loadProjects();
    } catch (err) {
      console.error("Erro ao deletar projeto:", err);
      toast.error("Erro ao deletar projeto");
    }
  };

  const handleProjetoClick = (projeto) => {
    navigate(`/projetos/${projeto.id}`);
  };

  // Loading inicial
  if (loading && projetos.length === 0) {
    return <LoadingState message="Carregando projetos..." fullPage />;
  }

  return (
    <div className="space-y-6">
      {/* Header com título e ações */}
      <PageHeader
        title="Projetos"
        actions={
          <>
            <Button variant="outline" onClick={() => loadProjects()} disabled={loading}>
              <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              className="flex items-center gap-2"
              onClick={() => setShowNovoProjetoModal(true)}
            >
              <PlusIcon className="h-4 w-4" />
              Novo Projeto
            </Button>
          </>
        }
      >
        {/* Barra de pesquisa e filtros inline */}
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
      </PageHeader>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Erro ao carregar projetos</p>
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadProjects()}
            className="mt-2"
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Grid de projetos */}
      {projetos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projetos.map((projeto) => (
            <ProjetoCard
              key={projeto.id}
              projeto={projeto}
              onEditar={() => { }}
              onDeletar={handleDeletarProjeto}
              onClick={handleProjetoClick}
            />
          ))}
        </div>
      )}

      {/* Loading adicional (paginação) */}
      {loading && projetos.length > 0 && <LoadingState />}

      {/* Empty state */}
      {!loading && projetos.length === 0 && (
        <EmptyState
          icon={FolderIcon}
          title={
            error
              ? "Não foi possível carregar os projetos"
              : "Nenhum projeto encontrado"
          }
          description={
            searchTerm || filterStatus !== "todos"
              ? "Tente ajustar os filtros de pesquisa"
              : "Comece criando seu primeiro projeto de revisão literária"
          }
          actionLabel="Criar Primeiro Projeto"
          onAction={() => setShowNovoProjetoModal(true)}
        />
      )}

      {/* Paginação */}
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
        onSuccess={() => loadProjects()}
      />
    </div>
  );
}

export default Projetos;
