import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import PlanejamentoProjeto from "../components/PlanejamentoProjeto";
import ArtigosProjeto from "../components/ArtigosProjeto";
import {
  ArrowLeftIcon,
  FileTextIcon,
  LoaderIcon,
  PencilIcon,
  TrashIcon,
  AlertTriangleIcon,
  MoreVerticalIcon,
  NetworkIcon,
  ClipboardListIcon,
  BookOpenIcon,
} from "lucide-react";
import { projectService } from "../services/projetosService.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.js";

function ProjetoDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [projeto, setProjeto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProjeto = async () => {
      try {
        setLoading(true);
        setError(null);

        const projetoData = await projectService.getProjectById(id);
        setProjeto(projetoData);
      } catch (err) {
        setError(err.message || "Erro ao carregar projeto");
      } finally {
        setLoading(false);
      }
    };

    fetchProjeto();
  }, [id]);

  const handleEditarProjeto = () => {
    navigate(`/projetos/${projeto._id}/editar`);
  };

  const handleDeletarProjeto = async () => {
    if (
      !confirm(`Tem certeza que deseja deletar o projeto "${projeto.title}"?`)
    ) {
      return;
    }

    try {
      await projectService.deleteProject(projeto._id);
      navigate("/projetos");
    } catch (err) {
      alert("Erro ao deletar projeto: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <LoaderIcon className="h-6 w-6 animate-spin" />
          <span>Carregando projeto...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-4">
          <AlertTriangleIcon className="h-12 w-12 mx-auto mb-2" />
          <h2 className="text-xl font-semibold">Erro ao carregar projeto</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button onClick={() => navigate("/projetos")}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Voltar para Projetos
        </Button>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="p-6 text-center">
        <FileTextIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Projeto não encontrado</h2>
        <p className="text-muted-foreground mb-4">
          O projeto que você está procurando não existe ou foi removido.
        </p>
        <Button onClick={() => navigate("/projetos")} className="mt-4">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Voltar para Projetos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {projeto.title}
          </h1>
          <p className="text-muted-foreground mt-1">{projeto.objetivo}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/projetos/${id}/grafo`)}
            className="flex items-center gap-2"
          >
            <NetworkIcon className="h-4 w-4" />
            Ver Grafo
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVerticalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="outline"
                size="sm"
                onClick={handleEditarProjeto}
                className="flex items-center gap-1"
              >
                <PencilIcon className="h-3.5 w-3.5" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="outline"
                size="sm"
                className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 flex items-center gap-1"
                onClick={handleDeletarProjeto}
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Abas */}
      <Tabs defaultValue="planejamento" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="planejamento" className="flex items-center gap-2">
            <ClipboardListIcon className="h-4 w-4" />
            Planejamento
          </TabsTrigger>
          <TabsTrigger value="artigos" className="flex items-center gap-2">
            <BookOpenIcon className="h-4 w-4" />
            Artigos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planejamento" className="mt-6">
          <PlanejamentoProjeto projeto={projeto} />
        </TabsContent>

        <TabsContent value="artigos" className="mt-6">
          <ArtigosProjeto projeto={projeto} onNavigate={navigate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjetoDetalhes;
