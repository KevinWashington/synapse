import { apiService } from "./api.js";

class RecommendationsService {
  constructor() {
    this.baseEndpoint = "/api/projetos";
  }

  /**
   * Obter recomendações de artigos similares
   */
  async getArticleRecommendations(projectId, articleId, options = {}) {
    try {
      if (!projectId || !articleId) {
        throw new Error("IDs do projeto e artigo são obrigatórios");
      }

      const params = {
        provider: options.provider || "gemini",
        limit: options.limit || 10,
        minSimilarity: options.minSimilarity || 0.1, // Reduzido de 0.3 para 0.1
      };

      return await apiService.get(
        `${this.baseEndpoint}/${projectId}/artigos/${articleId}/recomendacoes`,
        params
      );
    } catch (error) {
      console.error(
        `Erro ao buscar recomendações do artigo ${articleId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Auto-relacionar artigos similares
   */
  async autoRelateSimilarArticles(projectId, articleId, options = {}) {
    try {
      if (!projectId || !articleId) {
        throw new Error("IDs do projeto e artigo são obrigatórios");
      }

      const body = {
        provider: options.provider || "gemini",
        similarityThreshold: options.similarityThreshold || 0.7,
        maxRelations: options.maxRelations || 5,
      };

      return await apiService.post(
        `${this.baseEndpoint}/${projectId}/artigos/${articleId}/recomendacoes/auto-relacionar`,
        body
      );
    } catch (error) {
      console.error(
        `Erro ao auto-relacionar artigos do artigo ${articleId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Obter insights do projeto
   */
  async getProjectInsights(projectId) {
    try {
      if (!projectId) {
        throw new Error("ID do projeto é obrigatório");
      }

      return await apiService.get(
        `${this.baseEndpoint}/${projectId}/recomendacoes/insights`
      );
    } catch (error) {
      console.error(`Erro ao buscar insights do projeto ${projectId}:`, error);
      throw error;
    }
  }
}

const recommendationsService = new RecommendationsService();

export { recommendationsService, RecommendationsService };
