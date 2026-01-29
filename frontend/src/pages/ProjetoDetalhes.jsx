import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanejamentoProjeto, projectService } from "@/features/projects";
import { ArtigosProjeto } from "@/features/articles";
import {
  ArrowLeftIcon,
  FileTextIcon,
  PencilIcon,
  TrashIcon,
  AlertTriangleIcon,
  MoreVerticalIcon,

  ClipboardListIcon,
  BookOpenIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, LoadingState, EmptyState } from "@/components/layout";
import { toast } from "@/lib/toast";

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
    navigate(`/projetos/${projeto.id}/editar`);
  };

  const handleDeletarProjeto = async () => {
    if (!confirm(`Tem certeza que deseja deletar o projeto "${projeto.title}"?`)) {
      return;
    }
    try {
      await projectService.deleteProject(projeto.id);
      navigate("/projetos");
    } catch (err) {
      toast.error("Erro ao deletar projeto: " + err.message);
    }
  };

  // Loading State
  if (loading) {
    return <LoadingState message="Carregando projeto..." fullPage />;
  }

  // Error State
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

  // Not Found State
  if (!projeto) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title="Projeto não encontrado"
        description="O projeto que você está procurando não existe ou foi removido."
        actionLabel="Voltar para Projetos"
        onAction={() => navigate("/projetos")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header do projeto */}
      <PageHeader
        title={projeto.title}
        description={projeto.objetivo}
        actions={
          <>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEditarProjeto}>
                  <PencilIcon className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-500"
                  onClick={handleDeletarProjeto}
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Deletar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Abas */}
      <Tabs defaultValue="planejamento" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
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
