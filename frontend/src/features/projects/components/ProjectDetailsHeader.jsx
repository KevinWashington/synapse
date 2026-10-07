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

function ProjectDetailsHeader({
  activeTab,
  onEditProject,
  onTabChange,
  project,
}) {
  return (
    <header className="mb-5 border-b border-[#edf0f7]">
      <div className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-normal text-[#0f1734]">{project?.title}</h1>
          </div>
          <p
            data-testid="project-objective"
            className="mt-1 min-h-12 max-w-4xl line-clamp-2 text-sm leading-6 text-[#56627f]"
          >
            {project?.objetivo}
          </p>
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
                "relative flex cursor-pointer items-center gap-2 whitespace-nowrap px-1 pb-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40",
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
