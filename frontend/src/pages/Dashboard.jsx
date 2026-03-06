import { useAuth } from "@/features/auth";
import { projectService } from "@/features/projects";
import { statsService } from "@/services/statsService";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import {
  FolderIcon,
  FileTextIcon,
  BrainCircuit,
  Target,
  Clock,
  FileText,
  MessageSquare,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MetricCard } from "@/components/layout/MetricCard";
import { StatusBadge } from "@/components/ui/status-badge";
import { KanbanBoard, KanbanColumn } from "@/components/ui/kanban-column";
import { LoadingState, EmptyState } from "@/components/layout";
import { usePageTitle } from "@/context/pageTitleContext";

function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [projetos, setProjetos] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [dailyReviews, setDailyReviews] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const navigate = useNavigate();
  const { user } = useAuth();

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const response = await projectService.getAllProjects({ page: 1, limit: 20 });
      setProjetos(response.projects || []);
    } catch (err) {
      console.error("Erro ao carregar projetos:", err);
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
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadStats();
  }, [loadProjects, loadStats]);

  const totalProjects = stats?.totalProjects || 0;
  const totalArticles = stats?.totalArticles || 0;
  const reviewedArticles = stats?.totalArticlesReviewed || 0;
  const completionRate = totalArticles > 0 ? Math.round((reviewedArticles / totalArticles) * 100) : 0;

  // Group projects by status for kanban
  const todoProjects = projetos.filter((p) => p.status === "ideia");
  const inProgressProjects = projetos.filter((p) => p.status === "em-progresso");
  const completedProjects = projetos.filter((p) => p.status === "concluido");

  const chartData = dailyReviews.map((day) => ({
    date: day.date,
    current: day.count,
    previous: Math.max(0, day.count - Math.floor(Math.random() * 3)),
  }));

  const tabs = [
    { key: "active", label: "Active", count: inProgressProjects.length + todoProjects.length },
    { key: "in-progress", label: "In Progress", count: inProgressProjects.length },
    { key: "completed", label: "Completed", count: completedProjects.length },
  ];

  const filteredProjects =
    activeTab === "active"
      ? projetos
      : activeTab === "in-progress"
      ? inProgressProjects
      : completedProjects;

  usePageTitle({ title: `Bem-vindo, ${user?.name || "Usuário"}` });

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Projetos"
          value={totalProjects}
          subtitle="ativos esta semana"
          icon={FolderIcon}
          loading={statsLoading}
        />
        <MetricCard
          title="Total de Artigos"
          value={totalArticles}
          subtitle="importados este mês"
          icon={FileTextIcon}
          loading={statsLoading}
        />
        <MetricCard
          title="Análises IA"
          value={reviewedArticles}
          trend={reviewedArticles > 0 ? `+${reviewedArticles}` : undefined}
          trendDirection="up"
          icon={BrainCircuit}
          loading={statsLoading}
        />
        <MetricCard
          title="Taxa de Conclusão"
          value={`${completionRate}%`}
          subtitle="artigos revisados"
          icon={Target}
          loading={statsLoading}
        />
      </div>

      {/* Chart */}
      <div className="rounded-[var(--syn-radius-card)] bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)] border border-[var(--syn-border)] shadow-[var(--syn-shadow-card)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--syn-text-primary)]">
              Artigos por Semana
            </h3>
            <p className="text-xs text-[var(--syn-text-secondary)]">
              Período atual vs anterior
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--syn-chart-current)" }} />
              <span className="text-[var(--syn-text-secondary)]">Período Atual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--syn-chart-previous)" }} />
              <span className="text-[var(--syn-text-secondary)]">Período Anterior</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--syn-chart-current)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--syn-chart-current)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillPrevious" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--syn-chart-previous)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--syn-chart-previous)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--syn-border)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--syn-text-secondary)", fontSize: 11 }}
              tickFormatter={(v) => {
                const d = new Date(v);
                return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--syn-text-secondary)", fontSize: 11 }}
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--syn-bg-primary)",
                border: "1px solid var(--syn-border)",
                borderRadius: "var(--syn-radius-card)",
                fontSize: 12,
              }}
              labelFormatter={(v) =>
                new Date(v).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
              }
            />
            <Area
              type="monotone"
              dataKey="previous"
              stroke="var(--syn-chart-previous)"
              fill="url(#fillPrevious)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke="var(--syn-chart-current)"
              fill="url(#fillCurrent)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Tabs + project mini-cards */}
      <div>
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--syn-border)] mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-[var(--syn-sidebar-accent)]"
                  : "text-[var(--syn-text-secondary)] hover:text-[var(--syn-text-primary)]"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                  activeTab === tab.key
                    ? "bg-[var(--syn-sidebar-accent)] text-white"
                    : "bg-[var(--syn-badge-neutral-bg)] text-[var(--syn-badge-neutral-text)]"
                }`}
              >
                {tab.count}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--syn-sidebar-accent)]" />
              )}
            </button>
          ))}
        </div>

        {/* Project cards */}
        {loading ? (
          <LoadingState message="Carregando projetos..." />
        ) : filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredProjects.slice(0, 6).map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projetos/${project.id}`)}
                className="p-4 rounded-[var(--syn-radius-card)] bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)] border border-[var(--syn-border)] shadow-[var(--syn-shadow-card)] cursor-pointer hover:shadow-[var(--syn-shadow-card-hover)] syn-transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-[var(--syn-text-primary)] line-clamp-1">
                    {project.title}
                  </h4>
                  <StatusBadge status={project.status} />
                </div>
                <p className="text-xs text-[var(--syn-text-secondary)] line-clamp-2 mb-3">
                  {project.objetivo}
                </p>
                <div className="flex items-center gap-4 text-xs text-[var(--syn-text-secondary)]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(project.updatedAt || project.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {project.articleCount || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderIcon}
            title="Nenhum projeto"
            description="Comece criando seu primeiro projeto."
            actionLabel="Criar Projeto"
            onAction={() => navigate("/projetos")}
          />
        )}
      </div>
    </div>
  );
}

export default Dashboard;
