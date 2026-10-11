import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getComponentsForFramework,
  getFrameworkInfo,
  getRequiredKeys,
} from "@/lib/frameworkConfig";
import { useFrameworkCatalog } from "./useFrameworkCatalog";
import { toast } from "@/lib/toast";
import { projectService } from "@features/projects/services/projectService";
import {
  createExtractionField,
  createQualityCriterion,
  normalizeOptions,
} from "@features/projects/utils/evidenceSchema";

const INITIAL_LOADING_MAP = {
  save: false,
  researchQuestions: false,
  searchStrings: false,
  criteria: false,
  extractionSchema: false,
  qualityAssessmentSchema: false,
};

const INITIAL_DATA = {
  title: "",
  objetivo: "",
  picoc: {},
  researchQuestions: [],
  keywords: [],
  searchStrings: [],
  criteriosInclusao: [],
  criteriosExclusao: [],
  eligibilityChecklist: [],
  dataExtractionSchema: [],
  qualityAssessmentSchema: [],
  screeningGuidance: "",
  selectionReportNotes: "",
};

function buildFrameworkData(rawPicoc) { return { ...(rawPicoc || {}) }; }

function buildInitialData(project, framework) {
  if (!project || Object.keys(project).length === 0) {
    return {
      ...INITIAL_DATA,
      picoc: buildFrameworkData({}, framework),
    };
  }

  return {
    ...INITIAL_DATA,
    ...project,
    picoc: buildFrameworkData(project.picoc, framework),
    researchQuestions: project.researchQuestions || [],
    keywords: project.keywords || [],
    searchStrings: project.searchStrings || [],
    criteriosInclusao: project.criteriosInclusao || [],
    criteriosExclusao: project.criteriosExclusao || [],
    eligibilityChecklist: project.eligibilityChecklist || [],
    dataExtractionSchema: project.dataExtractionSchema || [],
    qualityAssessmentSchema: project.qualityAssessmentSchema || [],
    screeningGuidance: project.screeningGuidance || "",
    selectionReportNotes: project.selectionReportNotes || "",
  };
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export default function useProjectPlanning(project = {}, onProjectUpdated) {
  const framework = project.framework || "PICOC";
  const catalog = useFrameworkCatalog();
  const catalogReady = !catalog.loading && !catalog.error && catalog.frameworks.some((item) => item.name === framework);

  const frameworkInfo = useMemo(() => getFrameworkInfo(framework, catalog.frameworks), [framework, catalog.frameworks]);
  const frameworkComponents = useMemo(
    () => getComponentsForFramework(framework, catalog.frameworks),
    [framework, catalog.frameworks]
  );
  const requiredKeys = useMemo(() => getRequiredKeys(framework, catalog.frameworks), [framework, catalog.frameworks]);

  const [data, setData] = useState(() => buildInitialData(project, framework));
  const [targetDatabase, setTargetDatabase] = useState("scopus");
  const [loadingMap, setLoadingMap] = useState(() => INITIAL_LOADING_MAP);
  const latestProjectRef = useRef(project);
  const savedDataRef = useRef(buildInitialData(project, framework));

  latestProjectRef.current = project;

  useEffect(() => {
    const nextData = buildInitialData(latestProjectRef.current, framework);
    savedDataRef.current = nextData;
    setData(nextData);
  }, [framework, project?.id, project?.updatedAt, project?.updated_at]);

  const isDirty = useMemo(
    () => stableSerialize(data) !== stableSerialize(savedDataRef.current),
    [data]
  );

  const discardChanges = useCallback(() => {
    setData(buildInitialData(savedDataRef.current, framework));
  }, [framework]);

  const setActionLoading = useCallback((key, value) => {
    setLoadingMap((current) => {
      if (current[key] === value) {
        return current;
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }, []);

  const updateField = useCallback((field, value) => {
    setData((current) => ({
      ...current,
      [field]: value,
    }));
  }, []);

  const updateComponent = useCallback((key, value) => {
    setData((current) => ({
      ...current,
      picoc: {
        ...current.picoc,
        [key]: value,
      },
    }));
  }, []);

  const addArrayItem = useCallback((field, value) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    setData((current) => ({
      ...current,
      [field]: [...(current[field] || []), trimmedValue],
    }));
  }, []);

  const removeArrayItem = useCallback((field, index) => {
    setData((current) => ({
      ...current,
      [field]: (current[field] || []).filter(
        (_, currentIndex) => currentIndex !== index
      ),
    }));
  }, []);

  const updateArrayItem = useCallback((field, index, value) => {
    setData((current) => ({
      ...current,
      [field]: (current[field] || []).map((item, currentIndex) =>
        currentIndex === index ? value : item
      ),
    }));
  }, []);

  const addExtractionField = useCallback(() => {
    setData((current) => ({
      ...current,
      dataExtractionSchema: [
        ...(current.dataExtractionSchema || []),
        createExtractionField(current.dataExtractionSchema || []),
      ],
    }));
  }, []);

  const updateExtractionField = useCallback((index, patch) => {
    setData((current) => ({
      ...current,
      dataExtractionSchema: (current.dataExtractionSchema || []).map((field, currentIndex) => {
        if (currentIndex !== index) {
          return field;
        }

        const nextField = {
          ...field,
          ...patch,
        };
        if (patch.options !== undefined) {
          nextField.options = normalizeOptions(patch.options);
        }
        if (nextField.type !== "single_select" && nextField.type !== "multi_select") {
          nextField.options = [];
        }
        return nextField;
      }),
    }));
  }, []);

  const removeExtractionField = useCallback((index) => {
    setData((current) => ({
      ...current,
      dataExtractionSchema: (current.dataExtractionSchema || []).filter(
        (_, currentIndex) => currentIndex !== index
      ),
    }));
  }, []);

  const addQualityCriterion = useCallback(() => {
    setData((current) => ({
      ...current,
      qualityAssessmentSchema: [
        ...(current.qualityAssessmentSchema || []),
        createQualityCriterion(current.qualityAssessmentSchema || []),
      ],
    }));
  }, []);

  const updateQualityCriterion = useCallback((index, label) => {
    setData((current) => ({
      ...current,
      qualityAssessmentSchema: (current.qualityAssessmentSchema || []).map((criterion, currentIndex) =>
        currentIndex === index
          ? { ...criterion, label }
          : criterion
      ),
    }));
  }, []);

  const removeQualityCriterion = useCallback((index) => {
    setData((current) => ({
      ...current,
      qualityAssessmentSchema: (current.qualityAssessmentSchema || []).filter(
        (_, currentIndex) => currentIndex !== index
      ),
    }));
  }, []);

  const filledRequiredLabel = useMemo(
    () =>
      frameworkComponents
        .filter((component) => component.required)
        .map((component) => component.labelPt)
        .join(", "),
    [frameworkComponents]
  );

  const hasRequiredComponentsFilled = useMemo(
    () => catalogReady && requiredKeys.every((key) => data.picoc[key]?.trim()),
    [catalogReady, data.picoc, requiredKeys]
  );

  const projectMetadata = useMemo(
    () => ({
      title: data.title,
      objetivo: data.objetivo,
    }),
    [data.objetivo, data.title]
  );

  const ensureRequiredComponents = useCallback(
    (message) => {
      if (hasRequiredComponentsFilled) {
        return true;
      }

      toast.warning(`Preencha pelo menos ${filledRequiredLabel} ${message}`);
      return false;
    },
    [filledRequiredLabel, hasRequiredComponentsFilled]
  );

  const ensureResearchQuestions = useCallback(
    (message) => {
      if (data.researchQuestions && data.researchQuestions.length > 0) {
        return true;
      }

      toast.warning(`Adicione pelo menos uma pergunta de pesquisa antes de ${message}`);
      return false;
    },
    [data.researchQuestions]
  );

  const handleSave = useCallback(async () => {
    if (!catalogReady) return;
    if (!data.title.trim()) {
      toast.warning("Título é obrigatório");
      return;
    }

    try {
      setActionLoading("save", true);

      const updatedProject = await projectService.updateProject(project.id, {
        ...data,
        picoc: data.picoc,
      });
      const nextData = buildInitialData(updatedProject, updatedProject.framework || framework);
      latestProjectRef.current = updatedProject;
      savedDataRef.current = nextData;
      setData(nextData);
      onProjectUpdated?.(updatedProject);

      toast.success("Projeto salvo com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setActionLoading("save", false);
    }
  }, [catalogReady, data, framework, onProjectUpdated, project.id, setActionLoading]);

  const generateResearchQuestions = useCallback(async () => {
    if (!ensureRequiredComponents("antes de gerar perguntas")) {
      return;
    }

    try {
      setActionLoading("researchQuestions", true);

      const response = await projectService.generateResearchQuestions(
        data.picoc,
        projectMetadata,
        framework
      );

      setData((current) => ({
        ...current,
        researchQuestions: [
          ...(current.researchQuestions || []),
          ...(response.researchQuestions || []),
        ],
      }));
    } catch (error) {
      toast.error("Erro ao gerar perguntas: " + error.message);
    } finally {
      setActionLoading("researchQuestions", false);
    }
  }, [
    data.picoc,
    ensureRequiredComponents,
    framework,
    projectMetadata,
    setActionLoading,
  ]);

  const generateSearchStrings = useCallback(async () => {
    if (!data.researchQuestions || data.researchQuestions.length === 0) {
      toast.warning(
        "Adicione pelo menos uma pergunta de pesquisa antes de gerar strings de busca"
      );
      return;
    }

    if (!ensureRequiredComponents("antes de gerar strings")) {
      return;
    }

    try {
      setActionLoading("searchStrings", true);

      const response = await projectService.generateSearchStrings(
        data.researchQuestions,
        data.picoc,
        projectMetadata,
        framework,
        targetDatabase
      );

      setData((current) => ({
        ...current,
        searchStrings: [
          ...(current.searchStrings || []),
          ...(response.searchStrings || []),
        ],
      }));
    } catch (error) {
      toast.error("Erro ao gerar strings de busca: " + error.message);
    } finally {
      setActionLoading("searchStrings", false);
    }
  }, [
    data.picoc,
    data.researchQuestions,
    ensureRequiredComponents,
    framework,
    projectMetadata,
    setActionLoading,
    targetDatabase,
  ]);

  const generateCriteria = useCallback(async () => {
    if (!ensureRequiredComponents("antes de gerar critérios")) {
      return;
    }

    try {
      setActionLoading("criteria", true);

      const response = await projectService.generateCriteria(
        data.researchQuestions,
        data.picoc,
        projectMetadata,
        framework
      );

      setData((current) => ({
        ...current,
        criteriosInclusao: [
          ...(current.criteriosInclusao || []),
          ...(response.inclusao || []),
        ],
        criteriosExclusao: [
          ...(current.criteriosExclusao || []),
          ...(response.exclusao || []),
        ],
      }));

      toast.success("Critérios gerados com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar critérios: " + error.message);
    } finally {
      setActionLoading("criteria", false);
    }
  }, [
    data.picoc,
    data.researchQuestions,
    ensureRequiredComponents,
    framework,
    projectMetadata,
    setActionLoading,
  ]);

  const generateExtractionSchema = useCallback(async () => {
    if (!ensureResearchQuestions("gerar o esquema de extração")) {
      return;
    }

    if (!ensureRequiredComponents("antes de gerar o esquema de extração")) {
      return;
    }

    if (
      data.dataExtractionSchema?.length &&
      !confirm(
        "Gerar com IA vai substituir o esquema de extração atual. Deseja continuar?"
      )
    ) {
      return;
    }

    try {
      setActionLoading("extractionSchema", true);

      const response = await projectService.generateDataExtractionSchema(
        data.researchQuestions,
        data.picoc,
        projectMetadata,
        framework
      );

      setData((current) => ({
        ...current,
        dataExtractionSchema: response.dataExtractionSchema || [],
      }));

      toast.success("Esquema de extração gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar esquema de extração: " + error.message);
    } finally {
      setActionLoading("extractionSchema", false);
    }
  }, [
    data.dataExtractionSchema,
    data.picoc,
    data.researchQuestions,
    ensureRequiredComponents,
    ensureResearchQuestions,
    framework,
    projectMetadata,
    setActionLoading,
  ]);

  const generateQualityAssessmentSchema = useCallback(async () => {
    if (!ensureResearchQuestions("gerar os critérios de qualidade")) {
      return;
    }

    if (!ensureRequiredComponents("antes de gerar os critérios de qualidade")) {
      return;
    }

    if (
      data.qualityAssessmentSchema?.length &&
      !confirm(
        "Gerar com IA vai substituir os critérios de qualidade atuais. Deseja continuar?"
      )
    ) {
      return;
    }

    try {
      setActionLoading("qualityAssessmentSchema", true);

      const response = await projectService.generateQualityAssessmentSchema(
        data.researchQuestions,
        data.picoc,
        projectMetadata,
        framework
      );

      setData((current) => ({
        ...current,
        qualityAssessmentSchema: response.qualityAssessmentSchema || [],
      }));

      toast.success("Critérios de qualidade gerados com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar critérios de qualidade: " + error.message);
    } finally {
      setActionLoading("qualityAssessmentSchema", false);
    }
  }, [
    data.picoc,
    data.qualityAssessmentSchema,
    data.researchQuestions,
    ensureRequiredComponents,
    ensureResearchQuestions,
    framework,
    projectMetadata,
    setActionLoading,
  ]);

  return {
    catalogReady,
    catalogError: catalog.error || (!catalog.loading && !catalogReady ? new Error(`Framework indispon?vel: ${framework}`) : null),
    reloadCatalog: catalog.reload,
    addExtractionField,
    addArrayItem,
    addQualityCriterion,
    data,
    discardChanges,
    framework,
    frameworkComponents,
    frameworkInfo,
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
  };
}

