import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRemoteResource } from "@/hooks/useRemoteResource";
import { synthesisService } from "../services/synthesisService";

const emptyResource = { data: null, loading: false, error: null };

export function useSynthesisWorkspace({ projectId, canEdit = false, onDirtyChange } = {}) {
  const [mode, setMode] = useState("rqs");
  const [selection, setSelection] = useState({ rqNumber: null, articleId: null, chartKey: null, criterionKey: "overall" });
  const [filters, setFilters] = useState({});
  const [pages, setPages] = useState({ rqs: 1, evidence: 1, matrix: 1, chart: 1, quality: 1 });
  const [resources, setResources] = useState({ overview: emptyResource, rqs: emptyResource, detail: emptyResource, evidence: emptyResource, matrix: emptyResource, chartCatalog: emptyResource, chart: emptyResource, criteria: emptyResource, quality: emptyResource, study: emptyResource });
  const resourcesProject = useRef(projectId);
  const [draft, setDraftState] = useState({ content: null, baseVersion: 0, dirty: false, conflict: null });
  const overviewLoader = useCallback(() => synthesisService.getOverview(projectId), [projectId]);
  const overviewResource = useRemoteResource({ key: projectId, enabled: Boolean(projectId), load: overviewLoader });
  const reloadOverview = overviewResource.reload;
  const requestSequence = useRef({});
  const currentProject = useRef(projectId);
  currentProject.current = projectId;
  const mounted = useRef(true);
  useEffect(() => { const requests = requestSequence.current; mounted.current = true; return () => { mounted.current = false; Object.keys(requests).forEach((key) => { requests[key] += 1; }); }; }, []);
  const updateResource = useCallback((key, patch) => setResources((current) => ({ ...current, [key]: { ...current[key], ...(typeof patch === "function" ? patch(current[key]) : patch) } })), []);
  const load = useCallback(async (key, fn) => {
    if (!projectId) return null;
    if (key === "overview") return reloadOverview();
    const id = (requestSequence.current[key] || 0) + 1;
    requestSequence.current[key] = id;
    updateResource(key, { loading: true, error: null });
    try {
      const data = await fn();
      if (mounted.current && currentProject.current === projectId && requestSequence.current[key] === id) {
        updateResource(key, { data, loading: false });
        return data;
      }
      return null;
    } catch (error) {
      if (mounted.current && currentProject.current === projectId && requestSequence.current[key] === id) updateResource(key, { loading: false, error });
      return null;
    }
  }, [reloadOverview, projectId, updateResource]);

  useEffect(() => {
    if (!projectId) return;
    resourcesProject.current = projectId;
    setMode("rqs");
    setSelection({ rqNumber: null, articleId: null, chartKey: null, criterionKey: "overall" });
    setFilters({});
    setPages({ rqs: 1, evidence: 1, matrix: 1, chart: 1, quality: 1 });
    setDraftState({ content: null, baseVersion: 0, dirty: false, conflict: null });
    setResources({ overview: emptyResource, rqs: emptyResource, detail: emptyResource, evidence: emptyResource, matrix: emptyResource, chartCatalog: emptyResource, chart: emptyResource, criteria: emptyResource, quality: emptyResource, study: emptyResource });
    Object.keys(requestSequence.current).forEach((key) => { requestSequence.current[key] += 1; });
    load("rqs", () => synthesisService.getRQs(projectId, { page: 1, pageSize: 20 }));
  }, [projectId, load]);

  useEffect(() => {
    if (!projectId) return;
    if (mode === "matrix") load("matrix", () => synthesisService.getMatrix(projectId, { ...filters, page: pages.matrix, pageSize: 20 }));
    if (mode === "visualizations") {
      load("chartCatalog", () => synthesisService.getChartCatalog(projectId)).then((catalog) => {
        const chartKey = selection.chartKey || catalog?.[0]?.key;
        if (chartKey) {
          setSelection((old) => ({ ...old, chartKey }));
          load("chart", () => synthesisService.getChart(projectId, chartKey, { ...filters, page: pages.chart, pageSize: 20 }));
        }
      });
    }
    if (mode === "quality") {
      load("criteria", () => synthesisService.getQualityCriteria(projectId, filters));
      load("quality", () => synthesisService.getQualityStudies(projectId, { ...filters, criterionKey: selection.criterionKey, page: pages.quality, pageSize: 20 }));
    }
  }, [filters, load, mode, pages.chart, pages.matrix, pages.quality, projectId, selection.chartKey, selection.criterionKey]);

  useEffect(() => {
    if (!projectId || mode !== "rqs") return;
    load("rqs", () => synthesisService.getRQs(projectId, { search: filters.search, state: filters.state, page: pages.rqs, pageSize: 20 }));
  }, [filters.search, filters.state, load, mode, pages.rqs, projectId]);

  useEffect(() => {
    if (!projectId || mode !== "rqs" || !selection.rqNumber) return;
    load("evidence", () => synthesisService.getEvidence(projectId, selection.rqNumber, { ...filters, page: pages.evidence, pageSize: 20 }));
  }, [filters, load, mode, pages.evidence, projectId, selection.rqNumber]);

  useEffect(() => {
    if (!projectId || !selection.articleId || !["matrix", "quality"].includes(mode)) return;
    load(mode === "matrix" ? "study" : "study", () => synthesisService.getMatrixArticle(projectId, selection.articleId));
  }, [load, mode, projectId, selection.articleId]);

  useEffect(() => { onDirtyChange?.(draft.dirty); }, [draft.dirty, onDirtyChange]);
  const setDraft = useCallback((content) => setDraftState((old) => ({ ...old, content: { ...(old.content || {}), ...content }, dirty: true, conflict: null })), []);
  const discardDraft = useCallback(() => {
    const detail = resources.detail.data;
    setDraftState({ content: detail?.draft?.content || { narrative: "", keyFindings: [], divergences: [], limitations: [] }, baseVersion: detail?.draft?.version || 0, dirty: false, conflict: null });
  }, [resources.detail.data]);
  const selectRQ = useCallback(async (rqNumber) => {
    setSelection((old) => ({ ...old, rqNumber, articleId: null }));
    const [detail] = await Promise.all([
      load("detail", () => synthesisService.getRQDetail(projectId, rqNumber)),
      load("evidence", () => synthesisService.getEvidence(projectId, rqNumber, { ...filters, page: 1, pageSize: 20 })),
    ]);
    if (detail) setDraftState({ content: detail.draft?.content || { narrative: "", keyFindings: [], divergences: [], limitations: [] }, baseVersion: detail.draft?.version || 0, dirty: false, conflict: null });
    return detail;
  }, [filters, load, projectId]);

  useEffect(() => {
    const first = resources.rqs.data?.items?.[0];
    if (mode === "rqs" && !selection.rqNumber && first) selectRQ(first.rqNumber);
  }, [mode, resources.rqs.data, selectRQ, selection.rqNumber]);
  const refresh = useCallback(async () => {
    const requests = [load("overview", () => synthesisService.getOverview(projectId))];
    if (mode === "rqs") {
      requests.push(load("rqs", () => synthesisService.getRQs(projectId, { ...filters, page: pages.rqs, pageSize: 20 })));
      if (selection.rqNumber) {
        requests.push(load("evidence", () => synthesisService.getEvidence(projectId, selection.rqNumber, { ...filters, page: pages.evidence, pageSize: 20 })));
        requests.push(load("detail", () => synthesisService.getRQDetail(projectId, selection.rqNumber)).then((detail) => {
          if (detail) setDraftState((current) => current.dirty ? current : { content: detail.draft?.content || { narrative: "", keyFindings: [], divergences: [], limitations: [] }, baseVersion: detail.draft?.version || 0, dirty: false, conflict: null });
        }));
      }
    } else if (mode === "matrix") {
      requests.push(load("matrix", () => synthesisService.getMatrix(projectId, { ...filters, page: pages.matrix, pageSize: 20 })));
    } else if (mode === "visualizations") {
      requests.push(load("chartCatalog", () => synthesisService.getChartCatalog(projectId)));
      if (selection.chartKey) requests.push(load("chart", () => synthesisService.getChart(projectId, selection.chartKey, { ...filters, page: pages.chart, pageSize: 20 })));
    } else {
      requests.push(load("criteria", () => synthesisService.getQualityCriteria(projectId, filters)));
      requests.push(load("quality", () => synthesisService.getQualityStudies(projectId, { ...filters, criterionKey: selection.criterionKey, page: pages.quality, pageSize: 20 })));
    }
    if (selection.articleId && ["matrix", "quality"].includes(mode)) requests.push(load("study", () => synthesisService.getMatrixArticle(projectId, selection.articleId)));
    await Promise.all(requests);
  }, [filters, load, mode, pages, projectId, selection]);
  const save = useCallback(async () => {
    if (!canEdit || !selection.rqNumber || !draft.dirty) return null;
    const detail = resources.detail.data;
    try {
      const saved = await synthesisService.save(projectId, selection.rqNumber, { expectedVersion: draft.baseVersion, questionFingerprint: detail.questionFingerprint, content: draft.content });
      setDraftState((old) => ({ ...old, baseVersion: saved.version, dirty: false, conflict: null }));
      return saved;
    } catch (error) {
      if (error.status === 409) setDraftState((old) => ({ ...old, conflict: error.data }));
      else setDraftState((old) => ({ ...old, conflict: { code: "SAVE_FAILED", message: error.message || "Não foi possível salvar o rascunho." } }));
      return null;
    }
  }, [canEdit, draft, projectId, resources.detail.data, selection.rqNumber]);
  const generate = useCallback(async (replaceExisting = false) => {
    if (!canEdit || !selection.rqNumber) return null;
    const detail = resources.detail.data;
    const job = await synthesisService.generate(projectId, selection.rqNumber, { expectedVersion: detail.draft?.version || 0, questionFingerprint: detail.questionFingerprint, replaceExisting, idempotencyKey: crypto.randomUUID() });
    updateResource("detail", { data: { ...detail, activeGeneration: job } });
    return job;
  }, [canEdit, projectId, resources.detail.data, selection.rqNumber, updateResource]);

  useEffect(() => {
    const active = resources.detail.data?.activeGeneration;
    if (!active || !["queued", "running"].includes(active.status) || !selection.rqNumber) return undefined;
    let disposed = false;
    let inFlight = false;
    const timer = window.setInterval(async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      try {
      const job = await synthesisService.getGeneration(projectId, active.id);
      if (disposed) return;
      if (["queued", "running"].includes(job.status)) updateResource("detail", (current) => ({ data: { ...current.data, activeGeneration: job } }));
      if (!["queued", "running"].includes(job.status)) {
        window.clearInterval(timer);
        const detail = await synthesisService.getRQDetail(projectId, selection.rqNumber);
        if (disposed) return;
        updateResource("detail", { data: { ...detail, lastGeneration: job }, loading: false });
        if (detail) setDraftState((old) => old.dirty
          ? { ...old, conflict: { code: "SYNTHESIS_VERSION_CONFLICT", message: "A síntese foi atualizada enquanto você editava. Seu texto local foi preservado." } }
          : { content: detail.draft?.content || { narrative: "", keyFindings: [], divergences: [], limitations: [] }, baseVersion: detail.draft?.version || 0, dirty: false, conflict: null });
        await Promise.all([load("overview", () => synthesisService.getOverview(projectId)), load("rqs", () => synthesisService.getRQs(projectId, { ...filters, page: pages.rqs, pageSize: 20 }))]);
      }
      } catch (error) {
        if (!disposed) updateResource("detail", { error, loading: false });
      } finally { inFlight = false; }
    }, 2000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [filters, load, pages.rqs, projectId, resources.detail.data?.activeGeneration, selection.rqNumber, updateResource]);

  const actions = useMemo(() => ({
    selectRQ, setDraft, discardDraft, save, generate, refresh,
    setFilter: (key, value) => { setFilters((old) => ({ ...old, [key]: value })); setPages((old) => ({ ...old, rqs: 1, evidence: 1, matrix: 1, chart: 1, quality: 1 })); },
    setPage: (key, page) => setPages((old) => ({ ...old, [key]: page })),
    selectArticle: (articleId) => setSelection((old) => ({ ...old, articleId })),
    selectChart: (chartKey) => { setSelection((old) => ({ ...old, chartKey })); setPages((old) => ({ ...old, chart: 1 })); load("chart", () => synthesisService.getChart(projectId, chartKey, { ...filters, page: 1, pageSize: 20 })); },
    selectCriterion: (criterionKey) => { setSelection((old) => ({ ...old, criterionKey, articleId: null })); setPages((old) => ({ ...old, quality: 1 })); load("quality", () => synthesisService.getQualityStudies(projectId, { ...filters, criterionKey, page: 1, pageSize: 20 })); },
    cancel: (id) => synthesisService.cancel(projectId, id),
    export: (kind, params = {}) => synthesisService.export(projectId, kind, { ...filters, ...params }),
  }), [discardDraft, filters, generate, load, projectId, refresh, save, selectRQ, setDraft]);
  return { mode, setMode, selection, selections: selection, filters, setFilters, pages, resources: { ...(resourcesProject.current === projectId ? resources : Object.fromEntries(Object.keys(resources).map((key) => [key, emptyResource]))), overview: overviewResource }, draft, actions };
}
