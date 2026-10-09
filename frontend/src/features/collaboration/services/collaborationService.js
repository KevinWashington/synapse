import { apiService } from "@/services/api";

const base = (projectId) => `/api/projetos/${projectId}`;

class CollaborationService {
  getTeam(id) { return apiService.get(`${base(id)}/members`); }
  createInvitation(id, data) { return apiService.post(`${base(id)}/invitations`, data); }
  updateInvitation(id, invitationId, data) { return apiService.patch(`${base(id)}/invitations/${invitationId}`, data); }
  cancelInvitation(id, invitationId) { return apiService.delete(`${base(id)}/invitations/${invitationId}`); }
  updateMember(id, memberId, data) { return apiService.patch(`${base(id)}/members/${memberId}`, data); }
  removeMember(id, memberId) { return apiService.delete(`${base(id)}/members/${memberId}`); }
  transferOwnership(id, data) { return apiService.post(`${base(id)}/transfer-ownership`, data); }
  previewAssignments(id, data) { return apiService.post(`${base(id)}/assignments/preview`, data); }
  distributeAssignments(id, data) { return apiService.post(`${base(id)}/assignments/distribute`, data); }
  getMyAssignments(id, phase) {
    return phase
      ? apiService.get(`${base(id)}/assignments/me`, { phase })
      : apiService.get(`${base(id)}/assignments/me`);
  }
  getAssignments(id) { return apiService.get(`${base(id)}/assignments`); }
  reassignAssignment(id, assignmentId, data) { return apiService.patch(`${base(id)}/assignments/${assignmentId}`, data); }
  getConflicts(id) { return apiService.get(`${base(id)}/conflicts`); }
  resolveConflict(id, conflictId, data) { return apiService.post(`${base(id)}/conflicts/${conflictId}/resolve`, data); }
  reopenReview(id, articleId, data) { return apiService.post(`${base(id)}/artigos/${articleId}/reopen-review`, data); }
}

const collaborationService = new CollaborationService();
export { collaborationService, CollaborationService };
