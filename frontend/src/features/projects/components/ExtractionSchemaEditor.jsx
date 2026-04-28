import { PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import PlanningActionButton from "./PlanningActionButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Numero" },
  { value: "single_select", label: "Selecao unica" },
  { value: "multi_select", label: "Selecao multipla" },
  { value: "boolean", label: "Booleano" },
];

function ExtractionSchemaEditor({
  fields = [],
  isGenerating = false,
  onAddField,
  onGenerateWithAI,
  onRemoveField,
  onUpdateField,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-[var(--syn-text-primary)]">Esquema de extracao</Label>
          <p className="text-xs text-[var(--syn-text-secondary)]">
            Cada coluna representa uma pergunta de pesquisa e armazena a resposta extraida do artigo.
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
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onAddField}>
            <PlusIcon className="h-3.5 w-3.5" />
            Adicionar campo
          </Button>
        </div>
      </div>

      {fields.length ? (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const usesOptions =
              field.type === "single_select" || field.type === "multi_select";

            return (
              <div
                key={field.key}
                className="space-y-3 rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--syn-text-primary)]">
                      {field.label || `Campo ${index + 1}`}
                    </p>
                    <p className="text-xs text-[var(--syn-text-secondary)]">
                      Chave: <code>{field.key}</code>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-red-500"
                    onClick={() => onRemoveField(index)}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Remover
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-[1.3fr_220px]">
                  <div className="space-y-2">
                    <Label className="text-[var(--syn-text-primary)]">Rotulo</Label>
                    <Input
                      value={field.label || ""}
                      onChange={(event) =>
                        onUpdateField(index, { label: event.target.value })
                      }
                      placeholder="Ex: Desenho do estudo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[var(--syn-text-primary)]">Tipo</Label>
                    <Select
                      value={field.type || "text"}
                      onValueChange={(value) => onUpdateField(index, { type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {usesOptions ? (
                  <div className="space-y-2">
                    <Label className="text-[var(--syn-text-primary)]">Opcoes</Label>
                    <Textarea
                      rows={3}
                      value={(field.options || []).join("\n")}
                      onChange={(event) =>
                        onUpdateField(index, { options: event.target.value })
                      }
                      placeholder="Uma opcao por linha"
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--syn-border)] px-4 py-6 text-sm text-[var(--syn-text-secondary)]">
          Nenhum campo de extracao configurado ainda.
        </div>
      )}
    </div>
  );
}

export default ExtractionSchemaEditor;
