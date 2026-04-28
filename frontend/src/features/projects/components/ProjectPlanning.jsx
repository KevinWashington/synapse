import { useMemo, useState } from "react";
import {
  BookOpenIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CircleIcon,
  DatabaseIcon,
  DownloadIcon,
  Edit3Icon,
  FileTextIcon,
  Globe2Icon,
  LanguagesIcon,
  Loader2,
  PlusIcon,
  Save,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { TARGET_DATABASES } from "@/lib/frameworkConfig";
import useProjectPlanning from "@features/projects/hooks/useProjectPlanning";
import { cn } from "@/lib/utils";

const COMPONENT_COLORS = [
  "bg-[#7568ff] text-white",
  "bg-[#35b779] text-white",
  "bg-[#ffc156] text-white",
  "bg-[#48a9e8] text-white",
  "bg-[#ea75b8] text-white",
];

const FIELD_TYPE_LABELS = {
  text: "Texto curto",
  number: "Numero",
  single_select: "Selecao unica",
  multi_select: "Multipla selecao",
  boolean: "Sim/Nao",
};

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("pt-BR");
}

function PlanningCard({ title, description, action, children, className }) {
  return (
    <section className={cn("rounded-lg border border-[#e7ebf4] bg-white p-5 shadow-[0_10px_30px_rgba(18,27,54,0.03)]", className)}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[#111936]">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-[#56627f]">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function IconLabel({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#edf0f7] py-2.5 text-xs last:border-b-0">
      <span className="flex items-center gap-3 text-[#253252]">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f4f6fb] text-[#56627f]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </span>
      <span className="text-right text-[#56627f]">{value}</span>
    </div>
  );
}

function ArrayEditor({
  addArrayItem,
  fieldKey,
  items,
  label,
  placeholder,
  removeArrayItem,
  tone = "neutral",
  updateArrayItem,
}) {
  const [newValue, setNewValue] = useState("");
  const Icon = tone === "red" ? XCircleIcon : CheckCircle2Icon;
  const toneClass =
    tone === "green"
      ? "bg-[#edf9f3] text-[#258c55] ring-1 ring-[#d9f1e4]"
      : tone === "red"
        ? "bg-[#fff1f1] text-[#d43f3f] ring-1 ring-[#ffe1e1]"
        : "bg-[#f4f6fb] text-[#56627f] ring-1 ring-[#e8ecf4]";

  return (
    <div className={cn("rounded-md p-3", toneClass)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold">{label}</p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold">
          {(items || []).length}
        </span>
      </div>
      <div className="space-y-2">
        <div className="max-h-[188px] space-y-2 overflow-y-auto pr-1">
          {(items || []).map((item, index) => (
            <div key={`${fieldKey}-${index}`} className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" />
              <Input
                value={item}
                title={item}
                onChange={(event) => updateArrayItem(fieldKey, index, event.target.value)}
                className="h-8 truncate border-transparent bg-white/75 text-xs text-[#253252] shadow-none"
              />
              <button
                type="button"
                onClick={() => removeArrayItem(fieldKey, index)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/70"
                aria-label="Remover item"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            placeholder={placeholder}
            className="h-8 border-transparent bg-white/75 text-xs shadow-none"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 bg-white/80"
            onClick={() => {
              addArrayItem(fieldKey, newValue);
              setNewValue("");
            }}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CriteriaSummaryGroup({ items, label, tone }) {
  const isExclusion = tone === "red";
  const Icon = isExclusion ? XCircleIcon : CheckCircle2Icon;
  const toneClass = isExclusion
    ? "border-[#ffe1e1] bg-[#fff6f6] text-[#d43f3f]"
    : "border-[#d9f1e4] bg-[#f2fbf6] text-[#258c55]";
  const visibleItems = (items || []).slice(0, 3);
  const hiddenCount = Math.max((items || []).length - visibleItems.length, 0);

  return (
    <div className={cn("min-w-0 rounded-md border p-3", toneClass)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold">{label}</p>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold">
          {(items || []).length}
        </span>
      </div>
      <div className="space-y-2">
        {visibleItems.length ? (
          visibleItems.map((item, index) => (
            <div key={`${label}-${index}`} className="flex min-w-0 items-center gap-2 rounded-md bg-white/75 px-2 py-2">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="block min-w-0 truncate text-xs text-[#253252]" title={item}>
                {item}
              </span>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-white/80 px-3 py-4 text-center text-xs">
            Nenhum criterio definido
          </div>
        )}
        {hiddenCount > 0 ? (
          <p className="px-1 text-[11px] font-medium">
            +{hiddenCount} criterios no editor
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EligibilityCriteriaSummary({ inclusionItems, exclusionItems }) {
  const total = (inclusionItems || []).length + (exclusionItems || []).length;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-[#edf0f7] bg-[#fbfcff] px-3 py-2">
        <span className="text-xs font-semibold text-[#253252]">{total} criterios definidos</span>
      </div>
      <CriteriaSummaryGroup items={inclusionItems} label="Inclusao" tone="green" />
      <CriteriaSummaryGroup items={exclusionItems} label="Exclusao" tone="red" />
    </div>
  );
}

function SearchStringsEditor({
  articleCount,
  items,
  lastUpdatedAt,
  onAdd,
  onRemove,
  onUpdate,
}) {
  const [newSearchString, setNewSearchString] = useState("");
  const [editingSearchIndex, setEditingSearchIndex] = useState(null);
  const databaseStyles = [
    { label: "Scopus", mark: "S", color: "bg-[#fff4e8] text-[#ff7a00]" },
    { label: "Web of Science", mark: "W", color: "bg-[#f0edff] text-[#6a35ff]" },
    { label: "IEEE Xplore", mark: "I", color: "bg-[#e9f2ff] text-[#1f79c6]" },
    { label: "ScienceDirect", mark: "SD", color: "bg-[#fff4e8] text-[#ff7a00]" },
  ];

  function handleAdd() {
    const trimmedValue = newSearchString.trim();
    if (!trimmedValue) {
      return;
    }

    onAdd("searchStrings", trimmedValue);
    setNewSearchString("");
  }

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[150px_1fr_82px_114px_76px] gap-3 px-1 text-[11px] font-medium text-[#667391] md:grid">
        <span>Base</span>
        <span>String de busca</span>
        <span>Resultados</span>
        <span>Ultima atualizacao</span>
        <span />
      </div>

      <div className="divide-y divide-[#edf0f7]">
        {(items || []).length ? (
          items.map((searchString, index) => (
            <div
              key={`search-string-${index}`}
              className="grid gap-3 py-3 md:grid-cols-[150px_1fr_82px_114px_76px] md:items-center"
            >
              <div className="flex items-center gap-3">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold", databaseStyles[index % databaseStyles.length].color)}>
                  {databaseStyles[index % databaseStyles.length].mark}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#253252]">
                    {databaseStyles[index % databaseStyles.length].label}
                  </p>
                  <span className="mt-1 inline-flex rounded-full bg-[#dff5e9] px-2 py-0.5 text-[10px] font-semibold text-[#258c55]">
                    Ativo
                  </span>
                </div>
              </div>
              {editingSearchIndex === index ? (
                <Textarea
                  id={`search-string-${index}`}
                  value={searchString}
                  onChange={(event) => onUpdate("searchStrings", index, event.target.value)}
                  rows={3}
                  className="h-24 resize-none overflow-y-auto border-[#dfe4ef] bg-white text-xs leading-5 text-[#253252] shadow-none"
                  onBlur={() => setEditingSearchIndex(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingSearchIndex(index)}
                  title={searchString}
                  className="max-h-12 overflow-hidden rounded-md bg-[#fbfcff] px-3 py-2 text-left text-xs leading-5 text-[#253252] shadow-none hover:bg-[#f4f6fb]"
                >
                  <span className="line-clamp-2">{searchString}</span>
                </button>
              )}
              <span className="text-xs font-medium text-[#253252]">{articleCount}</span>
              <span className="text-xs text-[#56627f]">{formatDate(lastUpdatedAt)}</span>
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setEditingSearchIndex(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e7ebf4] text-[#253252] hover:bg-[#f4f6fb]"
                  aria-label="Editar string"
                >
                  <Edit3Icon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove("searchStrings", index)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e7ebf4] text-[#667391] hover:bg-[#f4f6fb]"
                  aria-label="Remover string"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[#dfe4ef] bg-[#fbfcff] px-4 py-6 text-center">
            <p className="text-sm font-semibold text-[#253252]">Nenhuma string cadastrada</p>
            <p className="mt-1 text-xs text-[#667391]">
              Gere automaticamente com IA ou adicione uma string manualmente.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-md border border-[#edf0f7] bg-[#fbfcff] p-3">
        <p className="mb-2 text-xs font-semibold text-[#253252]">Adicionar string de busca</p>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <Textarea
            value={newSearchString}
            onChange={(event) => setNewSearchString(event.target.value)}
            placeholder="Cole uma nova string de busca..."
            rows={2}
            className="min-h-[58px] border-[#dfe4ef] bg-white text-xs shadow-none"
          />
          <Button
            type="button"
            variant="outline"
            className="h-full min-h-[58px] gap-2 border-[#dfe4ef] bg-white"
            onClick={handleAdd}
            disabled={!newSearchString.trim()}
          >
            <PlusIcon className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResearchQuestionsEditor({
  addArrayItem,
  items,
  removeArrayItem,
  updateArrayItem,
}) {
  const [newQuestion, setNewQuestion] = useState("");
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);

  function handleAdd() {
    const trimmedValue = newQuestion.trim();
    if (!trimmedValue) {
      return;
    }

    addArrayItem("researchQuestions", trimmedValue);
    setNewQuestion("");
  }

  return (
    <div className="space-y-3">
      <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
        {(items || []).length ? (
          items.map((question, index) => (
            <div key={`research-question-${index}`} className="rounded-md border border-[#edf0f7] bg-[#fbfcff] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#eef1ff] px-2 py-0.5 text-[10px] font-semibold text-[#6259ff]">
                  RQ{index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingQuestionIndex(index)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#56627f] hover:bg-[#eef1f7]"
                    aria-label="Editar pergunta"
                  >
                    <Edit3Icon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeArrayItem("researchQuestions", index)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#56627f] hover:bg-[#eef1f7]"
                    aria-label="Remover pergunta"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {editingQuestionIndex === index ? (
                <Textarea
                  value={question}
                  onChange={(event) => updateArrayItem("researchQuestions", index, event.target.value)}
                  onBlur={() => setEditingQuestionIndex(null)}
                  rows={3}
                  className="h-24 resize-none overflow-y-auto border-[#dfe4ef] bg-white text-xs leading-5 text-[#253252] shadow-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingQuestionIndex(index)}
                  title={question}
                  className="block max-h-12 w-full overflow-hidden text-left text-xs leading-5 text-[#253252]"
                >
                  <span className="line-clamp-2">{question}</span>
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[#dfe4ef] bg-[#fbfcff] px-4 py-6 text-center">
            <p className="text-sm font-semibold text-[#253252]">Nenhuma pergunta cadastrada</p>
            <p className="mt-1 text-xs text-[#667391]">
              Gere com IA a partir do framework ou adicione manualmente.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-md border border-[#edf0f7] bg-[#fbfcff] p-3">
        <p className="mb-2 text-xs font-semibold text-[#253252]">Adicionar pergunta</p>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <Textarea
            value={newQuestion}
            onChange={(event) => setNewQuestion(event.target.value)}
            placeholder="Digite uma pergunta de pesquisa..."
            rows={2}
            className="min-h-[58px] resize-none border-[#dfe4ef] bg-white text-xs shadow-none"
          />
          <Button
            type="button"
            variant="outline"
            className="h-full min-h-[58px] gap-2 border-[#dfe4ef] bg-white"
            onClick={handleAdd}
            disabled={!newQuestion.trim()}
          >
            <PlusIcon className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}

function exportPlanning(project, data) {
  const payload = {
    projectId: project.id,
    title: data.title,
    objetivo: data.objetivo,
    framework: project.framework,
    picoc: data.picoc,
    researchQuestions: data.researchQuestions,
    keywords: data.keywords,
    searchStrings: data.searchStrings,
    criteriosInclusao: data.criteriosInclusao,
    criteriosExclusao: data.criteriosExclusao,
    eligibilityChecklist: data.eligibilityChecklist,
    dataExtractionSchema: data.dataExtractionSchema,
    qualityAssessmentSchema: data.qualityAssessmentSchema,
    screeningGuidance: data.screeningGuidance,
    selectionReportNotes: data.selectionReportNotes,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `planejamento-projeto-${project.id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ProjectPlanning({ project = {}, onProjectUpdated }) {
  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
  const {
    addExtractionField,
    addArrayItem,
    addQualityCriterion,
    data,
    framework,
    frameworkComponents,
    generateCriteria,
    generateExtractionSchema,
    generateQualityAssessmentSchema,
    generateResearchQuestions,
    generateSearchStrings,
    handleSave,
    loadingMap,
    removeExtractionField,
    removeArrayItem,
    removeQualityCriterion,
    setTargetDatabase,
    targetDatabase,
    updateExtractionField,
    updateArrayItem,
    updateComponent,
    updateField,
    updateQualityCriterion,
  } = useProjectPlanning(project, onProjectUpdated);

  const completion = useMemo(() => {
    const checks = [
      frameworkComponents.filter((component) => component.required).every((component) => data.picoc?.[component.key]?.trim()),
      (data.researchQuestions || []).length > 0,
      (data.searchStrings || []).length > 0,
      (data.criteriosInclusao || []).length > 0 || (data.criteriosExclusao || []).length > 0,
      (data.dataExtractionSchema || []).length > 0,
      Boolean(data.screeningGuidance || data.selectionReportNotes || (data.qualityAssessmentSchema || []).length),
    ];
    const done = checks.filter(Boolean).length;
    return {
      done,
      total: checks.length,
      percent: Math.round((done / checks.length) * 100),
      checks,
    };
  }, [data, frameworkComponents]);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-lg border-[#dfe4ef] bg-white text-[#182344] shadow-none"
            onClick={() => exportPlanning(project, data)}
          >
            <DownloadIcon className="h-4 w-4" />
            Exportar planejamento
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loadingMap.save}
            className="h-10 gap-2 rounded-lg bg-[#6259ff] px-5 text-white hover:bg-[#5148ee]"
          >
            {loadingMap.save ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alteracoes
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.55fr)]">
        <PlanningCard
          title={framework}
          description="Defina a pergunta de pesquisa estruturada."
          action={
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white">
              <Edit3Icon className="h-4 w-4" />
              Editar
            </Button>
          }
        >
          <div className="divide-y divide-[#edf0f7]">
            {frameworkComponents.map((component, index) => (
              <div key={component.key} className="grid gap-3 py-3 md:grid-cols-[190px_1fr] md:items-center">
                <div className="flex items-center gap-3 text-sm font-semibold text-[#253252]">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-xs", COMPONENT_COLORS[index % COMPONENT_COLORS.length])}>
                    {component.labelPt.slice(0, 1)}
                  </span>
                  {component.labelPt}
                </div>
                <Input
                  value={data.picoc?.[component.key] || ""}
                  onChange={(event) => updateComponent(component.key, event.target.value)}
                  placeholder={component.placeholder}
                  className="h-9 border-transparent bg-[#fbfcff] text-sm text-[#253252] shadow-none"
                />
              </div>
            ))}
          </div>
        </PlanningCard>

        <PlanningCard
          title="Perguntas de pesquisa"
          description="Defina as perguntas que orientam a revisao sistematica."
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white"
              onClick={generateResearchQuestions}
              disabled={loadingMap.researchQuestions}
            >
              {loadingMap.researchQuestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
              Gerar
            </Button>
          }
        >
          <ResearchQuestionsEditor
            addArrayItem={addArrayItem}
            items={data.researchQuestions || []}
            removeArrayItem={removeArrayItem}
            updateArrayItem={updateArrayItem}
          />
        </PlanningCard>
      </div>

      <div className="grid gap-5">
        <PlanningCard
          title="Estrategia de busca"
          description="Gerencie as strings de busca para as bases de dados."
          action={
            <div className="flex items-center gap-2">
              <Select value={targetDatabase} onValueChange={setTargetDatabase}>
                <SelectTrigger className="h-9 w-[150px] border-[#dfe4ef] bg-white text-xs shadow-none">
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
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white"
                onClick={generateSearchStrings}
                disabled={loadingMap.searchStrings}
              >
                {loadingMap.searchStrings ? <Loader2 className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
                Gerar
              </Button>
            </div>
          }
        >
          <SearchStringsEditor
            articleCount={project?.prismaStats?.identified || 0}
            items={data.searchStrings || []}
            lastUpdatedAt={project.updatedAt}
            onAdd={addArrayItem}
            onRemove={removeArrayItem}
            onUpdate={updateArrayItem}
          />
        </PlanningCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <PlanningCard
          title="Criterios de elegibilidade"
          description="Defina os criterios para inclusao e exclusao de estudos."
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white"
                onClick={() => setCriteriaDialogOpen(true)}
              >
                <Edit3Icon className="h-4 w-4" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white"
                onClick={generateCriteria}
                disabled={loadingMap.criteria}
              >
                {loadingMap.criteria ? <Loader2 className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
                Gerar
              </Button>
            </div>
          }
        >
          <EligibilityCriteriaSummary
            inclusionItems={data.criteriosInclusao}
            exclusionItems={data.criteriosExclusao}
          />
        </PlanningCard>

        <PlanningCard
          title="Extracao de dados"
          description="Configure os campos que serao extraidos dos estudos."
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white"
                onClick={generateExtractionSchema}
                disabled={loadingMap.extractionSchema}
              >
                {loadingMap.extractionSchema ? <Loader2 className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
                Gerar
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-lg border-[#dfe4ef] bg-white" onClick={addExtractionField}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-[minmax(0,1fr)_130px_36px] gap-3 border-b border-[#edf0f7] pb-2 text-xs font-medium text-[#667391]">
            <span>Campo</span>
            <span>Tipo</span>
            <span />
          </div>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pt-2">
            {(data.dataExtractionSchema || []).map((field, index) => (
              <div key={field.key || index} className="grid grid-cols-[minmax(0,1fr)_130px_36px] gap-3">
                <Input
                  value={field.label || ""}
                  onChange={(event) => updateExtractionField(index, { label: event.target.value })}
                  className="h-8 border-transparent bg-[#fbfcff] text-xs text-[#253252] shadow-none"
                />
                <Select value={field.type || "text"} onValueChange={(value) => updateExtractionField(index, { type: value })}>
                  <SelectTrigger className="h-8 border-transparent bg-[#fbfcff] text-xs shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => removeExtractionField(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[#667391] hover:bg-[#f4f6fb]"
                  aria-label="Remover campo"
                >
                  <Trash2Icon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </PlanningCard>

        <PlanningCard title="Outras configuracoes" description="Defina outras opcoes da revisao.">
          <div>
            <IconLabel icon={LanguagesIcon} label="Idiomas" value="Defina nos criterios" />
            <IconLabel icon={CalendarIcon} label="Periodo de publicacao" value="Defina nos criterios" />
            <IconLabel icon={FileTextIcon} label="Tipos de documento" value={`${data.qualityAssessmentSchema?.length || 0} criterios de qualidade`} />
            <IconLabel icon={UsersIcon} label="Revisores" value="Voce" />
            <IconLabel icon={ShieldCheckIcon} label="Resolucao de conflitos" value="Por consenso" />
            <IconLabel icon={DatabaseIcon} label="Armazenamento de arquivos" value="Banco de dados" />
            <IconLabel icon={Globe2Icon} label="Framework" value={framework} />
          </div>
        </PlanningCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <PlanningCard
          title="Guia para screening"
          description="Oriente a triagem por titulo e resumo sem misturar com as configuracoes gerais."
        >
          <Textarea
            value={data.screeningGuidance}
            onChange={(event) => updateField("screeningGuidance", event.target.value)}
            placeholder="Orientacoes para triagem por titulo e resumo..."
            rows={5}
            className="min-h-[132px] resize-none overflow-y-auto border-[#e7ebf4] bg-[#fbfcff] text-xs shadow-none"
          />
        </PlanningCard>

        <PlanningCard
          title="Criterios de qualidade"
          description="Defina os criterios usados para avaliacao de qualidade dos estudos."
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={addQualityCriterion}>
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white"
                onClick={generateQualityAssessmentSchema}
                disabled={loadingMap.qualityAssessmentSchema}
              >
                {loadingMap.qualityAssessmentSchema ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SparklesIcon className="h-3.5 w-3.5" />}
                Gerar
              </Button>
            </div>
          }
        >
          <div className="max-h-[168px] space-y-2 overflow-y-auto pr-1">
            {(data.qualityAssessmentSchema || []).map((criterion, index) => (
              <div key={criterion.key || index} className="flex items-center gap-2">
                <Input
                  value={criterion.label || ""}
                  title={criterion.label || ""}
                  onChange={(event) => updateQualityCriterion(index, event.target.value)}
                  className="h-9 truncate border-[#e7ebf4] bg-[#fbfcff] text-xs shadow-none"
                />
                <button
                  type="button"
                  onClick={() => removeQualityCriterion(index)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#667391] hover:bg-[#f4f6fb]"
                  aria-label="Remover criterio"
                >
                  <Trash2Icon className="h-4 w-4" />
                </button>
              </div>
            ))}
            {!(data.qualityAssessmentSchema || []).length ? (
              <div className="rounded-md border border-dashed border-[#dfe4ef] bg-[#fbfcff] px-4 py-6 text-center">
                <p className="text-sm font-semibold text-[#253252]">Nenhum criterio definido</p>
                <p className="mt-1 text-xs text-[#667391]">Adicione manualmente ou gere com IA.</p>
              </div>
            ) : null}
          </div>
        </PlanningCard>
      </div>

      <PlanningCard title="Resumo do planejamento" description="Visao geral do seu planejamento atual.">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_140px] lg:items-center">
          <div className="grid gap-4 md:grid-cols-6">
            {[
              { label: framework, detail: "Framework", done: completion.checks[0], icon: Globe2Icon },
              { label: "Perguntas", detail: `${data.researchQuestions?.length || 0} perguntas`, done: completion.checks[1], icon: BookOpenIcon },
              { label: "Estrategia de busca", detail: `${data.searchStrings?.length || 0} strings`, done: completion.checks[2], icon: DatabaseIcon },
              { label: "Criterios", detail: `${(data.criteriosInclusao?.length || 0) + (data.criteriosExclusao?.length || 0)} definidos`, done: completion.checks[3], icon: ShieldCheckIcon },
              { label: "Extracao de dados", detail: `${data.dataExtractionSchema?.length || 0} campos`, done: completion.checks[4], icon: FileTextIcon },
              { label: "Configuracoes", detail: `${data.qualityAssessmentSchema?.length || 0} qualidade`, done: completion.checks[5], icon: UsersIcon },
            ].map((item, index, items) => (
              <div key={item.label} className="relative flex items-center gap-3">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", item.done ? "bg-[#e8f8ef] text-[#2fa060]" : "bg-[#f4f6fb] text-[#9aa4b8]")}>
                  {item.done ? <CheckCircle2Icon className="h-5 w-5" /> : <CircleIcon className="h-5 w-5" />}
                </span>
                <span>
                  <span className="block text-xs font-semibold text-[#253252]">{item.label}</span>
                  <span className="block text-xs text-[#667391]">{item.detail}</span>
                </span>
                {index < items.length - 1 ? (
                  <span className="pointer-events-none absolute left-[calc(100%-28px)] top-4 hidden h-px w-14 bg-[#cfd6e6] md:block" />
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[conic-gradient(#6259ff_var(--planning-progress),#edf0f7_0)]" style={{ "--planning-progress": `${completion.percent}%` }}>
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-lg font-semibold text-[#111936]">{completion.percent}%</span>
                <span className="text-xs text-[#667391]">concluido</span>
              </div>
            </div>
          </div>
        </div>
      </PlanningCard>

      <Dialog open={criteriaDialogOpen} onOpenChange={setCriteriaDialogOpen}>
        <DialogContent className="max-h-[86vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criterios de elegibilidade</DialogTitle>
            <DialogDescription>
              Edite os criterios de inclusao e exclusao usados na selecao dos estudos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <ArrayEditor
              addArrayItem={addArrayItem}
              fieldKey="criteriosInclusao"
              items={data.criteriosInclusao}
              label="Inclusao"
              placeholder="Novo criterio de inclusao..."
              removeArrayItem={removeArrayItem}
              tone="green"
              updateArrayItem={updateArrayItem}
            />
            <ArrayEditor
              addArrayItem={addArrayItem}
              fieldKey="criteriosExclusao"
              items={data.criteriosExclusao}
              label="Exclusao"
              placeholder="Novo criterio de exclusao..."
              removeArrayItem={removeArrayItem}
              tone="red"
              updateArrayItem={updateArrayItem}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="border-[#dfe4ef] bg-white">
                Concluir
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectPlanning;
