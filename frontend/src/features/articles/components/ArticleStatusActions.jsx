import { BoltIcon, ClipboardCheckIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

function ArticleStatusActions({ onChangeStatus, onDeleteArticle, onOpenDecisionDialog }) {
  return (
    <div className="mb-4 flex items-center justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
            <BoltIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onChangeStatus("pendente")}>
                Pendente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onChangeStatus("analisado")}>
                Analisado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onChangeStatus("excluido")}>
                Excluído
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {onOpenDecisionDialog ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ClipboardCheckIcon className="mr-2 h-4 w-4" />
                Decisão de triagem
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => onOpenDecisionDialog("incluido")}>
                  Incluir no estudo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenDecisionDialog("excluido")}>
                  Excluir do estudo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenDecisionDialog("pendente")}>
                  Manter pendente
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}

          <DropdownMenuItem
            className="gap-2 text-red-500 focus:bg-red-50 focus:text-red-600"
            onClick={onDeleteArticle}
          >
            <TrashIcon className="h-4 w-4" />
            Deletar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default ArticleStatusActions;
