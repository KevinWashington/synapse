import { useCallback, useEffect, useMemo, useState } from "react";
import { projectService } from "@features/projects/services/projectService";
import { statsService } from "@services/statsService";

function useDashboardData() {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [dailyReviews, setDailyReviews] = useState([]);
  const [activeTab, setActiveTab] = useState("active");

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const response = await projectService.getAllProjects({ page: 1, limit: 20 });
      setProjects(response.projects || []);
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const statsData = await statsService.getUserStats();
      setStats(statsData);
      setDailyReviews(statsData.dailyReviews || []);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadStats();
  }, [loadProjects, loadStats]);

  const todoProjects = useMemo(
    () => projects.filter((project) => project.status === "ideia"),
    [projects]
  );
  const inProgressProjects = useMemo(
    () => projects.filter((project) => project.status === "em-progresso"),
    [projects]
  );
  const completedProjects = useMemo(
    () => projects.filter((project) => project.status === "concluido"),
    [projects]
  );

  const tabs = useMemo(
    () => [
      {
        key: "active",
        label: "Active",
        count: inProgressProjects.length + todoProjects.length,
      },
      {
        key: "in-progress",
        label: "In Progress",
        count: inProgressProjects.length,
      },
      {
        key: "completed",
        label: "Completed",
        count: completedProjects.length,
      },
    ],
    [completedProjects.length, inProgressProjects.length, todoProjects.length]
  );

  const filteredProjects =
    activeTab === "active"
      ? projects
      : activeTab === "in-progress"
      ? inProgressProjects
      : completedProjects;

  const totalProjects = stats?.totalProjects || 0;
  const totalArticles = stats?.totalArticles || 0;
  const reviewedArticles = stats?.totalArticlesReviewed || 0;
  const completionRate =
    totalArticles > 0 ? Math.round((reviewedArticles / totalArticles) * 100) : 0;

  const chartData = dailyReviews.map((day) => ({
    date: day.date,
    current: day.count,
    previous: 0,
  }));

  return {
    activeTab,
    chartData,
    completionRate,
    filteredProjects,
    loading,
    reviewedArticles,
    setActiveTab,
    statsLoading,
    tabs,
    totalArticles,
    totalProjects,
  };
}

export default useDashboardData;
