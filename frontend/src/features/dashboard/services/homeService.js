import { apiService } from "@/services/api";
export const homeService = {
  getReading: ({ projectId, articleId }) => apiService.get(`/api/home/reading?${new URLSearchParams({ projectId, articleId })}`),
  getSummary: () => apiService.get("/api/home/summary"),
  getTasks: ({ phase = "screening", page = 1, pageSize = 4 } = {}) => apiService.get(`/api/home/tasks?${new URLSearchParams({ phase, page, pageSize })}`),
  getActivity: ({ page = 1, pageSize = 4 } = {}) => apiService.get(`/api/home/activity?${new URLSearchParams({ page, pageSize })}`),
};
