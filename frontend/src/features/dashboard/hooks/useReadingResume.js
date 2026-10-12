import { useCallback } from "react";
import { useRemoteResource } from "@/hooks/useRemoteResource";
import { homeService } from "../services/homeService";
import { clearReadingResume, readReadingResume } from "../utils/readingResume";

export function useReadingResume(userId) {
  const resource = useRemoteResource({ key: `reading:${userId}`, enabled: Boolean(userId), load: async () => {
    const reference = readReadingResume(userId);
    if (!reference) return null;
    try {
      const { article, project } = await homeService.getReading(reference);
      return { article: { ...article, projectId: reference.projectId }, project, workspace: reference.workspace };
    } catch (error) {
      if ([403, 404].includes(error.status ?? error.response?.status)) {
        clearReadingResume(userId);
        return null;
      }
      throw error;
    }
  } });
  const setData = resource.setData;
  const clear = useCallback(() => { clearReadingResume(userId); setData(null); }, [userId, setData]);
  return { article: resource.error || resource.loading ? null : resource.data?.article ?? null,
    project: resource.error || resource.loading ? null : resource.data?.project ?? null,
    workspace: resource.data?.workspace, loading: resource.loading, error: resource.error, retry: resource.reload, clear };
}
