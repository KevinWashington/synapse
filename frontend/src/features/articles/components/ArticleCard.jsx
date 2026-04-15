import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
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
  Sparkles,
} from "lucide-react";

function ArticleCard({
  article,
  onClick,
  onChangeStatus,
  onManualDecision,
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

  const handleCardClick = (event) => {
    if (onClick && !event.defaultPrevented) {
      onClick(article);
    }
  };

  return (
    <div
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-950"
      onClick={handleCardClick}
    >
      <div className="relative flex aspect-[3/4] items-center justify-center bg-gray-100 dark:bg-gray-900">
        <FileIcon
          className={`h-16 w-16 ${
            article.hasPdf ? "text-blue-500" : "text-gray-400"
          }`}
        />

        <div className="absolute left-2 top-2 z-10">
          {getStatusIndicator(article.status)}
        </div>

        {!article.hasPdf ? (
          <div className="absolute bottom-2 left-2 z-10">
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-600">
              Sem PDF
            </span>
          </div>
        ) : null}

        {article.aiRelevanceScore !== undefined &&
        article.aiRelevanceScore !== null ? (
          <div className="absolute bottom-2 right-2 z-10">
            <div
              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${
                article.aiSuggestedStatus === "incluido"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
              title={`IA Sugere: ${
                article.aiSuggestedStatus === "incluido" ? "Incluir" : "Excluir"
              }\nJustificativa: ${article.aiEvaluation}`}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {article.aiRelevanceScore}%
            </div>
          </div>
        ) : null}

        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-black/40 text-white hover:bg-black/60 focus:ring-0"
                onClick={(event) => event.preventDefault()}
              >
                <MoreVerticalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  onClick?.(article);
                }}
              >
                <EyeIcon className="mr-2 h-4 w-4" />
                Revisar
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  onEdit?.(article);
                }}
              >
                <EditIcon className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>

              {!article.hasPdf ? (
                <DropdownMenuItem
                  onClick={(event) => {
                    event.preventDefault();
                    onUploadPDF?.(article);
                  }}
                >
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Upload PDF
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuItem>
                <span className="mr-2">Status:</span>
              </DropdownMenuItem>

              {article.status !== "analisado" ? (
                <DropdownMenuItem
                  onClick={(event) => {
                    event.preventDefault();
                    onChangeStatus?.("analisado");
                  }}
                >
                  <CheckIcon className="mr-2 h-4 w-4 text-green-600" />
                  Marcar como analisado
                </DropdownMenuItem>
              ) : null}

              {article.status !== "pendente" ? (
                <DropdownMenuItem
                  onClick={(event) => {
                    event.preventDefault();
                    onChangeStatus?.("pendente");
                  }}
                >
                  <ClockIcon className="mr-2 h-4 w-4 text-amber-600" />
                  Marcar como pendente
                </DropdownMenuItem>
              ) : null}

              {article.status !== "excluido" ? (
                <DropdownMenuItem
                  onClick={(event) => {
                    event.preventDefault();
                    onChangeStatus?.("excluido");
                  }}
                >
                  <XIcon className="mr-2 h-4 w-4 text-red-600" />
                  Marcar como excluído
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuItem>
                <span className="mr-2">Triagem manual:</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  onManualDecision?.(article, "incluido");
                }}
              >
                <CheckIcon className="mr-2 h-4 w-4 text-green-600" />
                Incluir no estudo
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  onManualDecision?.(article, "excluido");
                }}
              >
                <XIcon className="mr-2 h-4 w-4 text-red-600" />
                Excluir do estudo
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  onManualDecision?.(article, "pendente");
                }}
              >
                <ClockIcon className="mr-2 h-4 w-4 text-amber-600" />
                Manter como pendente
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  onDelete?.(article);
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

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-medium">
          {article.title || article.titulo}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {article.authors || article.autores}
        </p>
        {(article.aiSuggestedRQs || []).length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {article.aiSuggestedRQs.map((rqNumber) => (
              <span
                key={`card-ai-rq-${article.id}-${rqNumber}`}
                className="rounded bg-[var(--syn-bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--syn-text-secondary)]"
              >
                {`RQ ${rqNumber}`}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-3 text-xs">
          <span>{article.year || article.ano}</span>
          <span className="line-clamp-1 text-muted-foreground">
            {article.journal || article.revista}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ArticleCard;
