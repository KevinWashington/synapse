import { useMemo, useState } from "react";
import {
  Brain,
  BookOpen,
  ChevronDown,
  GraduationCap,
  HeartPulse,
  Leaf,
  MoreHorizontal,
  PlusIcon,
  SearchIcon,
  Sparkles,
  TrashIcon,
  EditIcon,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingState } from "@/components/layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  EditProjectPanel,
  NewProjectModal,
  useProjectsPage,
} from "@/features/projects";
import { usePageTitle } from "@hooks/usePageTitle";
import { cn } from "@/lib/utils";

const PROJECT_ICONS = [Brain, GraduationCap, HeartPulse, Leaf, Users, BookOpen];
const PROJECT_ICON_STYLES = [
  "bg-[#f0edff] text-[#6259ff]",
  "bg-[#eaf8f0] text-[#35a967]",
  "bg-[#eaf3ff] text-[#2378ff]",
  "bg-[#edf9f2] text-[#36b66b]",
  "bg-[#fff7e8] text-[#ff9f1c]",
  "bg-[#f1edff] text-[#7b61ff]",
];

const STATUS_STYLES = {
  ideia: "bg-[#edf1f7] text-[#56627f]",
  "em-progresso": "bg-[#eef1ff] text-[#6259ff]",
  concluido: "bg-[#fff1dc] text-[#c66b00]",
  pausado: "bg-[#eaf8f0] text-[#258c55]",
};

