import {
  BarChart3Icon,
  BookOpenIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  GitBranchIcon,
  MoreVerticalIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Visao Geral" },
  { key: "planejamento", label: "Planejamento" },
  { key: "artigos", label: "Artigos" },
  { key: "fluxo", label: "Fluxo" },
  { key: "grafo", label: "Graficos" },
];

const TAB_COPY = {
  planejamento: {
    title: null,
    description: "Planeje todos os aspectos da sua revisao sistematica.",
  },
  fluxo: {
    title: null,
    description: "Acompanhe o fluxograma PRISMA 2020 da sua revisao.",
  },
  grafo: {
    title: "Graficos e analises",
    description: "Explore os dados da sua revisao sistematica com visualizacoes e insights.",
  },
};

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return `${date.toLocaleDateString("pt-BR")} as ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function ProjectDetailsHeader({
  activeTab,
  onContinueScreening,
  onDeleteProject,
  onEditProject,
  onTabChange,
  project,
}) {
  const title = TAB_COPY[activeTab]?.title || project?.title;
  const description = TAB_COPY[activeTab]?.description || project?.objetivo;

  return (
    <header className="mb-5 border-b border-[#edf0f7]">
      <div className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-[#0f1734]">{title}</h1>
            <span className="rounded-full bg-[#eef1ff] px-3 py-1 text-xs font-semibold text-[#6259ff]">
              {project?.status === "em-progresso" ? "Em andamento" : project?.status}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-[#182344]">
                  <MoreVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onDeleteProject} className="text-red-500">
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Deletar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#56627f]">{description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-[#667391]">
            <span>Criado em {formatDateTime(project?.createdAt)}</span>
            <span>Atualizado em {formatDateTime(project?.updatedAt)}</span>
            <span>por voce</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEditProject}
            className="h-10 gap-2 rounded-lg border-[#dfe4ef] bg-white text-[#182344] shadow-none"
          >
            <PencilIcon className="h-4 w-4" />
            Editar planejamento
          </Button>
          <Button
            size="sm"
            onClick={onContinueScreening}
            className="h-10 gap-2 rounded-lg bg-[#6259ff] px-4 text-white shadow-[0_10px_20px_rgba(98,89,255,0.18)] hover:bg-[#5148ee]"
          >
            <GitBranchIcon className="h-4 w-4" />
            Continuar triagem
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <nav className="flex gap-6 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "relative flex items-center gap-2 whitespace-nowrap px-1 pb-3 text-xs font-semibold transition-colors",
                isActive ? "text-[#6259ff]" : "text-[#56627f] hover:text-[#182344]"
              )}
            >
              {tab.key === "planejamento" && <ClipboardListIcon className="h-3.5 w-3.5" />}
              {tab.key === "artigos" && <BookOpenIcon className="h-3.5 w-3.5" />}
              {tab.key === "fluxo" && <GitBranchIcon className="h-3.5 w-3.5" />}
              {tab.key === "grafo" && <BarChart3Icon className="h-3.5 w-3.5" />}
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[#6259ff]" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

export default ProjectDetailsHeader;
