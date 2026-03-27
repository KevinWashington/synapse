import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProjetoCard, NovoProjetoModal, projectService } from "@/features/projects";
import {
  FolderIcon,
  PlusIcon,
  SearchIcon,
  LoaderIcon,
} from "lucide-react";
import { KanbanBoard, KanbanColumn } from "@/components/ui/kanban-column";
import { DragDropContext } from "@hello-pangea/dnd";
import { SlidePanel } from "@/components/ui/slide-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState, EmptyState } from "@/components/layout";
import { toast } from "@/lib/toast";
import { usePageTitle } from "@/context/pageTitleContext";
import { getFrameworkInfo } from "@/lib/frameworkConfig";

function Projetos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNovoProjetoModal, setShowNovoProjetoModal] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProjeto, setEditProjeto] = useState(null);
  const [editData, setEditData] = useState({ title: "", objetivo: "", status: "" });
  const [editLoading, setEditLoading] = useState(false);

  const loadProjects = useCallback(
    async (filters = {}) => {
      try {
        setLoading(true);
        setError(null);
        const params = { page: 1, limit: 50, ...filters };
        if (debouncedSearchTerm) params.search = debouncedSearchTerm;
        const response = await projectService.getAllProjects(params);
        setProjetos(response.projects || []);
      } catch (err) {
        console.error("Erro ao carregar projetos:", err);
        setError(err.message || "Erro ao carregar projetos");
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearchTerm]
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleDeletarProjeto = async (projeto) => {
    if (!confirm(`Tem certeza que deseja deletar o projeto "${projeto.title}"?`)) return;
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
    setSelectedProjeto(projeto);
    setDetailOpen(true);
  };

  const handleEditarProjeto = (projeto) => {
    setEditProjeto(projeto);
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
      await projectService.updateProject(editProjeto.id, editData);
      toast.success("Projeto atualizado com sucesso!");
      setEditOpen(false);
      loadProjects();
    } catch (err) {
      toast.error("Erro ao atualizar: " + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Kanban columns
  const COLUMNS = [
    { id: "todo", label: "Todo", statuses: ["ideia", "pausado"], defaultStatus: "ideia" },
    { id: "in-progress", label: "In Progress", statuses: ["em-progresso"], defaultStatus: "em-progresso" },
    { id: "completed", label: "Completed", statuses: ["concluido"], defaultStatus: "concluido" },
  ];

  const columnItems = {
    todo: projetos.filter((p) => p.status === "ideia" || p.status === "pausado"),
    "in-progress": projetos.filter((p) => p.status === "em-progresso"),
    completed: projetos.filter((p) => p.status === "concluido"),
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const targetColumn = COLUMNS.find((c) => c.id === destination.droppableId);
    if (!targetColumn) return;

    const projectId = Number(draggableId);
    const newStatus = targetColumn.defaultStatus;

    // Optimistic update
    setProjetos((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
    );

    try {
      await projectService.updateProject(projectId, { status: newStatus });
    } catch (err) {
      toast.error("Erro ao mover projeto: " + err.message);
      loadProjects(); // revert on failure
    }
  };

  const renderCard = (projeto) => (
    <ProjetoCard
      projeto={projeto}
      onEditar={handleEditarProjeto}
      onDeletar={handleDeletarProjeto}
      onClick={handleProjetoClick}
    />
  );



  usePageTitle({ title: "Projetos" });

  if (loading && projetos.length === 0) {
    return <LoadingState message="Carregando projetos..." fullPage />;
  }

  return (
    <div className="space-y-6">
      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--syn-text-secondary)]" />
          <Input
            placeholder="Pesquisar projetos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowNovoProjetoModal(true)} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-[var(--syn-radius-card)] bg-[var(--syn-badge-high-bg)] text-[var(--syn-badge-high-text)] text-sm">
          <p className="font-medium">Erro ao carregar projetos</p>
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => loadProjects()} className="mt-2">
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Kanban board */}
      {projetos.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <KanbanBoard>
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                columnId={col.id}
                label={col.label}
                count={columnItems[col.id].length}
                items={columnItems[col.id]}
                renderItem={renderCard}
              />
            ))}
          </KanbanBoard>
        </DragDropContext>
      ) : (
        !loading && (
          <EmptyState
            icon={FolderIcon}
            title="Nenhum projeto encontrado"
            description={
              searchTerm
                ? "Tente ajustar os filtros de pesquisa"
                : "Comece criando seu primeiro projeto de revisão literária"
            }
            actionLabel="Criar Primeiro Projeto"
            onAction={() => setShowNovoProjetoModal(true)}
          />
        )
      )}

      {/* Project detail panel */}
      <SlidePanel
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selectedProjeto?.title || ""}
        breadcrumb="Projetos"
        badge={
          selectedProjeto && (
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedProjeto.status} />
              {(() => {
                const fw = selectedProjeto.framework || "PICOC";
                const fwInfo = getFrameworkInfo(fw);
                return (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ backgroundColor: fwInfo.badgeBg, color: fwInfo.badgeText }}
                  >
                    {fw}
                  </span>
                );
              })()}
            </div>
          )
        }
        onExpand={selectedProjeto ? () => navigate(`/projetos/${selectedProjeto.id}`) : undefined}
      >
        {selectedProjeto && (
          <div className="p-6 space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                Descrição
              </h3>
              <p className="text-sm text-[var(--syn-text-primary)] leading-relaxed">
                {selectedProjeto.objetivo || "Sem descrição"}
              </p>
            </div>

            {/* Articles as attachments */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                Artigos ({selectedProjeto.articleCount || 0})
              </h3>
              {(selectedProjeto.articleCount || 0) > 0 ? (
                <p className="text-sm text-[var(--syn-text-secondary)]">
                  Clique em "Expandir" para ver os artigos vinculados.
                </p>
              ) : (
                <p className="text-sm text-[var(--syn-text-secondary)]">
                  Nenhum artigo vinculado ainda.
                </p>
              )}
            </div>

            {/* Info */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                Informações
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--syn-text-secondary)]">Status</dt>
                  <dd><StatusBadge status={selectedProjeto.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--syn-text-secondary)]">Criado em</dt>
                  <dd className="text-[var(--syn-text-primary)]">
                    {new Date(selectedProjeto.created_at || selectedProjeto.createdAt).toLocaleDateString("pt-BR")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--syn-text-secondary)]">Atualizado</dt>
                  <dd className="text-[var(--syn-text-primary)]">
                    {new Date(selectedProjeto.updatedAt || selectedProjeto.updated_at).toLocaleDateString("pt-BR")}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Comment input */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
                Comentários
              </h3>
              <div className="p-3 rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)]">
                <input
                  type="text"
                  placeholder="Adicionar um comentário..."
                  className="w-full bg-transparent text-sm text-[var(--syn-text-primary)] placeholder:text-[var(--syn-text-secondary)] outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </SlidePanel>

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
