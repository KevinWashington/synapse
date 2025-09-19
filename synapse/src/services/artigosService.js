import { apiService } from "./api.js";

class ArtigosService {
  constructor() {
    this.baseEndpoint = "/api/projetos";
  }

  getProjectEndpoint(projectId) {
    return `${this.baseEndpoint}/${projectId}/artigos`;
  }

  async getArticlesByProject(projectId, filters = {}) {
    try {
      if (!projectId) {
        throw new Error("ID do projeto é obrigatório");
      }

      const params = {};

      // Filtros opcionais
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.page) params.page = filters.page;
      if (filters.limit) params.limit = filters.limit;

      return await apiService.get(this.getProjectEndpoint(projectId), params);
    } catch (error) {
      console.error(`Erro ao buscar artigos do projeto ${projectId}:`, error);
      throw error;
    }
  }

  async getArticleById(projectId, articleId) {
    try {
      if (!projectId || !articleId) {
        throw new Error("IDs do projeto e artigo são obrigatórios");
      }

      return await apiService.get(
        `${this.getProjectEndpoint(projectId)}/${articleId}`
      );
    } catch (error) {
      console.error(`Erro ao buscar artigo ${articleId}:`, error);
      throw error;
    }
  }

  getPdfUrl(projectId, articleId) {
    if (!projectId || !articleId) {
      throw new Error("IDs do projeto e artigo são obrigatórios");
    }

    const baseURL = apiService.baseURL.endsWith("/")
      ? apiService.baseURL
      : `${apiService.baseURL}/`;
    return `${baseURL}api/projetos/${projectId}/artigos/${articleId}/pdf`;
  }

  getPdfDownloadUrl(projectId, articleId) {
    if (!projectId || !articleId) {
      throw new Error("IDs do projeto e artigo são obrigatórios");
    }

    const baseURL = apiService.baseURL.endsWith("/")
      ? apiService.baseURL
      : `${apiService.baseURL}/`;
    return `${baseURL}api/projetos/${projectId}/artigos/${articleId}/download`;
  }

  async createArticle(projectId, formData) {
    try {
      if (!projectId) {
        throw new Error("ID do projeto é obrigatório");
      }

      // Validação básica
      if (
        !formData.get("title") ||
        !formData.get("authors") ||
        !formData.get("pdf")
      ) {
        throw new Error("Título, autores e PDF são obrigatórios");
      }

      // Usar apiService para upload de arquivo
      return await apiService.postFormData(
        this.getProjectEndpoint(projectId),
        formData
      );
    } catch (error) {
      console.error(`Erro ao criar artigo no projeto ${projectId}:`, error);
      throw error;
    }
  }

  async updateArticle(projectId, articleId, formData) {
    try {
      if (!projectId || !articleId) {
        throw new Error("IDs do projeto e artigo são obrigatórios");
      }

      return await apiService.putFormData(
        `${this.getProjectEndpoint(projectId)}/${articleId}`,
        formData
      );
    } catch (error) {
      console.error(`Erro ao atualizar artigo ${articleId}:`, error);
      throw error;
    }
  }

  async updateArticleNotes(projectId, articleId, notas) {
    try {
      if (!projectId || !articleId) {
        throw new Error("IDs do projeto e artigo são obrigatórios");
      }

      if (notas === undefined || notas === null) {
        throw new Error("Notas são obrigatórias");
      }

      return await apiService.patch(
        `${this.getProjectEndpoint(projectId)}/${articleId}/notes`,
        { notas }
      );
    } catch (error) {
      console.error(`Erro ao atualizar notas do artigo ${articleId}:`, error);
      throw error;
    }
  }

  async updateArticleStatus(projectId, articleId, status) {
    try {
      if (!projectId || !articleId) {
        throw new Error("IDs do projeto e artigo são obrigatórios");
      }

      if (!status || !["pendente", "analisado", "excluido"].includes(status)) {
        throw new Error("Status inválido");
      }

      return await apiService.patch(
        `${this.getProjectEndpoint(projectId)}/${articleId}/status`,
        { status }
      );
    } catch (error) {
      console.error(`Erro ao atualizar status do artigo ${articleId}:`, error);
      throw error;
    }
  }

  async deleteArticle(projectId, articleId) {
    try {
      if (!projectId || !articleId) {
        throw new Error("IDs do projeto e artigo são obrigatórios");
      }

      return await apiService.delete(
        `${this.getProjectEndpoint(projectId)}/${articleId}`
      );
    } catch (error) {
      console.error(`Erro ao deletar artigo ${articleId}:`, error);
      throw error;
    }
  }

  // =================== RELACIONAMENTOS ===================

  async getArticleRelationships(projectId, articleId) {
    try {
      if (!projectId || !articleId) {
        throw new Error("IDs do projeto e artigo são obrigatórios");
      }

      return await apiService.get(
        `${this.getProjectEndpoint(projectId)}/${articleId}/relacionamentos`
      );
    } catch (error) {
      console.error(
        `Erro ao buscar relacionamentos do artigo ${articleId}:`,
        error
      );
      throw error;
    }
  }

  async addArticleRelationship(projectId, articleId, relatedArticleId) {
    try {
      if (!projectId || !articleId || !relatedArticleId) {
        throw new Error(
          "IDs do projeto, artigo e artigo relacionado são obrigatórios"
        );
      }

      return await apiService.post(
        `${this.getProjectEndpoint(projectId)}/${articleId}/relacionamentos`,
        {
          relatedArticleId,
        }
      );
    } catch (error) {
      console.error(
        `Erro ao adicionar relacionamento ao artigo ${articleId}:`,
        error
      );
      throw error;
    }
  }

  async removeArticleRelationship(projectId, articleId, relatedArticleId) {
    try {
      if (!projectId || !articleId || !relatedArticleId) {
        throw new Error(
          "IDs do projeto, artigo e artigo relacionado são obrigatórios"
        );
      }

      return await apiService.delete(
        `${this.getProjectEndpoint(
          projectId
        )}/${articleId}/relacionamentos/${relatedArticleId}`
      );
    } catch (error) {
      console.error(
        `Erro ao remover relacionamento do artigo ${articleId}:`,
        error
      );
      throw error;
    }
  }

  async getProjectGraph(projectId) {
    try {
      if (!projectId) {
        throw new Error("ID do projeto é obrigatório");
      }

      return await apiService.get(`${this.baseEndpoint}/${projectId}/grafo`);
    } catch (error) {
      console.error(`Erro ao buscar grafo do projeto ${projectId}:`, error);
      throw error;
    }
  }
}

const articleService = new ArtigosService();

export { articleService, ArtigosService };
