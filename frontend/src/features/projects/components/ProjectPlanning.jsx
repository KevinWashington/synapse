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
} from "@/components/ui/Select";
import { Loader2, Save } from "lucide-react";
import { TARGET_DATABASES } from "@/lib/frameworkConfig";
import useProjectPlanning from "@features/projects/hooks/useProjectPlanning";
import PlanningActionButton from "./PlanningActionButton";
import PlanningArrayField from "./PlanningArrayField";
import PlanningFrameworkFields from "./PlanningFrameworkFields";
import PlanningSection from "./PlanningSection";

function ProjectPlanning({ project = {} }) {
  const {
    addArrayItem,
    data,
    framework,
    frameworkComponents,
    generateCriteria,
    generateResearchQuestions,
    generateSearchStrings,
    handleSave,
    loadingMap,
    removeArrayItem,
    setTargetDatabase,
    targetDatabase,
    updateArrayItem,
    updateComponent,
    updateField,
  } = useProjectPlanning(project);

  return (
    <div className="space-y-6">
      <PlanningSection title="Informacoes Basicas">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-[var(--syn-text-primary)]">
            Titulo *
          </Label>
          <Input
            id="title"
            value={data.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Ex: Revisao Sistematica - IA na Educacao"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="objetivo" className="text-[var(--syn-text-primary)]">
            Objetivo
          </Label>
          <Textarea
            id="objetivo"
            value={data.objetivo}
            onChange={(event) => updateField("objetivo", event.target.value)}
            placeholder="Descreva o objetivo do seu projeto..."
            rows={3}
          />
        </div>
      </PlanningSection>

      <PlanningFrameworkFields
        framework={framework}
        components={frameworkComponents}
        values={data.picoc}
        onChange={updateComponent}
      />

      <PlanningSection
        title="Perguntas de Pesquisa"
        actions={
          <PlanningActionButton
            onClick={generateResearchQuestions}
            disabled={loadingMap.researchQuestions}
            loading={loadingMap.researchQuestions}
          />
        }
      >
        <PlanningArrayField
          label="Perguntas"
          fieldKey="researchQuestions"
          items={data.researchQuestions}
          placeholder="Digite uma pergunta de pesquisa..."
          isLongText={true}
          onAddItem={addArrayItem}
          onRemoveItem={removeArrayItem}
          onUpdateItem={updateArrayItem}
        />
      </PlanningSection>

      <PlanningSection title="Palavras-chave">
        <PlanningArrayField
          label="Palavras-chave"
          fieldKey="keywords"
          items={data.keywords}
          placeholder="Digite uma palavra-chave..."
          onAddItem={addArrayItem}
          onRemoveItem={removeArrayItem}
          onUpdateItem={updateArrayItem}
        />
      </PlanningSection>

      <PlanningSection
        title="Strings de Busca"
        actions={
          <div className="flex items-center gap-2">
            <Select value={targetDatabase} onValueChange={setTargetDatabase}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_DATABASES.map((db) => (
                  <SelectItem key={db.value} value={db.value}>
                    {db.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PlanningActionButton
              onClick={generateSearchStrings}
              disabled={loadingMap.searchStrings}
              loading={loadingMap.searchStrings}
            />
          </div>
        }
      >
        <PlanningArrayField
          label="Strings"
          fieldKey="searchStrings"
          items={data.searchStrings}
          placeholder="Digite uma string de busca..."
          isLongText={true}
          onAddItem={addArrayItem}
          onRemoveItem={removeArrayItem}
          onUpdateItem={updateArrayItem}
        />
      </PlanningSection>

      <PlanningSection
        title="Criterios de Inclusao e Exclusao"
        actions={
          <PlanningActionButton
            onClick={generateCriteria}
            disabled={loadingMap.criteria}
            loading={loadingMap.criteria}
          />
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <PlanningArrayField
            label="Criterios de Inclusao"
            fieldKey="criteriosInclusao"
            items={data.criteriosInclusao}
            placeholder="Digite um criterio de inclusao..."
            isLongText={true}
            onAddItem={addArrayItem}
            onRemoveItem={removeArrayItem}
            onUpdateItem={updateArrayItem}
          />
          <PlanningArrayField
            label="Criterios de Exclusao"
            fieldKey="criteriosExclusao"
            items={data.criteriosExclusao}
            placeholder="Digite um criterio de exclusao..."
            isLongText={true}
            onAddItem={addArrayItem}
            onRemoveItem={removeArrayItem}
            onUpdateItem={updateArrayItem}
          />
        </div>
      </PlanningSection>

      <PlanningSection title="Elegibilidade e Relatorio">
        <PlanningArrayField
          label="Checklist de elegibilidade"
          fieldKey="eligibilityChecklist"
          items={data.eligibilityChecklist}
          placeholder="Digite um item do checklist..."
          isLongText={true}
          onAddItem={addArrayItem}
          onRemoveItem={removeArrayItem}
          onUpdateItem={updateArrayItem}
        />

        <div className="space-y-2">
          <Label className="text-[var(--syn-text-primary)]">Guia para screening</Label>
          <Textarea
            value={data.screeningGuidance}
            onChange={(event) => updateField("screeningGuidance", event.target.value)}
            placeholder="Orientacoes para a triagem rapida por titulo e resumo..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[var(--syn-text-primary)]">Notas do relatorio de selecao</Label>
          <Textarea
            value={data.selectionReportNotes}
            onChange={(event) => updateField("selectionReportNotes", event.target.value)}
            placeholder="Observacoes metodologicas para o relatorio final..."
            rows={3}
          />
        </div>
      </PlanningSection>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loadingMap.save} className="gap-2">
          {loadingMap.save ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Salvar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default ProjectPlanning;
