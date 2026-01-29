import { apiService } from "./api.js";

class StatsService {
  constructor() {
    this.endpoint = "/api/stats";
  }

  async getUserStats() {
    try {
      return await apiService.get(this.endpoint);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      throw error;
    }
  }
}

const statsService = new StatsService();

export { statsService, StatsService };
