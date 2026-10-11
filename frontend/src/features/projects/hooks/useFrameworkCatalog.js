import { useCallback } from "react";
import { useRemoteResource } from "@/hooks/useRemoteResource";
import { projectService } from "../services/projectService";
export function useFrameworkCatalog() {
  const load = useCallback(() => projectService.getFrameworks(), []);
  const resource = useRemoteResource({ key: "framework-catalog", load });
  return { frameworks: resource.data || [], loading: resource.loading, error: resource.error, reload: resource.reload };
}
