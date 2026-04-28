import { useEffect, useMemo, useState } from "react";
import { LoaderIcon, SaveIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/layout";
import { cn } from "@/lib/utils";

const QUALITY_OPTIONS = [
  { value: "yes", label: "Sim" },
  { value: "partial", label: "Parcial" },
  { value: "no", label: "Nao" },
  { value: "na", label: "NA" },
];

const FIELD_TYPE_LABELS = {
  text: "Texto",
  number: "Numero",
  single_select: "Selecao unica",
  multi_select: "Selecao multipla",
  boolean: "Booleano",
};

function buildExtractionPayload(schema, values) {
  return Object.fromEntries(
    (schema || []).map((field) => [field.key, values[field.key] ?? null])
  );
}

function buildQualityPayload(schema, values) {
  return Object.fromEntries(
    (schema || []).map((criterion) => [criterion.key, values[criterion.key] ?? null])
  );
}

function formatQualityRating(value) {
  if (value === "high") return "Alta";
  if (value === "medium") return "Media";
  if (value === "low") return "Baixa";
  return "Sem nota";
}

function updateMultiSelectValue(currentValue, option) {
  const source = Array.isArray(currentValue) ? currentValue : [];
  if (source.includes(option)) {
    return source.filter((item) => item !== option);
  }
  return [...source, option];
}

function ArticleEvidenceEditor({
  article,
  className,
  formId,
  project,
  isSaving,
  onSave,
  showFooterActions = true,
  variant = "default",
}) {
  const extractionSchema = project?.dataExtractionSchema || [];
  const qualitySchema = project?.qualityAssessmentSchema || [];
  const [extractionValues, setExtractionValues] = useState({});
  const [qualityValues, setQualityValues] = useState({});
  const isWorkspaceVariant = variant === "workspace";
  const fieldControlClass =
    "min-h-9 rounded-md border-[#dfe4ef] bg-white text-xs text-[#33405f] shadow-none focus-visible:ring-[#6259ff]/20";

  const isIncluded = useMemo(() => {
    if (!article) {
      return false;
    }
    return article.reviewOutcome === "included" || article.manualDecision === "incluido";
  }, [article]);

  useEffect(() => {
    setExtractionValues(article?.extractionData || {});
    setQualityValues(article?.qualityAssessmentAnswers || {});
  }, [article]);

  async function handleSubmit(event) {
    event.preventDefault();
    const submitterValue = event.nativeEvent?.submitter?.value;
    await onSave({
      extractionData: buildExtractionPayload(extractionSchema, extractionValues),
      qualityAssessmentAnswers: buildQualityPayload(qualitySchema, qualityValues),
      markExtractionComplete: submitterValue === "complete",
    });
  }

  if (!isIncluded) {
    return (
      <EmptyState
        title="Extracao estruturada bloqueada"
        description="Conclua a elegibilidade e inclua este artigo no corpus final antes de preencher os dados de extracao e qualidade."
      />
    );
  }

  if (!extractionSchema.length && !qualitySchema.length) {
    return (
      <EmptyState
        title="Nenhum esquema de extracao configurado"
        description="Volte ao planejamento do projeto e defina primeiro os campos de extracao ou criterios de qualidade."
      />
    );
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className={cn("flex h-full flex-col", className)}>
      <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", isWorkspaceVariant ? "space-y-5" : "space-y-4")}>
        {!isWorkspaceVariant ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--syn-text-secondary)]">
              Nota salva
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--syn-text-primary)]">
              {article?.qualityScore != null ? `${article.qualityScore}%` : "-"}
            </p>
            <p className="mt-1 text-sm text-[var(--syn-text-secondary)]">
              Classificacao: {formatQualityRating(article?.qualityRating)}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--syn-text-secondary)]">
              Esquemas ativos
            </p>
            <p className="mt-2 text-sm text-[var(--syn-text-primary)]">
              {extractionSchema.length} campo(s) de extracao
            </p>
            <p className="mt-1 text-sm text-[var(--syn-text-primary)]">
              {qualitySchema.length} criterio(s) de qualidade
            </p>
          </div>
        </div>
        ) : null}

        {extractionSchema.length ? (
          <section
            className={cn(
              "space-y-3",
              !isWorkspaceVariant && "rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4"
            )}
          >
            <div>
              <p className="text-sm font-semibold text-[#111936]">
                {isWorkspaceVariant ? "Informacoes gerais" : "Extracao de dados"}
              </p>
              {!isWorkspaceVariant ? (
                <p className="text-xs text-[var(--syn-text-secondary)]">
                  Preencha os campos estruturados configurados para este projeto.
                </p>
              ) : null}
            </div>

            <div className={cn(isWorkspaceVariant ? "grid gap-3 md:grid-cols-2" : "space-y-4")}>
              {extractionSchema.map((field) => {
                const currentValue = extractionValues[field.key];
                const usesOptions =
                  field.type === "single_select" || field.type === "multi_select";

                return (
                  <div key={field.key} className={cn("space-y-2", field.type === "text" && isWorkspaceVariant && "md:col-span-2")}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className={cn(isWorkspaceVariant ? "text-xs font-medium text-[#56627f]" : "text-[var(--syn-text-primary)]")}>{field.label}</Label>
                        {!isWorkspaceVariant ? (
                          <p className="text-[11px] text-[var(--syn-text-secondary)]">
                            <code>{field.key}</code> | {FIELD_TYPE_LABELS[field.type] || field.type}
                          </p>
                        ) : null}
                      </div>
                      {(currentValue !== undefined &&
                        currentValue !== null &&
                        currentValue !== "" &&
                        (!Array.isArray(currentValue) || currentValue.length)) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn("gap-1.5 text-[var(--syn-text-secondary)]", isWorkspaceVariant && "h-6 px-1")}
                          onClick={() =>
                            setExtractionValues((current) => ({
                              ...current,
                              [field.key]: field.type === "multi_select" ? [] : null,
                            }))
                          }
                        >
                          <XIcon className="h-3.5 w-3.5" />
                          {!isWorkspaceVariant ? "Limpar" : null}
                        </Button>
                      ) : null}
                    </div>

                    {field.type === "text" ? (
                      <Textarea
                        rows={isWorkspaceVariant ? 2 : 3}
                        value={currentValue || ""}
                        onChange={(event) =>
                          setExtractionValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className={isWorkspaceVariant ? fieldControlClass : undefined}
                        placeholder={`Digite ${String(field.label || "valor").toLowerCase()}...`}
                      />
                    ) : null}

                    {field.type === "number" ? (
                      <Input
                        type="number"
                        value={currentValue ?? ""}
                        onChange={(event) =>
                          setExtractionValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className={isWorkspaceVariant ? fieldControlClass : undefined}
                        placeholder="0"
                      />
                    ) : null}

                    {field.type === "single_select" ? (
                      <Select
                        value={currentValue || "__empty__"}
                        onValueChange={(value) =>
                          setExtractionValues((current) => ({
                            ...current,
                            [field.key]: value === "__empty__" ? null : value,
                          }))
                        }
                      >
                        <SelectTrigger className={isWorkspaceVariant ? fieldControlClass : undefined}>
                          <SelectValue placeholder="Selecione uma opcao" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">Sem valor</SelectItem>
                          {(field.options || []).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}

                    {field.type === "multi_select" ? (
                      <div className="flex flex-wrap gap-2">
                        {(field.options || []).map((option) => {
                          const selected = Array.isArray(currentValue) && currentValue.includes(option);
                          return (
                            <Button
                              key={option}
                              type="button"
                              size="sm"
                              variant={selected ? "default" : "outline"}
                              className={cn(
                                isWorkspaceVariant && "h-7 rounded-md px-2 text-[11px]",
                                isWorkspaceVariant && selected && "bg-[#eef1ff] text-[#33405f] hover:bg-[#e3e7ff]"
                              )}
                              onClick={() =>
                                setExtractionValues((current) => ({
                                  ...current,
                                  [field.key]: updateMultiSelectValue(current[field.key], option),
                                }))
                              }
                            >
                              {option}
                            </Button>
                          );
                        })}
                      </div>
                    ) : null}

                    {field.type === "boolean" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={currentValue === true ? "default" : "outline"}
                          className={isWorkspaceVariant ? "h-7 rounded-md px-3 text-[11px]" : undefined}
                          onClick={() =>
                            setExtractionValues((current) => ({
                              ...current,
                              [field.key]: true,
                            }))
                          }
                        >
                          Sim
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={currentValue === false ? "default" : "outline"}
                          className={isWorkspaceVariant ? "h-7 rounded-md px-3 text-[11px]" : undefined}
                          onClick={() =>
                            setExtractionValues((current) => ({
                              ...current,
                              [field.key]: false,
                            }))
                          }
                        >
                          Nao
                        </Button>
                      </div>
                    ) : null}

                    {usesOptions && !(field.options || []).length ? (
                      <p className="text-xs text-[var(--syn-text-secondary)]">
                        Este campo ainda nao possui opcoes configuradas.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {qualitySchema.length ? (
          <section
            className={cn(
              "space-y-3",
              !isWorkspaceVariant && "rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4"
            )}
          >
            <div>
              <p className="text-sm font-semibold text-[#111936]">Avaliacao de qualidade</p>
              {!isWorkspaceVariant ? (
                <p className="text-xs text-[var(--syn-text-secondary)]">
                  Use a escala fixa para registrar a avaliacao de cada criterio.
                </p>
              ) : null}
            </div>

            <div className={cn(isWorkspaceVariant ? "grid gap-3 md:grid-cols-2" : "space-y-4")}>
              {qualitySchema.map((criterion) => (
                <div key={criterion.key} className="space-y-2">
                  <div>
                    <Label className={cn(isWorkspaceVariant ? "text-xs font-medium text-[#56627f]" : "text-[var(--syn-text-primary)]")}>{criterion.label}</Label>
                    {!isWorkspaceVariant ? (
                      <p className="text-[11px] text-[var(--syn-text-secondary)]">
                        <code>{criterion.key}</code>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {QUALITY_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={qualityValues[criterion.key] === option.value ? "default" : "outline"}
                        className={isWorkspaceVariant ? "h-7 rounded-md px-3 text-[11px]" : undefined}
                        onClick={() =>
                          setQualityValues((current) => ({
                            ...current,
                            [criterion.key]:
                              current[criterion.key] === option.value ? null : option.value,
                          }))
                        }
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {showFooterActions ? (
      <div className="flex items-center justify-end gap-2 border-t border-[var(--syn-border)] px-4 py-3">
        <Button type="submit" value="draft" disabled={isSaving} className="gap-2">
          {isSaving ? (
            <>
              <LoaderIcon className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <SaveIcon className="h-4 w-4" />
              Salvar extracao
            </>
          )}
        </Button>
      </div>
      ) : null}
    </form>
  );
}

export default ArticleEvidenceEditor;
