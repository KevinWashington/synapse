import { apiService } from "@/services/api";

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

      // Filtrar apenas os campos que devem ser atualizados no projeto
      const {
        title,
        objetivo,
        status,
        framework,
        picoc,
        researchQuestions,
        keywords,
        searchStrings,
        criteriosInclusao,
        criteriosExclusao,
        eligibilityChecklist,
        dataExtractionSchema,
        qualityAssessmentSchema,
        screeningGuidance,
        selectionReportNotes,
        // Excluir campos que não devem ser enviados
        articles: _articles,
        prismaStats: _prismaStats,
        id: _projectId,
        owner: _owner,
        ownerId: _ownerId,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        articleCount: _articleCount,
        ..._otherFields
      } = projectData;

      const updateData = {
        title,
        objetivo,
        status,
        framework,
        picoc,
        researchQuestions,
        keywords,
        searchStrings,
        criteriosInclusao,
        criteriosExclusao,
        eligibilityChecklist,
        dataExtractionSchema,
        qualityAssessmentSchema,
        screeningGuidance,
        selectionReportNotes,
      };

      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });

      return await apiService.put(`${this.endpoint}/${id}`, updateData);
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

  async generateResearchQuestions(picocData, project, framework = "PICOC") {
    try {
      return await apiService.post("/api/generate-research-questions", {
        picocData,
        projeto: project,
        framework,
      });
    } catch (error) {
      console.error("Erro ao gerar research questions:", error);
      throw error;
    }
  }

  async generateSearchStrings(
    researchQuestions,
    picocData,
    project,
    framework = "PICOC",
    targetDatabase = "scopus"
  ) {
    try {
      return await apiService.post("/api/generate-search-strings", {
        researchQuestions,
        picocData,
        projeto: project,
        framework,
        targetDatabase,
      });
    } catch (error) {
      console.error("Erro ao gerar strings de busca:", error);
      throw error;
    }
  }

  async generateCriteria(researchQuestions, picocData, project, framework = "PICOC") {
    try {
      return await apiService.post("/api/generate-criteria", {
        researchQuestions,
        picocData,
        projeto: project,
        framework,
      });
    } catch (error) {
      console.error("Erro ao gerar critérios:", error);
      throw error;
    }
  }

  async getProjectOverview(id) {
    try {
      if (!id) {
        throw new Error("ID do projeto é obrigatório");
      }

      return await apiService.get(`${this.endpoint}/${id}/overview`);
    } catch (error) {
      console.error(`Erro ao buscar visão geral do projeto ${id}:`, error);
      throw error;
    }
  }

  async generateDataExtractionSchema(
    researchQuestions,
    picocData,
    project,
    framework = "PICOC"
  ) {
    try {
      return await apiService.post("/api/generate-data-extraction-schema", {
        researchQuestions,
        picocData,
        projeto: project,
        framework,
      });
    } catch (error) {
      console.error("Erro ao gerar esquema de extracao:", error);
      throw error;
    }
  }

  async generateQualityAssessmentSchema(
    researchQuestions,
    picocData,
    project,
    framework = "PICOC"
  ) {
    try {
      return await apiService.post("/api/generate-quality-assessment-schema", {
        researchQuestions,
        picocData,
        projeto: project,
        framework,
      });
    } catch (error) {
      console.error("Erro ao gerar criterios de qualidade:", error);
      throw error;
    }
  }

  async chatWithProject(projectId, messages) {
    try {
      if (!projectId) {
        throw new Error("ID do projeto é obrigatório");
      }

      return await apiService.post("/api/project-chat", {
        projectId: parseInt(projectId),
        messages,
      });
    } catch (error) {
      console.error("Erro no chat com o projeto:", error);
      throw error;
    }
  }
}

const projectService = new ProjectService();

export { projectService, ProjectService };
