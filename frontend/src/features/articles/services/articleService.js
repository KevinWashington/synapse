import { ApiError, apiService } from "@/services/api";

function extractFilename(contentDisposition, fallbackName) {
  if (!contentDisposition) {
    return fallbackName;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const simpleMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (simpleMatch?.[1]) {
    return simpleMatch[1];
  }

  return fallbackName;
}

function triggerBrowserDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

class ArtigosService {
  constructor() {
    this.baseEndpoint = "/api/projetos";
  }

  getProjectEndpoint(projectId) {
    return `${this.baseEndpoint}/${projectId}/artigos`;
  }

  async getArticlesByProject(projectId, filters = {}) {
    if (!projectId) {
      throw new Error("ID do projeto e obrigatorio");
    }

    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.phase) params.phase = filters.phase;
    if (filters.outcome) params.outcome = filters.outcome;
    if (filters.sourceCategory) params.sourceCategory = filters.sourceCategory;
    if (filters.hasPdf !== undefined) params.hasPdf = String(filters.hasPdf);
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;

    return apiService.get(this.getProjectEndpoint(projectId), params);
  }

  async getArticleById(projectId, articleId) {
    if (!projectId || !articleId) {
      throw new Error("IDs do projeto e artigo sao obrigatorios");
    }
    return apiService.get(`${this.getProjectEndpoint(projectId)}/${articleId}`);
  }

  async createArticleJson(projectId, articleData) {
    if (!projectId) {
      throw new Error("ID do projeto e obrigatorio");
    }
    return apiService.post(this.getProjectEndpoint(projectId), articleData);
  }

  async importBibTeX(projectId, payload) {
    if (!projectId) {
      throw new Error("ID do projeto e obrigatorio");
    }
    return apiService.post(`${this.getProjectEndpoint(projectId)}/import-bibtex`, payload);
  }

  async getSelectionSummary(projectId) {
    if (!projectId) {
      throw new Error("ID do projeto e obrigatorio");
    }
    return apiService.get(`${this.getProjectEndpoint(projectId)}/selection-summary`);
  }

  async getSelectionReport(projectId) {
    if (!projectId) {
      throw new Error("ID do projeto e obrigatorio");
    }
    return apiService.get(`${this.baseEndpoint}/${projectId}/selection-report`);
  }

  async exportSelectionReport(projectId, format = "json") {
    const response = await apiService.requestRaw(
      `${this.baseEndpoint}/${projectId}/selection-report/export?format=${format}`,
      { method: "GET" }
    );
    const blob = await response.blob();
    const contentDisposition = response.headers.get("content-disposition");
    const filename = extractFilename(
      contentDisposition,
      `selection-report.${format === "csv" ? "csv" : "json"}`
    );
    triggerBrowserDownload(blob, filename);
  }

  async analyzeDuplicates(projectId) {
    return apiService.post(`${this.getProjectEndpoint(projectId)}/dedup/analyze`, {});
  }

  async getDuplicateCandidates(projectId) {
    return apiService.get(`${this.getProjectEndpoint(projectId)}/dedup/candidates`);
  }

  async applyDuplicateDecisions(projectId, decisions) {
    return apiService.post(`${this.getProjectEndpoint(projectId)}/dedup/apply`, {
      decisions,
    });
  }

  async promoteToScreening(projectId, articleIds) {
    return apiService.post(`${this.getProjectEndpoint(projectId)}/promote-to-screening`, {
      articleIds,
    });
  }

  async submitScreeningDecision(projectId, articleId, decisionData) {
    return apiService.post(
      `${this.getProjectEndpoint(projectId)}/${articleId}/screening-decision`,
      decisionData
    );
  }

  async batchEvaluateScreening(projectId, options = {}) {
    return apiService.post(`${this.getProjectEndpoint(projectId)}/screening/batch-evaluate`, {
      limit: options.limit ?? 200,
      onlyPending: options.onlyPending ?? true,
      forceReevaluate: options.forceReevaluate ?? false,
      dryRun: options.dryRun ?? false,
    });
  }

  async updateFullTextStatus(projectId, articleId, data) {
    return apiService.patch(`${this.getProjectEndpoint(projectId)}/${articleId}/full-text-status`, data);
  }

  async submitEligibilityDecision(projectId, articleId, data) {
    return apiService.post(
      `${this.getProjectEndpoint(projectId)}/${articleId}/eligibility-decision`,
      data
    );
  }

  async getPdfBlob(projectId, articleId, options = {}) {
    try {
      const endpoint = `${this.getProjectEndpoint(projectId)}/${articleId}/${options.download ? "download" : "pdf"}`;
      const response = await apiService.requestRaw(endpoint, {
        method: "GET",
        suppressErrorStatuses: [404],
      });
      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      const defaultFilename = `artigo-${articleId}.pdf`;
      return {
        blob,
        filename: extractFilename(contentDisposition, defaultFilename),
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getPdfData(projectId, articleId) {
    const pdfFile = await this.getPdfBlob(projectId, articleId);
    if (!pdfFile) {
      return null;
    }
    return pdfFile.blob.arrayBuffer();
  }

  async downloadPdf(projectId, articleId) {
    const pdfFile = await this.getPdfBlob(projectId, articleId, { download: true });
    if (!pdfFile) {
      return null;
    }
    triggerBrowserDownload(pdfFile.blob, pdfFile.filename);
    return pdfFile.filename;
  }

  async openPdfInNewTab(projectId, articleId) {
    const pdfFile = await this.getPdfBlob(projectId, articleId);
    if (!pdfFile) {
      return null;
    }
    const objectUrl = URL.createObjectURL(pdfFile.blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return objectUrl;
  }

  async uploadPdf(projectId, articleId, file) {
    const formData = new FormData();
    formData.append("file", file);
    return apiService.postFormData(`${this.getProjectEndpoint(projectId)}/${articleId}/pdf`, formData);
  }

  async updateArticle(projectId, articleId, updateData) {
    return apiService.put(`${this.getProjectEndpoint(projectId)}/${articleId}`, updateData);
  }

  async updateArticleNotes(projectId, articleId, notas) {
    return apiService.patch(`${this.getProjectEndpoint(projectId)}/${articleId}/notes`, { notas });
  }

  async updateArticleEvidence(projectId, articleId, data) {
    return apiService.patch(`${this.getProjectEndpoint(projectId)}/${articleId}/evidence`, data);
  }

  async getProjectRQSynthesis(projectId) {
    return apiService.get(`${this.getProjectEndpoint(projectId)}/rq-synthesis`);
  }

  async getProjectSynthesisReport(projectId) {
    return apiService.get(`${this.getProjectEndpoint(projectId)}/synthesis-report`);
  }

  async deleteArticle(projectId, articleId) {
    return apiService.delete(`${this.getProjectEndpoint(projectId)}/${articleId}`);
  }

  async getProjectGraph(projectId, options = {}) {
    const params = {};
    if (options.relationshipType) params.relationship_type = options.relationshipType;
    if (options.minSimilarity !== undefined) params.min_similarity = options.minSimilarity;
    return apiService.get(`${this.baseEndpoint}/${projectId}/grafo`, params);
  }

  async reprocessProjectGraph(projectId, options = {}) {
    const params = new URLSearchParams();
    if (options.onlyMissingEmbeddings !== undefined) {
      params.set("only_missing_embeddings", String(options.onlyMissingEmbeddings));
    }
    const query = params.toString();
    return apiService.post(
      `${this.baseEndpoint}/${projectId}/reprocessar-grafo${query ? `?${query}` : ""}`,
      {}
    );
  }
}

const articleService = new ArtigosService();

export { articleService, ArtigosService };
