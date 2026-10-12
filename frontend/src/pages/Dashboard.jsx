import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ReviewSummaryHeader from "@/components/layout/ReviewSummaryHeader";
import { useAuth } from "@/features/auth";
import { ReviewsChartCard, useDashboardData, useReadingResume, ReadingResumePanel, PersonalWorkPanel, RecentActivityPanel } from "@/features/dashboard";
import { UserInbox } from "@features/inbox/public/components";
import { usePageTitle } from "@hooks/usePageTitle";

function Dashboard() {
  const { user } = useAuth();
  const data = useDashboardData(user?.id);
  const resume = useReadingResume(user?.id);
  const { summary, tasks, activity, stats, inbox } = data;
  const loading = [summary, tasks, activity, stats, inbox].some((resource) => resource.loading);
  usePageTitle({ title: `Bem-vindo, ${user?.name || "Usuário"}` });
  const formatNumber = (resource, field) => resource.loading || resource.error || resource.data?.[field] == null ? "—" : new Intl.NumberFormat("pt-BR").format(resource.data[field]);

  return (
    <div className="min-w-0 space-y-4">
      <ReviewSummaryHeader title="Seu espaço de revisão" description="Retome sua leitura, revise suas pendências e acompanhe o que mudou."
        actions={<div className="flex flex-wrap gap-2"><UserInbox trigger={<Button variant="outline">Ver convites</Button>} onUpdated={inbox.reload} /><Button variant="outline" aria-label="Atualizar início" disabled={loading} onClick={() => { data.refresh(); resume.retry(); }} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</Button></div>}
        metrics={[
          { label: "Aguardam sua triagem", value: formatNumber(summary, "screeningPending") },
          { label: "Aguardam sua elegibilidade", value: formatNumber(summary, "eligibilityPending") },
          { label: "Convites pendentes", value: formatNumber(inbox, "pendingInvitationCount") },
        ]} />
      {[summary, inbox].map((resource, index) => resource.error && <div key={index} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e6ef] bg-white p-4 text-sm text-[#667391]"><p>{index === 0 ? "Seus indicadores pessoais estão indisponíveis." : "Não foi possível carregar a contagem de convites."}</p><Button variant="outline" size="sm" onClick={resource.reload}>Tentar novamente</Button></div>)}
      <ReadingResumePanel resume={resume} />
      <div className="grid min-w-0 overflow-hidden rounded-xl border border-[#e2e6ef] bg-white lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <PersonalWorkPanel phase={data.phase} setPhase={data.setPhase} page={data.taskPage} setPage={data.setTaskPage} resource={tasks} counts={summary.error ? null : summary.data} />
        <div className="min-w-0 border-t border-[#edf0f7] lg:border-l lg:border-t-0"><RecentActivityPanel resource={activity} page={data.activityPage} setPage={data.setActivityPage} /><ReviewsChartCard chartData={data.chartData} loading={stats.loading} error={stats.error} embedded /></div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[#667391]"><p>Nos seus projetos · {formatNumber(stats, "totalProjects")} projetos · {formatNumber(stats, "totalArticles")} artigos</p>{stats.error && <Button variant="ghost" size="sm" onClick={stats.reload}>Tentar carregar dados da conta</Button>}</footer>
    </div>
  );
}

export default Dashboard;
