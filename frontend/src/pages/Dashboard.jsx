import { useAuth } from "@/features/auth";
import { projectService } from "@/features/projects";
import { statsService } from "@/services/statsService";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  FolderIcon,
  FileTextIcon,
  CheckCircle2Icon,
  PlusCircleIcon,
  ClockIcon,
  TrendingUpIcon,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { ChartAreaInteractive } from "@/components/ChartAreaInteractive";
import { PageHeader, LoadingState, StatCard, EmptyState } from "@/components/layout";

function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [projetos, setProjetos] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [pendingArticles, setPendingArticles] = useState([]);
  const [dailyReviews, setDailyReviews] = useState([]);
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
      setPendingArticles(statsData.pendingArticles || []);
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

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header com saudação */}
      <PageHeader
        title={`Bem-vindo, ${user?.name || "Usuário"}!`}
        description={
          <span>
            <strong>{stats?.textsReviewedToday || 0}</strong> textos revisados hoje,{" "}
            <strong>{stats?.textsToReview || 0}</strong> textos para revisar.
          </span>
        }
      />

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de projetos"
          value={stats?.totalProjects || 0}
          icon={FolderIcon}
          loading={statsLoading}
        />
        <StatCard
          title="Total de Artigos"
          value={stats?.totalArticles || 0}
          icon={FileTextIcon}
          loading={statsLoading}
        />
        <StatCard
          title="Artigos Revisados"
          value={stats?.totalArticlesReviewed || 0}
          icon={CheckCircle2Icon}
          loading={statsLoading}
        />
        <StatCard
          title="Último projeto criado"
          value={stats?.lastProject?.title || "N/A"}
          icon={PlusCircleIcon}
          loading={statsLoading}
        />
      </div>

      {/* Seção principal: Artigos pendentes + Gráfico */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Artigos Pendentes */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">
                  Artigos Pendentes ({stats?.textsToReview || 0})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {statsLoading ? (
                <LoadingState message="Carregando artigos..." />
              ) : pendingArticles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Autores</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingArticles.slice(0, 7).map((article) => (
                      <TableRow
                        key={article.id}
                        onClick={() =>
                          navigate(
                            `/projetos/${article.projectId}/artigos/${article.id}`
                          )
                        }
                        className="cursor-pointer hover:bg-accent"
                      >
                        <TableCell className="flex items-center gap-2">
                          <FileTextIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate max-w-[200px]" title={article.title}>
                            {article.title}
                          </span>
                        </TableCell>
                        <TableCell className="truncate max-w-[100px]">
                          {article.projectTitle || "N/A"}
                        </TableCell>
                        <TableCell className="truncate max-w-[100px]">
                          {article.authors}
                        </TableCell>
                        <TableCell>
                          {new Date(article.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={CheckCircle2Icon}
                  title="Tudo em dia!"
                  description="Nenhum artigo pendente de revisão."
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de revisões */}
        <div className="lg:col-span-1">
          {statsLoading ? (
            <Card className="h-full flex items-center justify-center">
              <LoadingState message="Carregando gráfico..." />
            </Card>
          ) : (
            <ChartAreaInteractive data={dailyReviews} />
          )}
        </div>
      </div>

      {/* Lista de projetos */}
      <Card className="flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FolderIcon className="h-5 w-5" />
            <CardTitle className="text-lg">Projetos Recentes</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="overflow-auto">
          {loading ? (
            <LoadingState message="Carregando projetos..." />
          ) : projetos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projetos.slice(0, 7).map((project) => (
                  <TableRow
                    key={project.id}
                    onClick={() => navigate(`/projetos/${project.id}`)}
                    className="cursor-pointer hover:bg-accent"
                  >
                    <TableCell className="flex items-center gap-2">
                      <FolderIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate max-w-[200px]" title={project.title}>
                        {project.title}
                      </span>
                    </TableCell>
                    <TableCell>{project.status}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700 w-20">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${project.progressPercentage || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium min-w-[3rem]">
                          {project.progressPercentage || 0}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(project.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={FolderIcon}
              title="Nenhum projeto"
              description="Comece criando seu primeiro projeto."
              actionLabel="Criar Projeto"
              onAction={() => navigate("/projetos")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;
