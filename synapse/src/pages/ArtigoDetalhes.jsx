import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  ArrowLeftIcon,
  LoaderIcon,
  FileIcon,
  AlertTriangleIcon,
  BoltIcon,
  TrashIcon,
  LinkIcon,
} from "lucide-react";
import EditorNotas from "@/components/EditorNotas.jsx";
import ChatIA from "@/components/ChatIA.jsx";
import GerenciadorRelacionamentos from "@/components/GerenciadorRelacionamentos.jsx";
import { articleService } from "../services/artigosService.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import VizualizadorPDF from "@/components/VizualizadorPDF.jsx";

function ArtigoDetalhes() {
  const { projetoId, artigoId } = useParams();
  const navigate = useNavigate();
  const [artigo, setArtigo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [showRelacionamentos, setShowRelacionamentos] = useState(false);

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
      alert(`Status do artigo atualizado para ${novoStatus}`);
    } catch (err) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  const handleSalvarNotas = async (notas) => {
    try {
      await articleService.updateArticleNotes(projetoId, artigoId, notas);
      setArtigo((prevArtigo) => ({
        ...prevArtigo,
        notas: notas,
      }));
      alert("Notas salvas com sucesso!");
    } catch (err) {
      alert("Erro ao salvar notas: " + err.message);
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
      alert("Artigo deletado com sucesso!");
      navigate(`/projetos/${projetoId}`);
    } catch (err) {
      console.error("Erro ao deletar artigo:", err);
      alert("Erro ao deletar artigo: " + err.message);
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
          <Dialog
            open={showRelacionamentos}
            onOpenChange={setShowRelacionamentos}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <LinkIcon className="h-4 w-4 mr-2" />
                Relacionamentos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Gerenciar Relacionamentos</DialogTitle>
                <DialogDescription>
                  Conecte este artigo com outros artigos relacionados para criar
                  uma rede de conhecimento.
                </DialogDescription>
              </DialogHeader>
              <GerenciadorRelacionamentos
                projetoId={projetoId}
                artigoId={artigoId}
                artigoTitle={artigo.title}
                onRelationshipsChange={() => {
                  console.log("Relacionamentos atualizados");
                }}
              />
            </DialogContent>
          </Dialog>
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
