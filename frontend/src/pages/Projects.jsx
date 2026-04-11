import { DragDropContext } from "@hello-pangea/dnd";
import { FolderIcon, PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KanbanBoard, KanbanColumn } from "@/components/ui/KanbanColumn";
import { EmptyState, LoadingState } from "@/components/layout";
import {
  EditProjectPanel,
  NewProjectModal,
  ProjectQuickViewPanel,
  ProjectCard,
  useProjectsPage,
} from "@/features/projects";
import { usePageTitle } from "@hooks/usePageTitle";

function Projects() {
  const {
    columnItems,
    detailOpen,
    editData,
    editLoading,
    editOpen,
    error,
    handleDeleteProject,
    handleDragEnd,
    handleEditProject,
    handleExpandProject,
    handleProjectClick,
    handleSaveEdit,
    loadProjects,
    loading,
    projectColumns,
    projects,
    searchTerm,
    selectedProject,
    setDetailOpen,
    setEditData,
    setEditOpen,
    setSearchTerm,
    setShowNewProjectModal,
    showNewProjectModal,
  } = useProjectsPage();

  usePageTitle({ title: "Projetos" });

  if (loading && projects.length === 0) {
    return <LoadingState message="Carregando projetos..." fullPage />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--syn-text-secondary)]" />
          <Input
            placeholder="Pesquisar projetos..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowNewProjectModal(true)} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      {error && (
        <div className="rounded-[var(--syn-radius-card)] bg-[var(--syn-badge-high-bg)] p-4 text-sm text-[var(--syn-badge-high-text)]">
          <p className="font-medium">Erro ao carregar projetos</p>
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={loadProjects}
            className="mt-2"
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {projects.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <KanbanBoard>
            {projectColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                columnId={column.id}
                label={column.label}
                count={columnItems[column.id].length}
                items={columnItems[column.id]}
                renderItem={(project) => (
                  <ProjectCard
                    project={project}
                    onEdit={handleEditProject}
                    onDelete={handleDeleteProject}
                    onClick={handleProjectClick}
                  />
                )}
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
            onAction={() => setShowNewProjectModal(true)}
          />
        )
      )}

      <ProjectQuickViewPanel
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onExpand={handleExpandProject}
        project={selectedProject}
      />

      <EditProjectPanel
        isOpen={editOpen}
        loading={editLoading}
        value={editData}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveEdit}
        onFieldChange={(field, value) =>
          setEditData((current) => ({ ...current, [field]: value }))
        }
      />

      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onSuccess={loadProjects}
      />
    </div>
  );
}

export default Projects;

