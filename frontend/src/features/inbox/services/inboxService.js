import { apiService } from "@/services/api";

export const inboxService = {
  getInbox(params) { return apiService.get("/api/inbox", params); },
  acceptInvitation(id) { return apiService.post(`/api/invitations/${id}/accept`, {}); },
  declineInvitation(id) { return apiService.post(`/api/invitations/${id}/decline`, {}); },
  markNotificationRead(id) { return apiService.patch(`/api/notifications/${id}/read`, {}); },
  markAllNotificationsRead() { return apiService.post("/api/notifications/read-all", {}); },
};
