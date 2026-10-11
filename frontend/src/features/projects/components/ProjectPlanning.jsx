import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2Icon,
  Edit3Icon,
  Loader2,
  PlusIcon,
  Save,
  SparklesIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TARGET_DATABASES } from "@/lib/frameworkConfig";
import useProjectPlanning from "@features/projects/hooks/useProjectPlanning";
import { findFirstIncompleteSection, getPlanningSectionState } from "@features/projects/utils/planningSections";
import PlanningAccordionSection from "./planning/PlanningAccordionSection";
import PlanningEditorHeader from "./planning/PlanningEditorHeader";
import PlanningSectionSearch from "./planning/PlanningSectionSearch";
import PlanningTabs from "./planning/PlanningTabs";
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
  number: "Número",
  single_select: "Seleção única",
  multi_select: "Múltipla seleção",
  boolean: "Sim/Não",
};

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("pt-BR");
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
                className="h-8 truncate border-[#dfe4ef] bg-white text-xs text-[#253252] shadow-none"
              />
              <button
                type="button"
                onClick={() => removeArrayItem(fieldKey, index)}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40"
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
            className="h-8 border-[#dfe4ef] bg-white text-xs shadow-none"
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
        <span>Última atualização</span>
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
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#e7ebf4] text-[#253252] hover:bg-[#f4f6fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40"
                  aria-label="Editar string"
                >
                  <Edit3Icon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove("searchStrings", index)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#e7ebf4] text-[#667391] hover:bg-[#f4f6fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40"
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

