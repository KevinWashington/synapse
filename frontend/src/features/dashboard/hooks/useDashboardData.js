import { useCallback, useEffect, useState } from "react";
import { homeService } from "../services/homeService";
import { inboxService } from "@features/inbox/public/services";
import { statsService } from "@services/statsService";
import { useRemoteResource } from "@/hooks/useRemoteResource";

export default function useDashboardData(userId) {
  const [phase, changePhase] = useState("screening");
  const [taskPage, setTaskPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const enabled = Boolean(userId);
  const summary = useRemoteResource({ key: `home-summary:${userId}`, enabled, load: homeService.getSummary });
  const tasks = useRemoteResource({ key: `home-tasks:${userId}:${phase}:${taskPage}`, enabled, load: () => homeService.getTasks({ phase, page: taskPage, pageSize: 4 }) });
  const activity = useRemoteResource({ key: `home-activity:${userId}:${activityPage}`, enabled, load: () => homeService.getActivity({ page: activityPage, pageSize: 4 }) });
  const stats = useRemoteResource({ key: `home-stats:${userId}`, enabled, load: () => statsService.getUserStats() });
  const inbox = useRemoteResource({ key: `home-inbox:${userId}`, enabled, load: () => inboxService.getInbox() });
  const setPhase = useCallback((next) => { changePhase(next); setTaskPage(1); }, []);
  useEffect(() => { if (tasks.data && !tasks.loading && !tasks.error) setTaskPage((page) => Math.min(page, Math.max(1, Math.ceil(tasks.data.total / 4)))); }, [tasks.data, tasks.loading, tasks.error]);
  useEffect(() => { if (activity.data && !activity.loading && !activity.error) setActivityPage((page) => Math.min(page, Math.max(1, Math.ceil(activity.data.total / 4)))); }, [activity.data, activity.loading, activity.error]);
  return { phase, setPhase, taskPage, setTaskPage, activityPage, setActivityPage, summary, tasks, activity, stats, inbox,
    refresh: () => Promise.all([summary.reload(), tasks.reload(), activity.reload(), stats.reload(), inbox.reload()]),
    chartData: (stats.error ? [] : stats.data?.dailyReviews || []).map(({ date, count }) => ({ date, count })),
  };
}
