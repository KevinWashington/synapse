import { apiService } from "@/services/api";

function queryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    (Array.isArray(value) ? value : [value]).forEach((item) => search.append(key, String(item)));
  });
  return search.toString();
}

const base = (projectId) => `/api/projetos/${projectId}/synthesis`;
const get = (path, params) => {
  const query = queryString(params);
  return apiService.get(query ? `${path}?${query}` : path);
};

export const synthesisService = {
  getOverview: (id) => get(`${base(id)}/overview`),
  getRQs: (id, params) => get(`${base(id)}/rqs`, params),
  getRQDetail: (id, number) => get(`${base(id)}/rqs/${number}`),
  getEvidence: (id, number, params) => get(`${base(id)}/rqs/${number}/evidence`, params),
  getMatrix: (id, params) => get(`${base(id)}/matrix`, params),
  getMatrixArticle: (id, articleId) => get(`${base(id)}/matrix/${articleId}`),
  getChartCatalog: (id) => get(`${base(id)}/charts`),
  getChart: (id, key, params) => get(`${base(id)}/charts/${encodeURIComponent(key)}`, params),
  getQualityCriteria: (id, params) => get(`${base(id)}/quality/criteria`, params),
  getQualityStudies: (id, params) => get(`${base(id)}/quality/studies`, params),
  getQualityStudy: (id, articleId) => get(`${base(id)}/quality/studies/${articleId}`),
  generate: (id, number, request) => apiService.post(`${base(id)}/rqs/${number}/generations`, request),
  getGeneration: (id, generationId) => get(`${base(id)}/generations/${generationId}`),
  cancel: (id, generationId) => apiService.post(`${base(id)}/generations/${generationId}/cancel`, {}),
  save: (id, number, request) => apiService.patch(`${base(id)}/rqs/${number}`, request),
  deleteDraft: async (id, number, version) => {
    const response = await apiService.requestRaw(`${base(id)}/rqs/${number}?${queryString({ expectedVersion: version, confirm: true })}`, { method: "DELETE" });
    return response.status === 204 ? null : response.json();
  },
  export: async (id, kind, params) => {
    const query = queryString(params);
    const response = await apiService.requestRaw(`${base(id)}/exports/${kind}${query ? `?${query}` : ""}`, { method: "GET" });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = kind;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
