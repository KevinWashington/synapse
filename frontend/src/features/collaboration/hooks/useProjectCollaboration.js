import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collaborationService } from "../services/collaborationService";
import { projectService } from "@features/projects/services/projectService";

const emptyState = () => ({ members: [], invitations: [], assignments: [], conflicts: [], notifications: [], capabilities: [], loading: false, error: null });
const MUTATIONS = {
  createInvitation: ["team"],
  updateInvitation: ["team"],
  cancelInvitation: ["team"],
  updateMember: ["team"],
  removeMember: ["team", "assignments"],
  transferOwnership: ["team", "access"],
  previewAssignments: [],
  distributeAssignments: ["assignments", "notifications"],
  reassignAssignment: ["assignments", "notifications"],
  markNotificationRead: ["notifications"],
  markAllNotificationsRead: ["notifications"],
  resolveConflict: ["conflicts", "notifications"],
  reopenReview: ["assignments", "conflicts", "notifications"],
};

export function useProjectCollaboration(project) {
  const projectId = project?.id;
  const capabilityKey = JSON.stringify(project?.capabilities ?? []);
  const [state, setState] = useState(emptyState);
  const sessionRef = useRef(null);

  const recordError = useCallback((session, error) => {
    if (!session.active) return;
    if (error.status === 404 && (!error.data?.code || error.data.code === "PROJECT_NOT_FOUND")) {
      session.active = false;
      clearInterval(session.timer);
      setState({ ...emptyState(), error: error.message || "Erro ao carregar projeto" });
    } else {
      setState((current) => ({ ...current, error: error.message || "Erro ao carregar colaboração" }));
    }
  }, []);

  const loadCollection = useCallback(async (session, collection) => {
    if (!session?.active) return;
    if (collection === "conflicts" && !session.capabilities.includes("resolve_conflicts")) return;
    if (collection === "assignments" && !session.capabilities.includes("review_assigned")) return;
    const loaders = {
      team: () => collaborationService.getTeam(session.id),
      assignments: () => collaborationService.getMyAssignments(session.id),
      conflicts: () => collaborationService.getConflicts(session.id),
      notifications: () => collaborationService.getNotifications(session.id),
      access: () => projectService.getProjectAccess(session.id),
    };
    try {
      const response = await loaders[collection]();
      if (!session.active) return;
      if (collection === "access") session.capabilities = response.capabilities;
      setState((current) => {
        if (collection === "team") return { ...current, members: response.members, invitations: response.invitations };
        if (collection === "access") return {
          ...current,
          capabilities: response.capabilities,
          assignments: response.capabilities.includes("review_assigned") ? current.assignments : [],
          conflicts: response.capabilities.includes("resolve_conflicts") ? current.conflicts : [],
        };
        return { ...current, [collection]: response ?? [] };
      });
    } catch (error) {
      recordError(session, error);
      throw error;
    }
  }, [recordError]);

  useEffect(() => {
    const capabilities = JSON.parse(capabilityKey);
    const session = { id: projectId, capabilities, active: Boolean(projectId), timer: null };
    sessionRef.current = session;
    setState({ ...emptyState(), capabilities: projectId ? capabilities : [], loading: Boolean(projectId) });
    if (!projectId) return;
    Promise.allSettled(["team", "notifications", "assignments", "conflicts"].map((collection) => loadCollection(session, collection)))
      .then(() => { if (session.active) setState((current) => ({ ...current, loading: false })); });
    session.timer = setInterval(() => {
      loadCollection(session, "notifications").catch(() => {});
    }, 30000);
    return () => {
      session.active = false;
      clearInterval(session.timer);
    };
  }, [projectId, capabilityKey, loadCollection]);

  const actions = useMemo(() => Object.fromEntries(Object.entries(MUTATIONS).map(([method, affected]) => [method, async (...args) => {
    const session = sessionRef.current;
    if (!session?.active) return;
    setState((current) => ({ ...current, error: null }));
    try {
      const response = await collaborationService[method](session.id, ...args);
      await Promise.all(affected.map((collection) => loadCollection(session, collection)));
      return response;
    } catch (error) {
      recordError(session, error);
      throw error;
    }
  }])), [loadCollection, recordError]);

  const refreshTeam = useCallback(() => loadCollection(sessionRef.current, "team"), [loadCollection]);
  const refreshAssignments = useCallback(() => loadCollection(sessionRef.current, "assignments"), [loadCollection]);
  const refreshConflicts = useCallback(() => loadCollection(sessionRef.current, "conflicts"), [loadCollection]);
  const refreshNotifications = useCallback(() => loadCollection(sessionRef.current, "notifications"), [loadCollection]);

  return {
    ...state,
    unreadCount: state.notifications.filter((notification) => !notification.readAt).length,
    ...actions,
    refreshTeam,
    refreshAssignments,
    refreshConflicts,
    refreshNotifications,
  };
}

export default useProjectCollaboration;
