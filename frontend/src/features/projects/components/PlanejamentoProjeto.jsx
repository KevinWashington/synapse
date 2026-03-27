import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Save, Loader2, Sparkles, Pencil, Check, Info } from "lucide-react";
import { projectService } from "@/features/projects";
import { toast } from "@/lib/toast";
import {
  getComponentsForFramework,
  getFrameworkInfo,
  normalizeFrameworkData,
  denormalizeFrameworkData,
  getRequiredKeys,
  TARGET_DATABASES,
} from "@/lib/frameworkConfig";

function PlanejamentoProjeto({ projeto = {} }) {
  const framework = projeto.framework || "PICOC";
  const frameworkInfo = getFrameworkInfo(framework);
  const frameworkComponents = getComponentsForFramework(framework);

  const [loading, setLoading] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generatingStrings, setGeneratingStrings] = useState(false);
  const [generatingCriteria, setGeneratingCriteria] = useState(false);
  const [targetDatabase, setTargetDatabase] = useState("scopus");

  // Initialize framework data with normalized keys
  const buildInitialComponents = () => {
    const raw = projeto.picoc || {};
    const normalized = normalizeFrameworkData(raw);
    // Ensure all component keys exist
    const result = {};
    for (const comp of frameworkComponents) {
      result[comp.key] = normalized[comp.key] || "";
    }
    return result;
  };

  const [data, setData] = useState({
    title: "",
    objetivo: "",
    picoc: buildInitialComponents(),
    researchQuestions: [],
    keywords: [],
    searchStrings: [],
    criteriosInclusao: [],
    criteriosExclusao: [],
  });

  useEffect(() => {
    if (projeto) {
      const raw = projeto.picoc || {};
      const normalized = normalizeFrameworkData(raw);
      const components = {};
      for (const comp of frameworkComponents) {
        components[comp.key] = normalized[comp.key] || "";
      }
      setData((prev) => ({
        ...prev,
        ...projeto,
        picoc: components,
      }));
    }
  }, [projeto]);

  const updateField = (field, value) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateComponent = (key, value) => {
    setData((prev) => ({
      ...prev,
      picoc: { ...prev.picoc, [key]: value },
    }));
  };

  const addToArray = (field, value) => {
    if (!value.trim()) return;
    setData((prev) => ({
      ...prev,
      [field]: [...prev[field], value.trim()],
    }));
  };

  const removeFromArray = (field, index) => {
    setData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const updateInArray = (field, index, value) => {
    setData((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item)),
    }));
  };

  const handleSave = async () => {
    if (!data.title.trim()) {
      toast.warning("Título é obrigatório");
      return;
    }

    try {
      setLoading(true);
      // Denormalize component data for backward compatibility with API
      const saveData = {
        ...data,
        picoc: denormalizeFrameworkData(data.picoc),
      };
      await projectService.updateProject(projeto.id, saveData);
      toast.success("Projeto salvo com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getFilledRequiredLabel = () => {
    const requiredKeys = getRequiredKeys(framework);
    const requiredLabels = frameworkComponents
      .filter((c) => c.required)
      .map((c) => c.labelPt);
    return requiredLabels.join(", ");
  };

  const hasRequiredComponentsFilled = () => {
    const requiredKeys = getRequiredKeys(framework);
    return requiredKeys.every((key) => data.picoc[key]?.trim());
  };

  const generateResearchQuestions = async () => {
    if (!hasRequiredComponentsFilled()) {
      toast.warning(
        `Preencha pelo menos ${getFilledRequiredLabel()} antes de gerar perguntas`
      );
      return;
    }

    try {
      setGeneratingQuestions(true);
      const response = await projectService.generateResearchQuestions(
        data.picoc,
        {
          title: data.title,
          objetivo: data.objetivo,
        },
        framework
      );

      setData((prev) => ({
        ...prev,
        researchQuestions: [
          ...prev.researchQuestions,
          ...response.researchQuestions,
        ],
      }));
    } catch (error) {
      toast.error("Erro ao gerar perguntas: " + error.message);
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const generateSearchStrings = async () => {
    if (!data.researchQuestions || data.researchQuestions.length === 0) {
      toast.warning(
        "Adicione pelo menos uma pergunta de pesquisa antes de gerar strings de busca"
      );
      return;
    }

    if (!hasRequiredComponentsFilled()) {
      toast.warning(
        `Preencha pelo menos ${getFilledRequiredLabel()} antes de gerar strings`
      );
      return;
    }

    try {
      setGeneratingStrings(true);
      const response = await projectService.generateSearchStrings(
        data.researchQuestions,
        data.picoc,
        {
          title: data.title,
          objetivo: data.objetivo,
        },
        framework,
        targetDatabase
      );

      setData((prev) => ({
        ...prev,
        searchStrings: [...prev.searchStrings, ...response.searchStrings],
      }));
    } catch (error) {
      toast.error("Erro ao gerar strings de busca: " + error.message);
    } finally {
      setGeneratingStrings(false);
    }
  };

  const generateCriteria = async () => {
    if (!hasRequiredComponentsFilled()) {
      toast.warning(
        `Preencha pelo menos ${getFilledRequiredLabel()} antes de gerar critérios`
      );
      return;
    }

    try {
      setGeneratingCriteria(true);
      const response = await projectService.generateCriteria(
        data.researchQuestions,
        data.picoc,
        {
          title: data.title,
          objetivo: data.objetivo,
        },
        framework
      );

      setData((prev) => ({
        ...prev,
        criteriosInclusao: [
          ...prev.criteriosInclusao,
          ...response.inclusao,
        ],
        criteriosExclusao: [
          ...prev.criteriosExclusao,
          ...response.exclusao,
        ],
      }));
      toast.success("Critérios gerados com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar critérios: " + error.message);
    } finally {
      setGeneratingCriteria(false);
    }
  };

  // Componente para campos de array
  const ArrayField = ({ label, field, placeholder, isLongText = false }) => {
    const [input, setInput] = useState("");
    const [editingIndex, setEditingIndex] = useState(null);
    const [editValue, setEditValue] = useState("");

    const handleAdd = () => {
      addToArray(field, input);
      setInput("");
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey && !isLongText) {
        e.preventDefault();
        handleAdd();
      }
    };

    const startEditing = (index, value) => {
      setEditingIndex(index);
      setEditValue(value);
    };

    const saveEdit = (index) => {
      if (editValue.trim()) {
        updateInArray(field, index, editValue.trim());
        setEditingIndex(null);
      }
    };

    return (
      <div className="space-y-3">
        <Label className="text-[var(--syn-text-primary)]">{label}</Label>

        {/* Lista de items */}
        {data[field].length > 0 && (
          <div className="space-y-2">
            {data[field].map((item, index) => (
              <div key={index} className="space-y-1">
                {editingIndex === index ? (
                  <div className="flex gap-2">
                    {isLongText ? (
                      <Textarea
                        className="flex-1 min-h-[80px]"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <Input
                        className="flex-1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(index);
                          if (e.key === "Escape") setEditingIndex(null);
                        }}
                        autoFocus
                      />
                    )}
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-green-600"
                        onClick={() => saveEdit(index)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500"
                        onClick={() => setEditingIndex(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1 group">
                    <div
                      className="flex-1 p-2 px-3 rounded-lg bg-[var(--syn-bg-secondary)] text-sm text-[var(--syn-text-primary)] border border-transparent group-hover:border-[var(--syn-border)] transition-all cursor-pointer"
                      onClick={() => startEditing(index, item)}
                    >
                      {item}
                    </div>
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(index, item)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromArray(field, index)}
                        className="h-8 w-8 p-0 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input para adicionar */}
        <div className="flex gap-2">
          {isLongText ? (
            <Textarea
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="flex-1 min-h-[60px]"
            />
          ) : (
            <Input
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
          )}
          <Button
            variant="outline"
            onClick={handleAdd}
            disabled={!input.trim()}
            className="h-auto"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const Section = ({ title, actions, children }) => (
    <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] shadow-[var(--syn-shadow-card)] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--syn-border)]">
        <h3 className="text-sm font-semibold text-[var(--syn-text-primary)]">{title}</h3>
        {actions}
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );

  const AIButton = ({ onClick, disabled, loading: isLoading, label = "Gerar com IA" }) => (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled} className="gap-2 text-xs">
      {isLoading ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
      ) : (
        <><Sparkles className="w-3.5 h-3.5" /> {label}</>
      )}
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Informações Básicas */}
      <Section title="Informações Básicas">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-[var(--syn-text-primary)]">Título *</Label>
          <Input
            id="title"
            value={data.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Ex: Revisão Sistemática - IA na Educação"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="objetivo" className="text-[var(--syn-text-primary)]">Objetivo</Label>
          <Textarea
            id="objetivo"
            value={data.objetivo}
            onChange={(e) => updateField("objetivo", e.target.value)}
            placeholder="Descreva o objetivo do seu projeto..."
            rows={3}
          />
        </div>
      </Section>

      {/* Framework Components - Dynamic */}
      <Section
        title={`Framework ${framework}`}
        actions={
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: frameworkInfo.badgeBg,
              color: frameworkInfo.badgeText,
            }}
          >
            {framework}
          </span>
        }
      >
        {frameworkComponents.map((comp) => (
          <div key={comp.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-[var(--syn-text-primary)]">
                {comp.labelPt}
                {comp.required ? "" : (
                  <span className="ml-1 text-xs font-normal text-[var(--syn-text-secondary)]">(opcional)</span>
                )}
              </Label>
              <div className="group relative">
                <Info className="h-3.5 w-3.5 text-[var(--syn-text-secondary)] cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-[var(--syn-bg-secondary)] border border-[var(--syn-border)] text-xs text-[var(--syn-text-primary)] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {comp.tooltip}
                </div>
              </div>
            </div>
            <Input
              value={data.picoc[comp.key] || ""}
              onChange={(e) => updateComponent(comp.key, e.target.value)}
              placeholder={comp.placeholder}
            />
          </div>
        ))}
      </Section>

      {/* Perguntas de Pesquisa */}
      <Section
        title="Perguntas de Pesquisa"
        actions={<AIButton onClick={generateResearchQuestions} disabled={generatingQuestions} loading={generatingQuestions} />}
      >
        <ArrayField
          label="Perguntas"
          field="researchQuestions"
          placeholder="Digite uma pergunta de pesquisa..."
          isLongText={true}
        />
      </Section>

      {/* Palavras-chave */}
      <Section title="Palavras-chave">
        <ArrayField
          label="Palavras-chave"
          field="keywords"
          placeholder="Digite uma palavra-chave..."
        />
      </Section>

      {/* Strings de Busca */}
      <Section
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
            <AIButton onClick={generateSearchStrings} disabled={generatingStrings} loading={generatingStrings} />
          </div>
        }
      >
        <ArrayField
          label="Strings"
          field="searchStrings"
          placeholder="Digite uma string de busca..."
          isLongText={true}
        />
      </Section>

      {/* Critérios */}
      <Section
        title="Critérios de Inclusão e Exclusão"
        actions={<AIButton onClick={generateCriteria} disabled={generatingCriteria} loading={generatingCriteria} />}
      >
        <div className="grid md:grid-cols-2 gap-6">
          <ArrayField
            label="Critérios de Inclusão"
            field="criteriosInclusao"
            placeholder="Digite um critério de inclusão..."
            isLongText={true}
          />
          <ArrayField
            label="Critérios de Exclusão"
            field="criteriosExclusao"
            placeholder="Digite um critério de exclusão..."
            isLongText={true}
          />
        </div>
      </Section>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading} className="gap-2">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
          ) : (
            <><Save className="w-4 h-4" /> Salvar</>
          )}
        </Button>
      </div>
    </div>
  );
}

export default PlanejamentoProjeto;
