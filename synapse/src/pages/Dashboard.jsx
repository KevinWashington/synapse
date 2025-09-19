import { useAuth } from "../hooks/useAuth.js";
import { projectService } from "../services/projetosService.js";
import { statsService } from "../services/statsService.js";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardContent } from "../components/ui/card.tsx";
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
} from "../components/ui/table.tsx";

function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [projetos, setProjetos] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [pendingArticles, setPendingArticles] = useState([]);
  const [dailyReviews, setDailyReviews] = useState([]);
  const navigate = useNavigate();

  const loadProjects = useCallback(async (filters = {}) => {
    try {
      setLoading(true);

      const params = {
        page: 1,
        limit: 20,
        ...filters,
      };

      const response = await projectService.getAllProjects(params);

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
    loadProjects().then((r) => r);
    loadStats();
  }, [loadProjects, loadStats]);

  const { user } = useAuth();

  return (
    <div className="h-full flex flex-col gap-2">
      <h1 className="text-2xl font-bold text-foreground">
        Bem-vindo, {user?.name || "Usuário"}!
      </h1>
      <p className="text-foreground">
        <span className="font-semibold">{stats?.textsReviewedToday || 0}</span>{" "}
        textos revisados hoje,{" "}
        <span className="font-semibold">{stats?.textsToReview || 0}</span>{" "}
        textos para revisar.
      </p>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Card className="gap-0 pr-3 bg-background dark:bg-dark-background">
          <div className="flex items-center">
            <div className="flex-1">
              <CardHeader>
                <h2 className="text-md font-semibold text-muted-foreground">
                  Total de projetos
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-3xl font-semibold">
                    {statsLoading ? "..." : stats?.totalProjects || 0}
                  </p>
                </div>
              </CardContent>
            </div>
            <FolderIcon className="h-12 w-12" />
          </div>
        </Card>
        <Card className="gap-0 pr-3 bg-background dark:bg-dark-background">
          <div className="flex items-center">
            <div className="flex-1">
              <CardHeader>
                <h2 className="text-md font-semibold text-muted-foreground">
                  Total de Artigos
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-3xl font-semibold">
                    {statsLoading ? "..." : stats?.totalArticles || 0}
                  </p>
                </div>
              </CardContent>
            </div>
            <FileTextIcon className="h-12 w-12" />
          </div>
        </Card>
        <Card className="gap-0 pr-3 bg-background dark:bg-dark-background">
          <div className="flex items-center">
            <div className="flex-1">
              <CardHeader>
                <h2 className="text-md font-semibold text-muted-foreground">
                  Artigos Revisados
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-3xl font-semibold">
                    {statsLoading ? "..." : stats?.totalArticlesReviewed || 0}
                  </p>
                </div>
              </CardContent>
            </div>
            <CheckCircle2Icon className="h-12 w-12" />
          </div>
        </Card>
        <Card className="gap-0 pr-3 bg-background dark:bg-dark-background">
          <div className="flex items-center">
            <div className="flex-1">
              <CardHeader>
                <h2 className="text-md font-semibold text-muted-foreground">
                  Último projeto criado
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-3xl font-semibold">
                    {statsLoading ? "..." : stats?.lastProject?.title || "N/A"}
                  </p>
                </div>
              </CardContent>
            </div>
            <PlusCircleIcon className="h-12 w-12" />
          </div>
        </Card>
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <div className="lg:col-span-2 flex flex-col">
          <Card className="gap-0 flex-1 flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-muted-foreground">
                  Artigos Pendentes de Revisão ({stats?.textsToReview || 0})
                </h2>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {statsLoading ? (
                <p>Carregando...</p>
              ) : (
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
                    {(pendingArticles || []).map((article) => (
                      <TableRow
                        key={article._id}
                        onClick={() => {
                          navigate(
                            `/projetos/${article.projectId._id}/artigos/${article._id}`
                          );
                        }}
                        className="cursor-pointer hover:bg-accent"
                      >
                        <TableCell className="flex items-center gap-2">
                          <FileTextIcon className="h-4 w-4" />
                          {article.title}
                        </TableCell>
                        <TableCell>
                          {article.projectId?.title || "N/A"}
                        </TableCell>
                        <TableCell>{article.authors}</TableCell>
                        <TableCell>
                          {new Date(article.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!pendingArticles || pendingArticles.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          Nenhum artigo pendente
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 flex flex-col">
          <Card className="gap-0 flex-1 flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUpIcon className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold text-muted-foreground">
                  Revisões por Dia
                </h2>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex items-center">
              {statsLoading ? (
                <p>Carregando...</p>
              ) : (
                <div className="space-y-2 w-full">
                  {dailyReviews.map((day) => {
                    const maxCount = Math.max(
                      ...dailyReviews.map((d) => d.count),
                      1
                    );
                    const width = (day.count / maxCount) * 100;

                    return (
                      <div key={day.date} className="flex items-center gap-3">
                        <div className="w-8 text-xs text-muted-foreground">
                          {day.dayName}
                        </div>
                        <div className="flex-1 relative h-6 bg-gray-200 rounded dark:bg-gray-700">
                          <div
                            className="absolute top-0 left-0 bg-green-500 h-full rounded transition-all duration-500 ease-out"
                            style={{
                              width: `${width}%`,
                              minWidth: day.count > 0 ? "4px" : "0px",
                            }}
                          />
                        </div>
                        <div className="w-6 text-xs font-medium text-right">
                          {day.count}
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-xs text-muted-foreground text-center mt-3">
                    Últimos 5 dias
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="flex-grow">
        <Card className="gap-0 h-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderIcon className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-muted-foreground">
                Projetos
              </h2>
            </div>
          </CardHeader>
          <CardContent className="h-full overflow-auto">
            {loading ? (
              <p>Loading...</p>
            ) : (
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
                  {(projetos || []).map((project) => (
                    <TableRow
                      key={project._id}
                      onClick={() => {
                        navigate(`/projetos/${project._id}`);
                      }}
                      className="cursor-pointer hover:bg-accent"
                    >
                      <TableCell className="flex items-center gap-2">
                        <FolderIcon className="h-4 w-4" /> {project.title}
                      </TableCell>
                      <TableCell>{project.status}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                            <div
                              className="bg-green-500 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${project.progressPercentage || 0}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium min-w-[3rem]">
                            {project.progressPercentage || 0}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
