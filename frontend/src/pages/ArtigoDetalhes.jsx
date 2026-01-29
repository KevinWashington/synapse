import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftIcon,
  LoaderIcon,
  FileIcon,
  AlertTriangleIcon,
  BoltIcon,
  TrashIcon,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EditorNotas,
  VizualizadorPDF,
  articleService,
} from "@/features/articles";
import { ChatIA } from "@/features/ai";
import { toast } from "@/lib/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function ArtigoDetalhes() {
  const { projetoId, artigoId } = useParams();
  const navigate = useNavigate();
  const [artigo, setArtigo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfData, setPdfData] = useState(null);

  const fetchArtigo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const artigoData = await articleService.getArticleById(
        projetoId,
        artigoId
      );
      setArtigo(artigoData);

      // PDF será carregado apenas quando necessário (visualizador embarcado)
      // Removido carregamento automático para evitar downloads desnecessários
    } catch (err) {
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [projetoId, artigoId]);

  const fetchPdfData = useCallback(async () => {
    if (!artigo || pdfData) return;

    try {
      const pdfUrl = articleService.getPdfUrl(projetoId, artigoId);
      console.log("URL do PDF gerada:", pdfUrl);

      const response = await fetch(pdfUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao baixar PDF: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      setPdfData(arrayBuffer);
    } catch (err) {
      console.error("Erro ao obter PDF:", err);
    }
  }, [artigo, pdfData, projetoId, artigoId]);

  useEffect(() => {
    fetchArtigo();
  }, [fetchArtigo]);

  useEffect(() => {
    if (artigo) {
      fetchPdfData();
    }
  }, [artigo, fetchPdfData]);

  const handleMudarStatus = async (novoStatus) => {
    try {
      await articleService.updateArticleStatus(projetoId, artigoId, novoStatus);
      setArtigo((prevArtigo) => ({
        ...prevArtigo,
        status: novoStatus,
      }));
      toast.success(`Status do artigo atualizado para ${novoStatus}`);
    } catch (err) {
      toast.error("Erro ao atualizar status: " + err.message);
    }
  };

  const handleSalvarNotas = async (notas) => {
    try {
      await articleService.updateArticleNotes(projetoId, artigoId, notas);
      setArtigo((prevArtigo) => ({
        ...prevArtigo,
        notas: notas,
      }));
      toast.success("Notas salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar notas: " + err.message);
    }
  };

  const handleDeletarArtigo = async () => {
    if (
      !confirm(`Tem certeza que deseja deletar o artigo "${artigo.title}"?`)
    ) {
      return;
    }

    try {
      await articleService.deleteArticle(projetoId, artigoId);
      toast.success("Artigo deletado com sucesso!");
      navigate(`/projetos/${projetoId}`);
    } catch (err) {
      console.error("Erro ao deletar artigo:", err);
      toast.error("Erro ao deletar artigo: " + err.message);
    }
  };

  const handleAdicionarNota = (nota) => {
    setArtigo((prevArtigo) => ({
      ...prevArtigo,
      notas: (prevArtigo.notas ? prevArtigo.notas + "\n" : "") + nota,
    }));
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <LoaderIcon className="h-6 w-6 animate-spin" />
          <span>Carregando artigo...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-4">
          <AlertTriangleIcon className="h-12 w-12 mx-auto mb-2" />
          <h2 className="text-xl font-semibold">Erro ao carregar artigo</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button onClick={() => navigate(`/projetos/${projetoId}`)}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Voltar para o Projeto
        </Button>
      </div>
    );
  }

  if (!artigo) {
    return (
      <div className="p-6 text-center">
        <FileIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Artigo não encontrado</h2>
        <p className="text-muted-foreground mb-4">
          O artigo que você está procurando não existe ou foi removido.
        </p>
        <Button
          onClick={() => navigate(`/projetos/${projetoId}`)}
          className="mt-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Voltar para o Projeto
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-160px)]">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold text-foreground">{artigo.title}</h1>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <BoltIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <span>Status</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => handleMudarStatus("pendente")}
                  >
                    Pendente
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleMudarStatus("analisado")}
                  >
                    Analisado
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleMudarStatus("excluido")}
                  >
                    Excluido
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem
                className="text-red-500 focus:bg-red-50 focus:text-red-600 flex items-center gap-2"
                onClick={handleDeletarArtigo}
              >
                <TrashIcon className="h-4 w-4" />
                <span>Deletar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {artigo.aiEvaluation && (
        <Card className="mb-4 border-blue-200 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-900/10">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              Triagem Automática da IA
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center">
                <div className={`text-2xl font-bold ${artigo.aiSuggestedStatus === 'incluido' ? 'text-green-600' : 'text-red-600'}`}>
                  {artigo.aiRelevanceScore}%
                </div>
                <Badge variant="outline" className={`text-[10px] uppercase py-0 ${artigo.aiSuggestedStatus === 'incluido' ? 'border-green-200 text-green-700 bg-green-50' : 'border-red-200 text-red-700 bg-red-50'}`}>
                  {artigo.aiSuggestedStatus === 'incluido' ? 'Sugerido: Incluir' : 'Sugerido: Excluir'}
                </Badge>
              </div>
              <div className="flex-1 border-l pl-4">
                <p className="text-sm italic text-muted-foreground leading-relaxed">
                  "{artigo.aiEvaluation}"
                </p>
              </div>
              {artigo.status === 'pendente' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 border-green-200 hover:bg-green-50 hover:text-green-700"
                    onClick={() => handleMudarStatus('analisado')}
                  >
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleMudarStatus('excluido')}
                  >
                    Excluir
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-4 h-[calc(100vh-160px)]">
        {/* Visualizador de PDF - ocupa 2 linhas */}
        <div className="lg:row-span-2">
          <VizualizadorPDF
            artigo={artigo}
            artigoId={artigoId}
            projetoId={projetoId}
          />
        </div>

        {/* Editor de Notas - linha superior direita */}
        <div className="h-full">
          <EditorNotas
            valorInicial={artigo.notas}
            artigo={artigo}
            setArtigo={setArtigo}
            onSalvar={handleSalvarNotas}
          />
        </div>

        {/* Chat IA - linha inferior direita */}
        <div className="h-full">
          <ChatIA
            artigo={artigo}
            setArtigo={setArtigo}
            onAdicionarNota={handleAdicionarNota}
            pdfData={pdfData}
          />
        </div>
      </div>
    </div>
  );
}

export default ArtigoDetalhes;
