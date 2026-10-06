import { apiService } from "@/services/api";

export const settingsService = {
  getDeepSeekKeyStatus() {
    return apiService.get("/api/settings/deepseek-key");
  },
  saveDeepSeekKey(apiKey) {
    return apiService.put("/api/settings/deepseek-key", { apiKey });
  },
  deleteDeepSeekKey() {
    return apiService.delete("/api/settings/deepseek-key");
  },
};
