import { memo, useCallback } from "react";
import { LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { SlidePanel } from "@/components/ui/SlidePanel";
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
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Projeto"
      breadcrumb="Projetos"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSave} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <LoaderIcon className="h-4 w-4 animate-spin" /> Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
            Informações do Projeto
          </h3>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-title" className="text-[var(--syn-text-primary)]">
            Título
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
    </SlidePanel>
  );
}

export default memo(EditProjectPanel);


