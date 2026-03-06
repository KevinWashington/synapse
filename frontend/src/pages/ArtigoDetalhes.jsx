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
  CheckCircle2,
  XCircle,
  PenLineIcon,
  MessageSquareIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { usePageTitle } from "@/context/pageTitleContext";

function ArtigoDetalhes() {
  const { projetoId, artigoId } = useParams();
  const navigate = useNavigate();
  const updateTitle = usePageTitle({ title: "", backUrl: `/projetos/${projetoId}` });
  const [artigo, setArtigo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [rightTab, setRightTab] = useState("notas");

  const fetchArtigo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const artigoData = await articleService.getArticleById(projetoId, artigoId);
      setArtigo(artigoData);
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
      const response = await fetch(pdfUrl, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error(`Erro ao baixar PDF: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      setPdfData(arrayBuffer);
    } catch (err) {
      console.error("Erro ao obter PDF:", err);
    }
  }, [artigo, pdfData, projetoId, artigoId]);

  useEffect(() => { fetchArtigo(); }, [fetchArtigo]);
  useEffect(() => { if (artigo) fetchPdfData(); }, [artigo, fetchPdfData]);

  useEffect(() => {
    if (artigo) {
      updateTitle({ title: artigo.title, badge: <StatusBadge status={artigo.status} /> });
    }
  }, [artigo?.title, artigo?.status, updateTitle]);

  const handleMudarStatus = async (novoStatus) => {
    try {
      await articleService.updateArticleStatus(projetoId, artigoId, novoStatus);
      setArtigo((prev) => ({ ...prev, status: novoStatus }));
      toast.success(`Status atualizado para ${novoStatus}`);
    } catch (err) {
      toast.error("Erro ao atualizar status: " + err.message);
    }
  };

  const handleSalvarNotas = async (notas) => {
    try {
      await articleService.updateArticleNotes(projetoId, artigoId, notas);
      setArtigo((prev) => ({ ...prev, notas }));
      toast.success("Notas salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar notas: " + err.message);
    }
  };

  const handleDeletarArtigo = async () => {
    if (!confirm(`Tem certeza que deseja deletar o artigo "${artigo.title}"?`)) return;
    try {
      await articleService.deleteArticle(projetoId, artigoId);
      toast.success("Artigo deletado com sucesso!");
      navigate(`/projetos/${projetoId}`);
    } catch (err) {
      toast.error("Erro ao deletar artigo: " + err.message);
    }
  };

  const handleAdicionarNota = (nota) => {
    setArtigo((prev) => ({
      ...prev,
      notas: (prev.notas ? prev.notas + "\n" : "") + nota,
    }));
  };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] gap-2 text-[var(--syn-text-secondary)]">
        <LoaderIcon className="h-6 w-6 animate-spin" />
        <span>Carregando artigo...</span>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertTriangleIcon className="h-12 w-12 text-[var(--syn-badge-high-text)] mb-3" />
        <h2 className="text-lg font-semibold text-[var(--syn-text-primary)] mb-1">Erro ao carregar artigo</h2>
        <p className="text-sm text-[var(--syn-text-secondary)] mb-4">{error}</p>
        <Button onClick={() => navigate(`/projetos/${projetoId}`)} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para o Projeto
        </Button>
      </div>
    );
  }

  // Not found
  if (!artigo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <FileIcon className="h-12 w-12 text-[var(--syn-text-secondary)] mb-3" />
        <h2 className="text-lg font-semibold text-[var(--syn-text-primary)] mb-1">Artigo não encontrado</h2>
        <p className="text-sm text-[var(--syn-text-secondary)] mb-4">O artigo não existe ou foi removido.</p>
        <Button onClick={() => navigate(`/projetos/${projetoId}`)} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para o Projeto
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
              <BoltIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleMudarStatus("pendente")}>Pendente</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMudarStatus("analisado")}>Analisado</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMudarStatus("excluido")}>Excluído</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem className="text-red-500 focus:bg-red-50 focus:text-red-600 gap-2" onClick={handleDeletarArtigo}>
              <TrashIcon className="h-4 w-4" />
              Deletar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* AI Triage banner */}
      {artigo.aiEvaluation && (
        <div className="mb-4 flex items-center gap-4 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] shadow-[var(--syn-shadow-card)] px-4 py-3">
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles className="h-4 w-4 text-[var(--syn-sidebar-accent)]" />
            <span className="text-xs font-semibold text-[var(--syn-text-primary)]">IA</span>
          </div>
          <div className={`text-xl font-bold shrink-0 ${artigo.aiSuggestedStatus === 'incluido' ? 'text-emerald-600' : 'text-red-500'}`}>
            {artigo.aiRelevanceScore}%
          </div>
          <div className="h-6 w-px bg-[var(--syn-border)]" />
          <p className="text-sm text-[var(--syn-text-secondary)] truncate flex-1" title={artigo.aiEvaluation}>
            {artigo.aiEvaluation}
          </p>
          {artigo.status === "pendente" && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => handleMudarStatus("analisado")}>
                <CheckCircle2 className="h-3 w-3" /> Aceitar
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => handleMudarStatus("excluido")}>
                <XCircle className="h-3 w-3" /> Excluir
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main layout - PDF + Tabbed Panel */}
      <div className="flex gap-4 flex-1 min-h-0" style={{ height: "calc(100vh - 200px)" }}>
        {/* PDF / Abstract — wider */}
        <div className="w-[58%] min-h-0 shrink-0">
          <VizualizadorPDF artigo={artigo} artigoId={artigoId} projetoId={projetoId} />
        </div>

        {/* Right panel — tabbed Notes / Chat */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)]">
          {/* Tab nav */}
          <div className="flex border-b border-[var(--syn-border)] shrink-0">
            <button
              onClick={() => setRightTab("notas")}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                rightTab === "notas"
                  ? "text-[var(--syn-text-primary)]"
                  : "text-[var(--syn-text-secondary)] hover:text-[var(--syn-text-primary)]"
              }`}
            >
              <PenLineIcon className="h-4 w-4" />
              Notas
              {rightTab === "notas" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--syn-sidebar-accent)]" />
              )}
            </button>
            <button
              onClick={() => setRightTab("chat")}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                rightTab === "chat"
                  ? "text-[var(--syn-text-primary)]"
                  : "text-[var(--syn-text-secondary)] hover:text-[var(--syn-text-primary)]"
              }`}
            >
              <MessageSquareIcon className="h-4 w-4" />
              Assistente IA
              {rightTab === "chat" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--syn-sidebar-accent)]" />
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0">
            {rightTab === "notas" ? (
              <EditorNotas valorInicial={artigo.notas} artigo={artigo} setArtigo={setArtigo} onSalvar={handleSalvarNotas} />
            ) : (
              <ChatIA artigo={artigo} setArtigo={setArtigo} onAdicionarNota={handleAdicionarNota} pdfData={pdfData} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArtigoDetalhes;