function ProjectPlanning({ project = {}, onDirtyChange, onProjectUpdated }) {
  const {
    catalogReady,
    catalogError,
    reloadCatalog,
    addExtractionField,
    addArrayItem,
    addQualityCriterion,
    data,
    discardChanges,
    framework,
    frameworkComponents,
    generateCriteria,
    generateExtractionSchema,
    generateQualityAssessmentSchema,
    generateResearchQuestions,
    generateSearchStrings,
    handleSave,
    isDirty,
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

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const planningState = useMemo(
    () => getPlanningSectionState({ data, framework, frameworkComponents }),
    [data, framework, frameworkComponents],
  );
  const firstIncompleteSection = findFirstIncompleteSection(planningState.sections);
  const [activeTab, setActiveTab] = useState(() => firstIncompleteSection?.tab || "foundation");
  const [expandedSectionKeys, setExpandedSectionKeys] = useState(
    () => new Set(firstIncompleteSection ? [firstIncompleteSection.key] : []),
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const sectionByKey = Object.fromEntries(planningState.sections.map((section) => [section.key, section]));

  function setSectionExpanded(sectionKey, expanded) {
    setExpandedSectionKeys((current) => {
      const next = new Set(current);
      if (expanded) next.add(sectionKey);
      else next.delete(sectionKey);
      return next;
    });
  }

  function selectSection(sectionKey) {
    const section = sectionByKey[sectionKey];
    if (!section) return;
    setActiveTab(section.tab);
    setSectionExpanded(sectionKey, true);
    setSearchOpen(false);
    window.setTimeout(() => document.getElementById(`planning-section-trigger-${sectionKey}`)?.focus(), 0);
  }

  const accordion = (sectionKey, children, actions = null) => (
    <PlanningAccordionSection
      key={sectionKey}
      section={sectionByKey[sectionKey]}
      expanded={expandedSectionKeys.has(sectionKey)}
      onExpandedChange={(expanded) => setSectionExpanded(sectionKey, expanded)}
      actions={actions}
    >
      {children}
    </PlanningAccordionSection>
  );

  const generateButton = (loading, onClick) => (
    <Button type="button" variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onClick} disabled={loading || !catalogReady}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
      Gerar
    </Button>
  );

  const visibleFrameworkComponents = frameworkComponents.length ? frameworkComponents : Object.keys(data.picoc || {}).map((key) => ({ key, labelPt: key }));
  const panels = {
    foundation: (
      <div className="space-y-3">
        {accordion("framework", (
          <div className="divide-y divide-[#edf0f7]">
            {visibleFrameworkComponents.map((component, index) => (
              <div key={component.key} className="grid gap-3 py-3 md:grid-cols-[190px_1fr] md:items-center">
                <div className="flex items-center gap-3 text-sm font-semibold text-[#253252]">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-xs", COMPONENT_COLORS[index % COMPONENT_COLORS.length])}>{component.labelPt.slice(0, 1)}</span>
                  {component.labelPt}
                </div>
                <Input readOnly={!catalogReady} value={data.picoc?.[component.key] ?? ""} onChange={(event) => updateComponent(component.key, event.target.value)} placeholder={component.placeholder} aria-label={component.labelPt} className="h-10 border-[#dfe4ef] bg-white text-sm text-[#253252] shadow-none" />
              </div>
            ))}
          </div>
        ))}
        {accordion(
          "research-questions",
          <ResearchQuestionsEditor addArrayItem={addArrayItem} items={data.researchQuestions || []} removeArrayItem={removeArrayItem} updateArrayItem={updateArrayItem} />,
          generateButton(loadingMap.researchQuestions, generateResearchQuestions),
        )}
      </div>
    ),
    selection: (
      <div className="space-y-3">
        {accordion(
          "search-strategy",
          <SearchStringsEditor articleCount={project?.prismaStats?.identified || 0} items={data.searchStrings || []} lastUpdatedAt={project.updatedAt} onAdd={addArrayItem} onRemove={removeArrayItem} onUpdate={updateArrayItem} />,
          <div className="flex flex-wrap items-center gap-2">
            <Select value={targetDatabase} onValueChange={setTargetDatabase}>
              <SelectTrigger className="h-9 w-[150px] border-[#dfe4ef] bg-white text-xs shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{TARGET_DATABASES.map((database) => <SelectItem key={database.value} value={database.value}>{database.label}</SelectItem>)}</SelectContent>
            </Select>
            {generateButton(loadingMap.searchStrings, generateSearchStrings)}
          </div>,
        )}
        {accordion(
          "eligibility-criteria",
          <div className="grid gap-4 xl:grid-cols-3">
            <ArrayEditor addArrayItem={addArrayItem} fieldKey="criteriosInclusao" items={data.criteriosInclusao} label="Inclusão" placeholder="Novo critério de inclusão..." removeArrayItem={removeArrayItem} tone="green" updateArrayItem={updateArrayItem} />
            <ArrayEditor addArrayItem={addArrayItem} fieldKey="criteriosExclusao" items={data.criteriosExclusao} label="Exclusão" placeholder="Novo critério de exclusão..." removeArrayItem={removeArrayItem} tone="red" updateArrayItem={updateArrayItem} />
            <ArrayEditor addArrayItem={addArrayItem} fieldKey="eligibilityChecklist" items={data.eligibilityChecklist} label="Checklist de elegibilidade" placeholder="Novo item do checklist..." removeArrayItem={removeArrayItem} updateArrayItem={updateArrayItem} />
          </div>,
          generateButton(loadingMap.criteria, generateCriteria),
        )}
        {accordion("screening-guidance", (
          <Textarea value={data.screeningGuidance} onChange={(event) => updateField("screeningGuidance", event.target.value)} placeholder="Orientações para triagem por título e resumo..." rows={5} className="min-h-[132px] resize-y border-[#e7ebf4] bg-[#fbfcff] text-xs shadow-none" />
        ))}
      </div>
    ),
    data: (
      <div className="space-y-3">
        {accordion(
          "extraction-schema",
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[minmax(0,1fr)_130px_36px] gap-3 border-b border-[#edf0f7] pb-2 text-xs font-medium text-[#667391]"><span>Campo</span><span>Tipo</span><span /></div>
              <div className="max-h-[360px] space-y-2 overflow-y-auto pt-2">
                {(data.dataExtractionSchema || []).map((field, index) => (
                  <div key={field.key || index} className="grid grid-cols-[minmax(0,1fr)_130px_36px] gap-3">
                    <Input value={field.label || ""} onChange={(event) => updateExtractionField(index, { label: event.target.value })} className="h-9 border-[#dfe4ef] bg-white text-xs text-[#253252] shadow-none" />
                    <Select value={field.type || "text"} onValueChange={(value) => updateExtractionField(index, { type: value })}>
                      <SelectTrigger className="h-9 border-[#dfe4ef] bg-white text-xs shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                    <button type="button" onClick={() => removeExtractionField(index)} className="flex h-9 w-9 items-center justify-center rounded-md text-[#667391] hover:bg-[#f4f6fb]" aria-label="Remover campo"><Trash2Icon className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          <div className="flex items-center gap-2">
            {generateButton(loadingMap.extractionSchema, generateExtractionSchema)}
            <Button type="button" variant="outline" size="sm" className="h-9 border-[#dfe4ef] bg-white" onClick={addExtractionField} aria-label="Adicionar campo"><PlusIcon className="h-4 w-4" /></Button>
          </div>,
        )}
        {accordion(
          "quality-criteria",
          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {(data.qualityAssessmentSchema || []).map((criterion, index) => (
              <div key={criterion.key || index} className="flex items-center gap-2">
                <Input value={criterion.label || ""} title={criterion.label || ""} onChange={(event) => updateQualityCriterion(index, event.target.value)} className="h-9 truncate border-[#e7ebf4] bg-[#fbfcff] text-xs shadow-none" />
                <button type="button" onClick={() => removeQualityCriterion(index)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#667391] hover:bg-[#f4f6fb]" aria-label="Remover critério"><Trash2Icon className="h-4 w-4" /></button>
              </div>
            ))}
            {!(data.qualityAssessmentSchema || []).length ? (
              <div className="rounded-md border border-dashed border-[#dfe4ef] bg-[#fbfcff] px-4 py-6 text-center">
                <p className="text-sm font-semibold text-[#253252]">Nenhum critério definido</p>
                <p className="mt-1 text-xs text-[#667391]">Adicione manualmente ou gere com IA.</p>
              </div>
            ) : null}
          </div>,
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9 gap-2 border-[#dfe4ef] bg-white" onClick={addQualityCriterion}><PlusIcon className="h-3.5 w-3.5" />Adicionar</Button>
            {generateButton(loadingMap.qualityAssessmentSchema, generateQualityAssessmentSchema)}
          </div>,
        )}
      </div>
    ),
  };

  return (
    <div className={cn("min-w-0 space-y-5", isDirty && "pb-24")}>
      {catalogError ? <div role="alert">{catalogError.message}<Button variant="outline" onClick={reloadCatalog}>Tentar novamente</Button></div> : null}
      <PlanningEditorHeader completed={planningState.completed} total={planningState.total} percent={planningState.percent} onExport={() => exportPlanning(project, data)} onOpenSearch={() => setSearchOpen(true)} />
      <PlanningTabs activeTab={activeTab} onTabChange={setActiveTab} panels={panels} tabs={planningState.tabs} />

      {isDirty ? (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border border-[#d8d4ff] bg-white px-4 py-3 shadow-[0_18px_50px_rgba(31,38,73,0.18)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111936]">Alterações não salvas</p>
            <p className="mt-0.5 text-xs text-[#667391]">Salve antes de sair para não perder o planejamento.</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <Button type="button" variant="outline" onClick={discardChanges} disabled={loadingMap.save} className="h-10 min-w-0 border-[#dfe4ef] bg-white">Descartar</Button>
            <Button type="button" onClick={handleSave} disabled={loadingMap.save || !catalogReady} className="h-10 min-w-0 gap-2 bg-[#6259ff] px-5 text-white hover:bg-[#5148ee]">
              {loadingMap.save ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </div>
        </div>
      ) : null}

      <PlanningSectionSearch open={searchOpen} onOpenChange={setSearchOpen} onSectionSelect={selectSection} sections={planningState.sections} />
    </div>
  );
}

export default ProjectPlanning;
