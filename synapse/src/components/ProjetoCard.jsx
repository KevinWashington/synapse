import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  CalendarIcon,
  MoreVerticalIcon,
  FolderIcon,
  EditIcon,
  TrashIcon,
} from "lucide-react";

function ProjetoCard({ projeto, onEditar, onDeletar, onClick }) {
  const getStatusBadge = (status) => {
    const statusConfig = {
      ideia: {
        label: "ideia",
        class:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      },
      'em-progresso': {
        label: "Em progresso",
        class: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      },
      concluido: {
        label: "concluido",
        class: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      },
      pausado: {
        label: "pausado",
        class:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      }
    };

    const config = statusConfig[status];
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${config.class}`}
      >
        {config.label}
      </span>
    );
  };

  const formatarData = (data) => {
    return new Date(data).toLocaleDateString("pt-BR");
  };

  return (
    <Card
      className="group hover:shadow-lg transition-all duration-200 cursor-pointer gap-0"
      onClick={() => onClick && onClick(projeto)}
    >
      <CardHeader>
        {/* Nome e menu */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FolderIcon className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {projeto.title}
            </h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVerticalIcon className="h-4 w-4" />
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
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Informações do projeto */}
        <div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {projeto.objetivo}
          </p>
        </div>

        {/* Informações adicionais */}
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <CalendarIcon className="h-4 w-4" />
            <span>{formatarData(projeto.updatedAt)}</span>
          </div>
          <div className="flex justify-start">
            {getStatusBadge(projeto.status)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProjetoCard;
