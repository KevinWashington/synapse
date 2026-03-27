import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlanejamentoProjeto, projectService } from "@/features/projects";
import { ArtigosProjeto, GrafoArtigos } from "@/features/articles";
import {
  ArrowLeftIcon,
  FileTextIcon,
  PencilIcon,
  TrashIcon,
  AlertTriangleIcon,
  MoreVerticalIcon,
  NetworkIcon,
  ClipboardListIcon,
  BookOpenIcon,
  LoaderIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SlidePanel } from "@/components/ui/slide-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState, EmptyState } from "@/components/layout";
import { toast } from "@/lib/toast";
import { usePageTitle } from "@/context/pageTitleContext";
import { getFrameworkInfo } from "@/lib/frameworkConfig";

const TABS = [
  { key: "planejamento", icon: ClipboardListIcon, label: "Planejamento" },
  { key: "artigos", icon: BookOpenIcon, label: "Artigos" },
  { key: "grafo", icon: NetworkIcon, label: "Grafo" },
];

function ProjetoDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const updateTitle = usePageTitle({ title: "", backUrl: "/projetos" });
  const [projeto, setProjeto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("planejamento");
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({ title: "", objetivo: "", status: "" });
  const [editLoading, setEditLoading] = useState(false);

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

  useEffect(() => {
    fetchProjeto();
  }, [id]);

  useEffect(() => {
    if (projeto) {
      const fw = projeto.framework || "PICOC";
      const fwInfo = getFrameworkInfo(fw);
      updateTitle({
        title: projeto.title,
        badge: (
          <div className="flex items-center gap-2">
            <StatusBadge status={projeto.status} />
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: fwInfo.badgeBg, color: fwInfo.badgeText }}
            >
              {fw}
            </span>
          </div>
        ),
      });
    }
  }, [projeto?.title, projeto?.status, projeto?.framework, updateTitle]);

  const handleEditarProjeto = () => {
    setEditData({
      title: projeto.title || "",
      objetivo: projeto.objetivo || "",
      status: projeto.status || "ideia",
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      setEditLoading(true);
      await projectService.updateProject(projeto.id, editData);
      setProjeto((prev) => ({ ...prev, ...editData }));
      setEditOpen(false);
      toast.success("Projeto atualizado com sucesso!");
    } catch (err) {
      toast.error("Erro ao atualizar: " + err.message);
    } finally {
      setEditLoading(false);
    }
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

  if (loading) {
    return <LoadingState message="Carregando projeto..." fullPage />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertTriangleIcon className="h-12 w-12 text-[var(--syn-badge-high-text)] mb-3" />
        <h2 className="text-lg font-semibold text-[var(--syn-text-primary)] mb-1">Erro ao carregar projeto</h2>
        <p className="text-sm text-[var(--syn-text-secondary)] mb-4">{error}</p>
        <Button onClick={() => navigate("/projetos")} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para Projetos
        </Button>
      </div>
    );
  }

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
    <div className="h-full flex flex-col">
      {/* Tab navigation + actions */}
      <div className="flex items-center justify-between border-b border-[var(--syn-border)] mb-6">
        <nav className="flex gap-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-[var(--syn-text-primary)]"
                    : "text-[var(--syn-text-secondary)] hover:text-[var(--syn-text-primary)]"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--syn-sidebar-accent)] rounded-t" />
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEditarProjeto} className="gap-2">
            <PencilIcon className="h-3.5 w-3.5" />
            Editar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreVerticalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-red-500" onClick={handleDeletarProjeto}>
                <TrashIcon className="mr-2 h-4 w-4" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === "planejamento" && <PlanejamentoProjeto projeto={projeto} />}
        {activeTab === "artigos" && <ArtigosProjeto projeto={projeto} onNavigate={navigate} />}
        {activeTab === "grafo" && <GrafoArtigos projectId={projeto.id} />}
      </div>

      {/* Edit project slide panel */}
      <SlidePanel
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar Projeto"
        breadcrumb="Projetos"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={editLoading} className="gap-2">
              {editLoading ? (
                <><LoaderIcon className="h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </div>
        }
      >
        <div className="p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
              Informações do Projeto
            </h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-title" className="text-[var(--syn-text-primary)]">Título</Label>
            <Input
              id="edit-title"
              value={editData.title}
              onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-objetivo" className="text-[var(--syn-text-primary)]">Objetivo</Label>
            <Textarea
              id="edit-objetivo"
              value={editData.objetivo}
              onChange={(e) => setEditData((d) => ({ ...d, objetivo: e.target.value }))}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[var(--syn-text-primary)]">Status</Label>
            <div className="flex flex-wrap gap-2">
              {["ideia", "em-progresso", "concluido", "pausado"].map((s) => (
                <button
                  key={s}
                  onClick={() => setEditData((d) => ({ ...d, status: s }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    editData.status === s
                      ? "bg-[var(--syn-sidebar-bg)] text-white border-transparent"
                      : "border-[var(--syn-border)] text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)]"
                  }`}
                >
                  <StatusBadge status={s} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </SlidePanel>
    </div>
  );
}

export default ProjetoDetalhes;
