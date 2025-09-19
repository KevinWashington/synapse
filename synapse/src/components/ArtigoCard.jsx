import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  FileIcon,
  MoreVerticalIcon,
  CheckIcon,
  ClockIcon,
  XIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  UploadIcon,
} from "lucide-react";

function ArtigoCard({
  artigo,
  onClick,
  onChangeStatus,
  onDelete,
  onEdit,
  onUploadPDF,
}) {
  const getStatusIndicator = (status) => {
    switch (status) {
      case "analisado":
        return (
          <div className="flex items-center gap-1 text-green-600">
            <CheckIcon className="h-3 w-3" />
            <span className="text-xs">Analisado</span>
          </div>
        );
      case "pendente":
        return (
          <div className="flex items-center gap-1 text-amber-600">
            <ClockIcon className="h-3 w-3" />
            <span className="text-xs">Pendente</span>
          </div>
        );
      case "excluido":
        return (
          <div className="flex items-center gap-1 text-red-600">
            <XIcon className="h-3 w-3" />
            <span className="text-xs">Excluído</span>
          </div>
        );
      default:
        return null;
    }
  };

  const handleCardClick = (e) => {
    if (onClick && !e.defaultPrevented) {
      onClick(artigo);
    }
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-950 cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Capa do Artigo */}
      <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <FileIcon
          className={`w-16 h-16 ${
            artigo.pdfFile ? "text-blue-500" : "text-gray-400"
          }`}
        />

        {/* Status */}
        <div className="absolute top-2 left-2 z-10">
          {getStatusIndicator(artigo.status)}
        </div>

        {/* Indicador de PDF */}
        {!artigo.pdfFile && (
          <div className="absolute bottom-2 left-2 z-10">
            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
              Sem PDF
            </span>
          </div>
        )}

        {/* Menu de opções */}
        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-black/40 text-white hover:bg-black/60 focus:ring-0"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVerticalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  if (onClick) onClick(artigo);
                }}
              >
                <EyeIcon className="mr-2 h-4 w-4" />
                Revisar
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  if (onEdit) onEdit(artigo);
                }}
              >
                <EditIcon className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>

              {!artigo.pdfFile && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    if (onUploadPDF) onUploadPDF(artigo);
                  }}
                >
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Upload PDF
                </DropdownMenuItem>
              )}

              {/* Submenu de Status */}
              <DropdownMenuItem>
                <span className="mr-2">Status:</span>
              </DropdownMenuItem>

              {artigo.status !== "analisado" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    if (onChangeStatus) onChangeStatus("analisado");
                  }}
                >
                  <CheckIcon className="mr-2 h-4 w-4 text-green-600" />
                  Marcar como analisado
                </DropdownMenuItem>
              )}

              {artigo.status !== "pendente" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    if (onChangeStatus) onChangeStatus("pendente");
                  }}
                >
                  <ClockIcon className="mr-2 h-4 w-4 text-amber-600" />
                  Marcar como pendente
                </DropdownMenuItem>
              )}

              {artigo.status !== "excluido" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    if (onChangeStatus) onChangeStatus("excluido");
                  }}
                >
                  <XIcon className="mr-2 h-4 w-4 text-red-600" />
                  Marcar como excluído
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  if (onDelete) onDelete(artigo);
                }}
                className="text-red-600"
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                Deletar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Informações do Artigo */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-medium">
          {artigo.title || artigo.titulo}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {artigo.authors || artigo.autores}
        </p>
        <div className="mt-auto pt-3 flex justify-between items-center text-xs">
          <span>{artigo.year || artigo.ano}</span>
          <span className="line-clamp-1 text-muted-foreground">
            {artigo.journal || artigo.revista}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ArtigoCard;
