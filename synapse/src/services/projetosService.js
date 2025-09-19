import { apiService } from "./api.js";

class ProjectService {
  constructor() {
    this.endpoint = "/api/projetos";
  }

  async getAllProjects(filters = {}) {
    try {
      const params = {};

      // Filtros opcionais
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.page) params.page = filters.page;
      if (filters.limit) params.limit = filters.limit;

      return await apiService.get(this.endpoint, params);
    } catch (error) {
      console.error("Erro ao buscar projetos:", error);
      throw error;
    }
  }

  async getProjectById(id) {
    try {
      if (!id) {
        throw new Error("ID do projeto é obrigatório");
      }

      return await apiService.get(`${this.endpoint}/${id}`);
    } catch (error) {
      console.error(`Erro ao buscar projeto ${id}:`, error);
      throw error;
    }
  }

  async createProject(projectData) {
    try {
      // Validação básica
      if (!projectData.title || !projectData.objetivo) {
        throw new Error("Título e objetivo são obrigatórios");
      }

      return await apiService.post(this.endpoint, projectData);
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
      throw error;
    }
  }

  async updateProject(id, projectData) {
    try {
      if (!id) {
        throw new Error("ID do projeto é obrigatório");
      }

      return await apiService.put(`${this.endpoint}/${id}`, projectData);
    } catch (error) {
      console.error(`Erro ao atualizar projeto ${id}:`, error);
      throw error;
    }
  }

  async deleteProject(id) {
    try {
      if (!id) {
        throw new Error("ID do projeto é obrigatório");
      }

      return await apiService.delete(`${this.endpoint}/${id}`);
    } catch (error) {
      console.error(`Erro ao deletar projeto ${id}:`, error);
      throw error;
    }
  }

  async getProjectsByStatus(status) {
    return this.getAllProjects({ status });
  }

  async searchProjects(searchTerm, filters = {}) {
    return this.getAllProjects({
      search: searchTerm,
      ...filters,
    });
  }

  async generateResearchQuestions(picocData, projeto) {
    try {
      return await apiService.post("/api/generate-research-questions", {
        picocData,
        projeto,
      });
    } catch (error) {
      console.error("Erro ao gerar research questions:", error);
      throw error;
    }
  }

  async generateSearchStrings(researchQuestions, picocData, projeto) {
    try {
      return await apiService.post("/api/generate-search-strings", {
        researchQuestions,
        picocData,
        projeto,
      });
    } catch (error) {
      console.error("Erro ao gerar strings de busca:", error);
      throw error;
    }
  }
}

const projectService = new ProjectService();

export { projectService, ProjectService };