const STATUS_LABELS = {
  ideia: "Planejamento",
  "em-progresso": "Em andamento",
  concluido: "Concluído",
  pausado: "Em triagem",
};

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatUpdatedAt(project) {
  const date = new Date(project.updatedAt);
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function ProjectStatus({ status }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
        STATUS_STYLES[status] || "bg-[#edf1f7] text-[#56627f]"
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function PrismaProgress({ stats }) {
  const identifiedOnly = Math.max(stats.identified - stats.screening, 0);
  const screeningOnly = Math.max(stats.screening - stats.eligible, 0);
  const eligibleOnly = Math.max(stats.eligible - stats.included, 0);
  const included = stats.included;
  const stages = [
    { value: identifiedOnly, className: "bg-[#7167ff]" },
    { value: screeningOnly, className: "bg-[#60c889]" },
    { value: eligibleOnly, className: "bg-[#ffc96f]" },
    { value: included, className: "bg-[#8fd2a8]" },
  ];

  return (
    <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-[#e9edf4]">
      {stats.identified > 0 ? (
        stages.map((stage, index) => (
          <div
            key={index}
            className={stage.className}
            style={{ width: `${(stage.value / stats.identified) * 100}%` }}
          />
        ))
      ) : (
        <div className="h-full w-full bg-[#e9edf4]" />
      )}
    </div>
  );
}

function PrismaMetric({ color, label, value }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#667391]">
        <span className={cn("h-2 w-2 rounded-full", color)} />
        <span>{label}</span>
      </div>
      <p className="text-lg font-semibold leading-none text-[#111936]">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function ProjectRow({ project, index, onClick, onEdit, onDelete }) {
  const Icon = PROJECT_ICONS[index % PROJECT_ICONS.length];
  const iconStyle = PROJECT_ICON_STYLES[index % PROJECT_ICON_STYLES.length];
  const stats = project.prismaStats;

  function stopPropagation(event) {
    event.stopPropagation();
  }

  return (
    <tr
      data-testid="project-open"
      role="link"
      tabIndex={0}
      className="cursor-pointer border-t border-[#edf0f7] bg-white transition-colors hover:bg-[#fbfcff]"
      onClick={() => onClick(project)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick(project);
      }}
    >
      <td className="px-5 py-5">
        <div className="flex items-center gap-4">
          <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-xl", iconStyle)}>
            <Icon className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-[#111936]">{project.title}</h3>
              {index === 0 && <Sparkles className="h-4 w-4 text-[#6259ff]" />}
            </div>
            <p className="mt-2 line-clamp-2 max-w-[360px] text-sm leading-6 text-[#56627f]">
              {project.objetivo}
            </p>
            <div className="mt-2">
              <ProjectStatus status={project.status} />
            </div>
          </div>
        </div>
      </td>

      <td className="w-[32%] px-5 py-5">
        <div className="grid grid-cols-4 gap-4">
          <PrismaMetric color="bg-[#7167ff]" label="Identificados" value={stats.identified} />
          <PrismaMetric color="bg-[#60c889]" label="Triagem" value={stats.screening} />
          <PrismaMetric color="bg-[#ffc96f]" label="Elegíveis" value={stats.eligible} />
          <PrismaMetric color="bg-[#cbd3df]" label="Incluídos" value={stats.included} />
        </div>
        <PrismaProgress stats={stats} />
      </td>

      <td className="px-5 py-5 text-sm leading-6 text-[#56627f]">
        <span>{formatUpdatedAt(project)}</span>
        <span className="block text-xs">por você</span>
      </td>

      <td className="px-5 py-5 text-right" onClick={stopPropagation}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-[#182344]">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(project)}>
              <EditIcon className="h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(project)} variant="destructive">
              <TrashIcon className="h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function Projects() {
  const {
    editData,
    editLoading,
    editOpen,
    error,
    handleDeleteProject,
    handleEditProject,
    handleProjectClick,
    handleSaveEdit,
    loadProjects,
    loading,
    projects,
    searchTerm,
    setEditData,
    setEditOpen,
    setSearchTerm,
    setShowNewProjectModal,
    showNewProjectModal,
  } = useProjectsPage();
  const [sortOrder, setSortOrder] = useState("recent");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  usePageTitle({ title: "" });

  const visibleProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredProjects = normalizedSearch
      ? projects.filter((project) =>
          `${project.title} ${project.objetivo}`.toLowerCase().includes(normalizedSearch)
        )
      : projects;

    return [...filteredProjects].sort((first, second) => {
      if (sortOrder === "title") {
        return first.title.localeCompare(second.title);
      }

      const firstDate = new Date(first.updatedAt).getTime();
      const secondDate = new Date(second.updatedAt).getTime();
      return sortOrder === "oldest" ? firstDate - secondDate : secondDate - firstDate;
    });
  }, [projects, searchTerm, sortOrder]);

  if (loading && projects.length === 0) {
    return <LoadingState message="Carregando projetos..." fullPage />;
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-[#0f1734]">Projetos</h1>
          <p className="mt-2 text-sm text-[#667391]">
            Organize e acompanhe todas as suas revisões sistemáticas.
          </p>
        </div>
        <Button
          onClick={() => setShowNewProjectModal(true)}
          className="h-10 gap-2 rounded-lg bg-[#6259ff] px-4 text-white shadow-[0_10px_20px_rgba(98,89,255,0.2)] hover:bg-[#5148ee]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo projeto
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full">
          <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78839d]" />
          <Input
            placeholder="Buscar projetos..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-11 rounded-lg border-[#dfe4ef] bg-white pl-11 text-sm shadow-none"
          />
        </div>

        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger
            aria-label="Ordenar projetos"
            className="h-11 w-full rounded-lg border-[#dfe4ef] bg-white text-sm font-medium text-[#253252] shadow-none lg:w-[190px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="title">Título</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-lg bg-[#fff1f2] p-4 text-sm text-[#be123c]">
          <p className="font-medium">Erro ao carregar projetos</p>
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={loadProjects} className="mt-2">
            Tentar novamente
          </Button>
        </div>
      )}

      {visibleProjects.length > 0 ? (
        <>
        <div className="space-y-3 md:hidden">
          {visibleProjects.map((project, index) => {
            const Icon = PROJECT_ICONS[index % PROJECT_ICONS.length];
            const iconStyle = PROJECT_ICON_STYLES[index % PROJECT_ICON_STYLES.length];
            return (
              <article key={project.id} className="rounded-xl border border-[#edf0f7] bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconStyle)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold leading-5 text-[#111936]">{project.title}</h2>
                    <div className="mt-2"><ProjectStatus status={project.status} /></div>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#56627f]">{project.objetivo}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-[#f7f8fc] p-3">
                  <PrismaMetric color="bg-[#7167ff]" label="Identificados" value={project.prismaStats.identified} />
                  <PrismaMetric color="bg-[#60c889]" label="Triagem" value={project.prismaStats.screening} />
                  <PrismaMetric color="bg-[#ffc96f]" label="Elegíveis" value={project.prismaStats.eligible} />
                  <PrismaMetric color="bg-[#8fd2a8]" label="Incluídos" value={project.prismaStats.included} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-[#667391]">Atualizado {formatUpdatedAt(project)}</span>
                  <Button data-testid="project-open" size="sm" variant="outline" onClick={() => handleProjectClick(project)}>
                    Abrir projeto
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden overflow-hidden rounded-lg border border-[#edf0f7] bg-white md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed">
              <colgroup>
                <col className="w-[48%]" />
                <col className="w-[32%]" />
                <col className="w-[14%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead>
                <tr className="bg-white text-left text-xs font-semibold text-[#667391]">
                  <th className="px-5 py-4">Projeto</th>
                  <th className="px-5 py-4">Progresso (PRISMA)</th>
                  <th className="px-5 py-4">Última atualização</th>
                  <th className="px-5 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleProjects.map((project, index) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    index={index}
                    onClick={handleProjectClick}
                    onEdit={handleEditProject}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#edf0f7] px-5 py-4 text-sm text-[#667391]">
            <span>
              Mostrando {visibleProjects.length} de {visibleProjects.length} projetos
            </span>
          </div>
        </div>
        </>
      ) : (
        !loading && (
          <EmptyState
            icon={BookOpen}
            title="Nenhum projeto encontrado"
            description={
              searchTerm
                ? "Tente ajustar os filtros de pesquisa"
                : "Comece criando seu primeiro projeto de revisão literária"
            }
            actionLabel="Criar primeiro projeto"
            onAction={() => setShowNewProjectModal(true)}
          />
        )
      )}

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

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Excluir projeto?"
        description={deleteTarget ? `O projeto “${deleteTarget.title}” e seus dados serão removidos permanentemente.` : ""}
        confirmLabel="Excluir projeto"
        tone="destructive"
        isPending={isDeleting}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setIsDeleting(true);
          try {
            await handleDeleteProject(deleteTarget);
            setDeleteTarget(null);
          } finally {
            setIsDeleting(false);
          }
        }}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </div>
  );
}

export default Projects;
