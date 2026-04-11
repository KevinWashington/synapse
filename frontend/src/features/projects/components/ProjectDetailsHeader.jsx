import {
  BookOpenIcon,
  ClipboardListIcon,
  MoreVerticalIcon,
  NetworkIcon,
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

const TABS = [
  { key: "planejamento", icon: ClipboardListIcon, label: "Planejamento" },
  { key: "artigos", icon: BookOpenIcon, label: "Artigos" },
  { key: "grafo", icon: NetworkIcon, label: "Grafo" },
];

function ProjectDetailsHeader({
  activeTab,
  onDeleteProject,
  onEditProject,
  onTabChange,
}) {
  return (
    <div className="mb-6 flex items-center justify-between border-b border-[var(--syn-border)]">
      <nav className="flex gap-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[var(--syn-text-primary)]"
                  : "text-[var(--syn-text-secondary)] hover:text-[var(--syn-text-primary)]"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[var(--syn-sidebar-accent)]" />
              )}
            </button>
          );
        })}
      </nav>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onEditProject}
          className="gap-2"
        >
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
            <DropdownMenuItem className="text-red-500" onClick={onDeleteProject}>
              <TrashIcon className="mr-2 h-4 w-4" />
              Deletar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default ProjectDetailsHeader;
