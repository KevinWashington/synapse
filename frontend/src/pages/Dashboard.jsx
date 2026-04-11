import { useNavigate } from "react-router-dom";
import { BrainCircuit, FileTextIcon, FolderIcon, Target } from "lucide-react";
import { MetricCard } from "@/components/layout/MetricCard";
import { useAuth } from "@/features/auth";
import {
  ProjectOverviewSection,
  ReviewsChartCard,
  useDashboardData,
} from "@/features/dashboard";
import { usePageTitle } from "@hooks/usePageTitle";

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
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
  } = useDashboardData();

  usePageTitle({ title: `Bem-vindo, ${user?.name || "Usuário"}` });

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <ReviewsChartCard chartData={chartData} />

      <ProjectOverviewSection
        activeTab={activeTab}
        filteredProjects={filteredProjects}
        loading={loading}
        onOpenProject={(projectId) =>
          navigate(projectId ? `/projetos/${projectId}` : "/projetos")
        }
        onTabChange={setActiveTab}
        tabs={tabs}
      />
    </div>
  );
}

export default Dashboard;
