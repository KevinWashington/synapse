import { PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import PlanningActionButton from "./PlanningActionButton";

function QualityCriteriaEditor({
  criteria = [],
  isGenerating = false,
  onAddCriterion,
  onGenerateWithAI,
  onRemoveCriterion,
  onUpdateCriterion,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-[var(--syn-text-primary)]">Criterios de qualidade</Label>
          <p className="text-xs text-[var(--syn-text-secondary)]">
            Cada criterio usa a escala fixa: yes, partial, no, na.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onGenerateWithAI ? (
            <PlanningActionButton
              onClick={onGenerateWithAI}
              loading={isGenerating}
              disabled={isGenerating}
              label="Gerar com IA"
            />
          ) : null}
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onAddCriterion}>
            <PlusIcon className="h-3.5 w-3.5" />
            Adicionar criterio
          </Button>
        </div>
      </div>

      {criteria.length ? (
        <div className="space-y-3">
          {criteria.map((criterion, index) => (
            <div
              key={criterion.key}
              className="space-y-2 rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--syn-text-primary)]">
                    {criterion.label || `Criterio ${index + 1}`}
                  </p>
                  <p className="text-xs text-[var(--syn-text-secondary)]">
                    Chave: <code>{criterion.key}</code>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-red-500"
                  onClick={() => onRemoveCriterion(index)}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Remover
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--syn-text-primary)]">Rotulo</Label>
                <Input
                  value={criterion.label || ""}
                  onChange={(event) => onUpdateCriterion(index, event.target.value)}
                  placeholder="Ex: Risco de vies"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--syn-border)] px-4 py-6 text-sm text-[var(--syn-text-secondary)]">
          Nenhum criterio de qualidade configurado ainda.
        </div>
      )}
    </div>
  );
}

export default QualityCriteriaEditor;
