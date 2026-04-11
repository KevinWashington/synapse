import { memo, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  Clock,
  EditIcon,
  FileText,
  MessageSquare,
  MoreHorizontal,
  TrashIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import ProjectFrameworkBadge from "./ProjectFrameworkBadge";

function formatRelativeDate(data) {
  if (!data) {
    return "";
  }

  const now = new Date();
  const date = new Date(data);
  const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `${diffDays} dias restantes`;
  }

  if (diffDays === 0) {
    return "Hoje";
  }

  return `${Math.abs(diffDays)} dias atrás`;
}

function ProjectCard({ project, onEdit, onDelete, onClick }) {
  const handleCardClick = useCallback(() => {
    if (onClick) {
      onClick(project);
    }
  }, [onClick, project]);

  const handleMenuTriggerClick = useCallback((event) => {
    event.stopPropagation();
  }, []);

  const handleEditClick = useCallback(
    (event) => {
      event.stopPropagation();
      onEdit(project);
    },
    [onEdit, project]
  );

  const handleDeleteClick = useCallback(
    (event) => {
      event.stopPropagation();
      onDelete(project);
    },
    [onDelete, project]
  );

  return (
    <div
      className="group p-4 rounded-[var(--syn-radius-card)] bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)] border border-[var(--syn-border)] shadow-[var(--syn-shadow-card)] cursor-pointer hover:shadow-[var(--syn-shadow-card-hover)] syn-transition"
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-[var(--syn-text-primary)] line-clamp-2 pr-2">
          {project.title}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 flex-shrink-0 -mt-0.5 -mr-1"
              onClick={handleMenuTriggerClick}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleEditClick}>
              <EditIcon className="h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteClick} variant="destructive">
              <TrashIcon className="h-4 w-4" />
              Deletar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <StatusBadge status={project.status} />
        <ProjectFrameworkBadge framework={project.framework} />
      </div>

      {project.objetivo && (
        <p className="text-xs text-[var(--syn-text-secondary)] line-clamp-2 mb-3">
          {project.objetivo}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-[var(--syn-text-secondary)]">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeDate(project.updatedAt || project.created_at)}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {project.articleCount || 0}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {project.notesCount || 0}
        </span>
      </div>
    </div>
  );
}

export default memo(ProjectCard);


