import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  denormalizeFrameworkData,
  getComponentsForFramework,
  getFrameworkInfo,
  getRequiredKeys,
  normalizeFrameworkData,
} from "@/lib/frameworkConfig";
import { toast } from "@/lib/toast";
import { projectService } from "@features/projects/services/projectService";

const INITIAL_LOADING_MAP = {
  save: false,
  researchQuestions: false,
  searchStrings: false,
  criteria: false,
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
};

function buildFrameworkData(rawPicoc, framework) {
  const normalized = normalizeFrameworkData(rawPicoc || {});
  const components = getComponentsForFramework(framework);

  return components.reduce((result, component) => {
    result[component.key] = normalized[component.key] || "";
    return result;
  }, {});
}

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
  };
}

export default function useProjectPlanning(project = {}) {
  const framework = project.framework || "PICOC";

  const frameworkInfo = useMemo(() => getFrameworkInfo(framework), [framework]);
  const frameworkComponents = useMemo(
    () => getComponentsForFramework(framework),
    [framework]
  );
  const requiredKeys = useMemo(() => getRequiredKeys(framework), [framework]);

  const [data, setData] = useState(() => buildInitialData(project, framework));
  const [targetDatabase, setTargetDatabase] = useState("scopus");
  const [loadingMap, setLoadingMap] = useState(() => INITIAL_LOADING_MAP);
  const latestProjectRef = useRef(project);

  latestProjectRef.current = project;

  useEffect(() => {
    setData(buildInitialData(latestProjectRef.current, framework));
  }, [framework, project?.id, project?.updatedAt, project?.updated_at]);

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

  const filledRequiredLabel = useMemo(
    () =>
      frameworkComponents
        .filter((component) => component.required)
        .map((component) => component.labelPt)
        .join(", "),
    [frameworkComponents]
  );

  const hasRequiredComponentsFilled = useMemo(
    () => requiredKeys.every((key) => data.picoc[key]?.trim()),
    [data.picoc, requiredKeys]
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

  const handleSave = useCallback(async () => {
    if (!data.title.trim()) {
      toast.warning("Título é obrigatório");
      return;
    }

    try {
      setActionLoading("save", true);

      await projectService.updateProject(project.id, {
        ...data,
        picoc: denormalizeFrameworkData(data.picoc),
      });

      toast.success("Projeto salvo com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setActionLoading("save", false);
    }
  }, [data, project.id, setActionLoading]);

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

  return {
    addArrayItem,
    data,
    framework,
    frameworkComponents,
    frameworkInfo,
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
  };
}

