import { memo, useCallback } from "react";
import { LoaderIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import ProjectStatusSelector from "./ProjectStatusSelector";

function EditProjectPanel({
  isOpen,
  loading,
  value,
  onClose,
  onSave,
  onFieldChange,
}) {
  const handleTitleChange = useCallback(
    (event) => {
      onFieldChange("title", event.target.value);
    },
    [onFieldChange]
  );

  const handleObjetivoChange = useCallback(
    (event) => {
      onFieldChange("objetivo", event.target.value);
    },
    [onFieldChange]
  );

  const handleStatusChange = useCallback(
    (status) => {
      onFieldChange("status", status);
    },
    [onFieldChange]
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilIcon className="h-4 w-4 text-[#6259ff]" />
            Editar Projeto
          </DialogTitle>
          <DialogDescription>
            Atualize as informacoes do projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-title" className="text-[var(--syn-text-primary)]">
              Titulo
            </Label>
            <Input id="edit-title" value={value.title} onChange={handleTitleChange} />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="edit-objetivo"
              className="text-[var(--syn-text-primary)]"
            >
              Objetivo
            </Label>
            <Textarea
              id="edit-objetivo"
              value={value.objetivo}
              onChange={handleObjetivoChange}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[var(--syn-text-primary)]">Status</Label>
            <ProjectStatusSelector value={value.status} onChange={handleStatusChange} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSave} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <LoaderIcon className="h-4 w-4 animate-spin" /> Salvando...
              </>
            ) : (
              "Salvar Alteracoes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default memo(EditProjectPanel);
