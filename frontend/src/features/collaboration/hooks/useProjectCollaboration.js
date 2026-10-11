import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collaborationService } from "../services/collaborationService";
import { projectService } from "@features/projects/public/services";

const emptyState = () => ({
  members: [],
  invitations: [],
  assignments: [],
  conflicts: [],
  capabilities: [],
  loading: false,
  error: null,
});
const assignmentMode = (capabilities) =>
  capabilities.includes("manage_distribution")
    ? "all"
    : capabilities.includes("review_assigned")
      ? "own"
      : null;
const sessionError = (session) => Object.values(session.errors).at(-1) ?? null;
const MUTATIONS = {
  createInvitation: ["team"],
  updateInvitation: ["team"],
  cancelInvitation: ["team"],
  updateMember: ["team", "access"],
  removeMember: ["team", "assignments"],
  transferOwnership: ["team", "access"],
  previewAssignments: [],
  distributeAssignments: ["assignments"],
  previewAdaptation: [],
  adaptAssignments: ["assignments", "conflicts"],
  reassignAssignment: ["assignments"],
  resolveConflict: ["assignments", "conflicts"],
  reopenReview: ["assignments", "conflicts"],
};

export function useProjectCollaboration(project) {
  const projectId = project?.id;
  const capabilityKey = JSON.stringify(project?.capabilities ?? []);
  const [state, setState] = useState(emptyState);
  const sessionRef = useRef(null);

  const recordError = useCallback((session, error, source) => {
    if (!session.active) return;
    if (
      error.status === 404 &&
      (!error.data?.code || error.data.code === "PROJECT_NOT_FOUND")
    ) {
      session.active = false;
      clearInterval(session.timer);
      setState({
        ...emptyState(),
        error: error.message || "Erro ao carregar projeto",
      });
    } else {
      delete session.errors[source];
      session.errors[source] = error.message || "Erro ao carregar colaboração";
      setState((current) => ({ ...current, error: sessionError(session) }));
    }
  }, []);

  const loadCollection = useCallback(
    async (session, collection) => {
      if (!session?.active) return;
      if (
        collection === "conflicts" &&
        !session.capabilities.includes("resolve_conflicts")
      )
        return;
      if (collection === "assignments" && !assignmentMode(session.capabilities))
        return;
      // Only the most recently started request may update a collection or its error.
      const generation = (session.generations[collection] ?? 0) + 1;
      session.generations[collection] = generation;
      const isCurrent = () =>
        session.active && session.generations[collection] === generation;
      const loaders = {
        team: () => collaborationService.getTeam(session.id),
        assignments: () =>
          session.capabilities.includes("manage_distribution")
            ? collaborationService.getAssignments(session.id)
            : collaborationService.getMyAssignments(session.id),
        conflicts: () => collaborationService.getConflicts(session.id),
        access: () => projectService.getProjectAccess(session.id),
      };
      let assignmentsChanged = false;
      try {
        const response = await loaders[collection]();
        if (!isCurrent()) return;
        delete session.errors[collection];
        if (collection === "access") {
          assignmentsChanged =
            assignmentMode(session.capabilities) !==
            assignmentMode(response.capabilities);
          session.capabilities = response.capabilities;
          if (assignmentsChanged) {
            session.generations.assignments =
              (session.generations.assignments ?? 0) + 1;
            delete session.errors.assignments;
          }
          if (!response.capabilities.includes("resolve_conflicts")) {
            session.generations.conflicts =
              (session.generations.conflicts ?? 0) + 1;
            delete session.errors.conflicts;
          }
        }
        setState((current) => {
          const next = { ...current, error: sessionError(session) };
          if (collection === "team")
            return {
              ...next,
              members: response.members,
              invitations: response.invitations,
            };
          if (collection === "access")
            return {
              ...next,
              capabilities: response.capabilities,
              assignments:
                !assignmentsChanged && assignmentMode(response.capabilities)
                  ? current.assignments
                  : [],
              conflicts: response.capabilities.includes("resolve_conflicts")
                ? current.conflicts
                : [],
            };
          return { ...next, [collection]: response ?? [] };
        });
      } catch (error) {
        if (!isCurrent()) return;
        recordError(session, error, collection);
        throw error;
      }
      if (assignmentsChanged && assignmentMode(session.capabilities))
        await loadCollection(session, "assignments");
    },
    [recordError],
  );

  useEffect(() => {
    const capabilities = JSON.parse(capabilityKey);
    const session = {
      id: projectId,
      capabilities,
      active: Boolean(projectId),
      timer: null,
      generations: {},
      errors: {},
    };
    sessionRef.current = session;
    setState({
      ...emptyState(),
      capabilities: projectId ? capabilities : [],
      loading: Boolean(projectId),
    });
    if (!projectId) return;
    Promise.allSettled(
      ["team", "assignments", "conflicts"].map((collection) =>
        loadCollection(session, collection),
      ),
    ).then(() => {
      if (session.active)
        setState((current) => ({ ...current, loading: false }));
    });
    return () => {
      session.active = false;
    };
  }, [projectId, capabilityKey, loadCollection]);

  const actions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(MUTATIONS).map(([method, affected]) => [
          method,
          async (...args) => {
            const session = sessionRef.current;
            if (!session?.active) return;
            const errorSource = `mutation:${method}`;
            delete session.errors[errorSource];
            setState((current) => ({
              ...current,
              error: sessionError(session),
            }));
            let response;
            try {
              response = await collaborationService[method](
                session.id,
                ...args,
              );
            } catch (error) {
              recordError(session, error, errorSource);
              throw error;
            }
            await Promise.all(
              affected.map((collection) => loadCollection(session, collection)),
            );
            return response;
          },
        ]),
      ),
    [loadCollection, recordError],
  );

  const refreshTeam = useCallback(
    () => loadCollection(sessionRef.current, "team"),
    [loadCollection],
  );
  const refreshAssignments = useCallback(
    () => loadCollection(sessionRef.current, "assignments"),
    [loadCollection],
  );
  const refreshConflicts = useCallback(
    () => loadCollection(sessionRef.current, "conflicts"),
    [loadCollection],
  );
  return {
    ...state,
    ...actions,
    refreshTeam,
    refreshAssignments,
    refreshConflicts,
  };
}

export default useProjectCollaboration;
