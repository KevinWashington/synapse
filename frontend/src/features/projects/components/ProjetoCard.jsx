import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  EditIcon,
  TrashIcon,
  Clock,
  FileText,
  MessageSquare,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

function ProjetoCard({ projeto, onEditar, onDeletar, onClick }) {
  const formatarData = (data) => {
    if (!data) return "";
    const now = new Date();
    const date = new Date(data);
    const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `${diffDays} dias restantes`;
    if (diffDays === 0) return "Hoje";
    return `${Math.abs(diffDays)} dias atrás`;
  };

  return (
    <div
      className="group p-4 rounded-[var(--syn-radius-card)] bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)] border border-[var(--syn-border)] shadow-[var(--syn-shadow-card)] cursor-pointer hover:shadow-[var(--syn-shadow-card-hover)] syn-transition"
      onClick={() => onClick && onClick(projeto)}
    >
      {/* Title + menu */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-[var(--syn-text-primary)] line-clamp-2 pr-2">
          {projeto.title}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 flex-shrink-0 -mt-0.5 -mr-1"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEditar(projeto);
              }}
            >
              <EditIcon className="h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDeletar(projeto);
              }}
              variant="destructive"
            >
              <TrashIcon className="h-4 w-4" />
              Deletar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Badge */}
      <div className="mb-3">
        <StatusBadge status={projeto.status} />
      </div>

      {/* Description */}
      {projeto.objetivo && (
        <p className="text-xs text-[var(--syn-text-secondary)] line-clamp-2 mb-3">
          {projeto.objetivo}
        </p>
      )}

      {/* Inline metrics */}
      <div className="flex items-center gap-4 text-xs text-[var(--syn-text-secondary)]">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatarData(projeto.updatedAt || projeto.created_at)}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {projeto.articleCount || 0}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {projeto.notesCount || 0}
        </span>
      </div>
    </div>
  );
}

export default ProjetoCard;
