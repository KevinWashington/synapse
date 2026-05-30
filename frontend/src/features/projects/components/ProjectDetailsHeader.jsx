import {
  BarChart3Icon,
  BookOpenIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
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
  { key: "overview", label: "Visão Geral" },
  { key: "planejamento", label: "Planejamento" },
  { key: "artigos", label: "Artigos" },
  { key: "fluxo", label: "Fluxo" },
  { key: "sintese", label: "Síntese" },
  { key: "grafo", label: "Gráficos" },
];

const TAB_COPY = {
  planejamento: {
    title: null,
    description: "Planeje todos os aspectos da sua revisao sistematica.",
  },
  fluxo: {
    title: null,
    description: "Acompanhe o fluxograma PRISMA da sua revisão.",
  },
  sintese: {
    title: "Sintese e relatorio",
    description: "Visualize a sintese completa: RQs, matriz de extracao, distribuicoes e qualidade dos estudos.",
  },
  grafo: {
    title: "Graficos e analises",
    description: "Explore os dados da sua revisao sistematica com visualizações e insights.",
  },
};

function ProjectDetailsHeader({
  activeTab,
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
          </div>
          <p className=" max-w-3xl text-sm leading-6 text-[#56627f]">{description}</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onEditProject}
          className="h-10 gap-2 rounded-lg border-[#dfe4ef] bg-white text-[#182344] shadow-none"
        >
          <PencilIcon className="h-4 w-4" />
          Editar projeto
        </Button>
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
              {tab.key === "sintese" && <ClipboardCheckIcon className="h-3.5 w-3.5" />}
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
