import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  FilterIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { articleService } from "@/features/articles/services/articleService";
import {
  SOURCE_CATEGORY_OPTIONS,
  STUDY_TYPE_OPTIONS,
} from "@/features/articles/utils/selectionFlow";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import ImportBibTeXModal from "./ImportBibTeXModal";
import NewArticleModal from "./NewArticleModal";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "included", label: "Incluido" },
  { value: "screening", label: "Em triagem" },
  { value: "eligibility", label: "Elegivel" },
  { value: "excluded", label: "Excluido" },
  { value: "identification", label: "Identificacao" },
];

const STATUS_BADGE = {
  included: "bg-[#e8f8ef] text-[#258c55]",
  screening: "bg-[#fff6e5] text-[#d48700]",
  eligibility: "bg-[#fff6e5] text-[#d48700]",
  excluded: "bg-[#ffecef] text-[#d94343]",
  identification: "bg-[#eef1ff] text-[#6259ff]",
};

const STATUS_LABEL = {
  included: "Incluido",
  screening: "Em triagem",
  eligibility: "Elegivel",
  excluded: "Excluido",
  identification: "Identificacao",
};

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatPercent(value, total) {
  if (!total) {
    return "0% do total";
  }

  return `${Number((value / total) * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}% do total`;
}

function getArticleStatus(article) {
  if (article.reviewOutcome === "included") {
    return "included";
  }
  if (["excluded_screening", "excluded_eligibility", "full_text_unavailable", "duplicate_removed"].includes(article.reviewOutcome)) {
    return "excluded";
  }
  if (article.currentPhase === "eligibility") {
    return "eligibility";
  }
  if (article.currentPhase === "screening") {
    return "screening";
  }
  return "identification";
}

function getStudyTypeLabel(value) {
  return STUDY_TYPE_OPTIONS.find((option) => option.value === value)?.label || "Nao classificado";
}

function FlowMetric({ icon: Icon, label, value, description, tone = "violet" }) {
  const toneClass = {
    violet: "bg-[#f0edff] text-[#6259ff]",
    green: "bg-[#eaf8f0] text-[#2fa060]",
    orange: "bg-[#fff5e3] text-[#ff9f1c]",
    red: "bg-[#ffecef] text-[#d94343]",
    neutral: "bg-[#edf1f7] text-[#667391]",
  }[tone];

  return (
    <div className="flex min-w-[180px] flex-1 items-center gap-4 rounded-lg border border-[#edf0f7] bg-white p-4">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", toneClass)}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs font-medium text-[#667391]">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-[#111936]">{formatNumber(value)}</p>
        <p className="mt-1 text-xs text-[#667391]">{description}</p>
      </div>
    </div>
  );
}

function SelectionFlow({ summary, onViewFlow }) {
  const identified = summary?.totalRecords || 0;
  const screening = summary?.screening?.total || 0;
  const eligible = summary?.eligibility?.total || 0;
  const excluded =
    (summary?.duplicatesRemoved || 0) +
    (summary?.screening?.excluded || 0) +
    (summary?.eligibility?.excluded || 0);
  const included = summary?.included || 0;

  const metrics = [
    { icon: FileTextIcon, label: "Identificados", value: identified, tone: "violet" },
    { icon: CheckCircle2Icon, label: "Triagem", value: screening, tone: "green" },
    { icon: BookmarkIcon, label: "Elegiveis", value: eligible, tone: "orange" },
    { icon: XCircleIcon, label: "Excluidos", value: excluded, tone: "red" },
    { icon: StarIcon, label: "Incluidos", value: included, tone: "neutral" },
  ];

  return (
    <section className="rounded-lg border border-[#edf0f7] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[#111936]">Fluxo de selecao (PRISMA)</h2>
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#a4adc2] text-[10px] text-[#667391]">i</span>
        </div>
        <Button variant="outline" size="sm" className="h-9 rounded-lg border-[#dfe4ef] bg-white" onClick={onViewFlow}>
          Ver fluxo completo
        </Button>
      </div>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        {metrics.map((metric, index) => (
          <div key={metric.label} className="flex flex-1 items-center gap-3">
            <FlowMetric
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              description={formatPercent(metric.value, identified)}
              tone={metric.tone}
            />
            {index < metrics.length - 1 ? (
              <ArrowRightIcon className="hidden h-5 w-5 shrink-0 text-[#667391] xl:block" />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProjectArticlesLibrary({ project, onNavigate, onViewFlow }) {
  const [articles, setArticles] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showNewArticleModal, setShowNewArticleModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [articleResponse, summaryResponse] = await Promise.all([
        articleService.getArticlesByProject(project.id, { limit: 1000 }),
        articleService.getSelectionSummary(project.id),
      ]);
      setArticles(articleResponse.articles || []);
      setSummary(summaryResponse);
    } catch (error) {
      toast.error(`Erro ao carregar artigos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredArticles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return articles.filter((article) => {
      const articleStatus = getArticleStatus(article);
      const matchesSearch = !normalizedSearch || `${article.title} ${article.authors} ${article.journal} ${article.sourceName}`
        .toLowerCase()
        .includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || articleStatus === statusFilter;
      const matchesType = typeFilter === "all" || article.studyType === typeFilter;
      const matchesSource = sourceFilter === "all" || article.sourceCategory === sourceFilter;
      return matchesSearch && matchesStatus && matchesType && matchesSource;
    });
  }, [articles, searchTerm, sourceFilter, statusFilter, typeFilter]);

  async function handleExport() {
    try {
      await articleService.exportSelectionReport(project.id, "csv");
      toast.success("Exportacao iniciada.");
    } catch (error) {
      toast.error(`Erro ao exportar: ${error.message}`);
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
    setSourceFilter("all");
  }

  return (
    <div className="space-y-5">
      <SelectionFlow summary={summary} onViewFlow={onViewFlow} />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-wrap gap-3">
          <div className="relative min-w-[260px] flex-1 max-w-[360px]">
            <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78839d]" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar artigos..."
              className="h-10 rounded-lg border-[#dfe4ef] bg-white pl-11 text-sm shadow-none"
            />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-[#dfe4ef] bg-white px-4 text-sm text-[#253252]">
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-10 rounded-lg border border-[#dfe4ef] bg-white px-4 text-sm text-[#253252]">
            <option value="all">Todos os tipos</option>
            {STUDY_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="h-10 rounded-lg border border-[#dfe4ef] bg-white px-4 text-sm text-[#253252]">
            <option value="all">Todas as fontes</option>
            {SOURCE_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <Button variant="outline" className="h-10 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={clearFilters}>
            <FilterIcon className="h-4 w-4" />
            Filtros
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={() => setShowImportModal(true)}>
            <DownloadIcon className="h-4 w-4" />
            Importar artigos
          </Button>
          <Button className="h-10 gap-2 rounded-lg bg-[#6259ff] px-4 text-white hover:bg-[#5148ee]" onClick={() => setShowNewArticleModal(true)}>
            <PlusIcon className="h-4 w-4" />
            Adicionar artigos
          </Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-[#edf0f7] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0f7] px-5 py-4">
          <p className="text-sm font-semibold text-[#111936]">
            {formatNumber(filteredArticles.length)} artigos
          </p>
          <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={handleExport}>
            <DownloadIcon className="h-4 w-4" />
            Exportar
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full table-fixed">
            <thead>
              <tr className="border-b border-[#edf0f7] text-left text-xs font-semibold text-[#667391]">
                <th className="w-[44px] px-5 py-3"><input type="checkbox" /></th>
                <th className="w-[280px] px-3 py-3">Titulo</th>
                <th className="w-[220px] px-3 py-3">Autores</th>
                <th className="w-[80px] px-3 py-3">Ano</th>
                <th className="w-[190px] px-3 py-3">Fonte</th>
                <th className="w-[170px] px-3 py-3">Tipo de estudo</th>
                <th className="w-[140px] px-3 py-3">Status</th>
                <th className="w-[80px] px-3 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-[#667391]">Carregando artigos...</td>
                </tr>
              ) : filteredArticles.length ? filteredArticles.map((article) => {
                const status = getArticleStatus(article);
                return (
                  <tr key={article.id} className="border-b border-[#edf0f7] text-sm text-[#253252] last:border-b-0 hover:bg-[#fbfcff]">
                    <td className="px-5 py-4"><input type="checkbox" /></td>
                    <td className="px-3 py-4">
                      <div className="flex items-start gap-3">
                        <StarIcon className="mt-1 h-4 w-4 shrink-0 text-[#b7c0d4]" />
                        <button
                          type="button"
                          onClick={() => onNavigate(`/projetos/${project.id}/artigos/${article.id}`)}
                          className="line-clamp-2 text-left font-semibold text-[#111936] hover:text-[#6259ff]"
                        >
                          {article.title}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-[#667391]"><span className="line-clamp-2">{article.authors}</span></td>
                    <td className="px-3 py-4 text-[#667391]">{article.year}</td>
                    <td className="px-3 py-4 text-[#667391]"><span className="line-clamp-2">{article.journal || article.sourceName}</span></td>
                    <td className="px-3 py-4">
                      <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-semibold text-[#4d68ff]">
                        {getStudyTypeLabel(article.studyType)}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", STATUS_BADGE[status])}>
                        {status === "excluded" ? <XCircleIcon className="h-3.5 w-3.5" /> : <CheckCircle2Icon className="h-3.5 w-3.5" />}
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onNavigate(`/projetos/${project.id}/artigos/${article.id}`)}>
                            Abrir artigo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-[#667391]">Nenhum artigo encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#edf0f7] px-5 py-4 text-sm text-[#667391]">
          <span>Mostrando 1 a {filteredArticles.length} de {articles.length} artigos</span>
          <span className="rounded-lg bg-[#f0edff] px-3 py-1 font-semibold text-[#6259ff]">1</span>
        </div>
      </section>

      <ImportBibTeXModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={loadData}
        projectId={project.id}
      />
      <NewArticleModal
        isOpen={showNewArticleModal}
        onClose={() => setShowNewArticleModal(false)}
        onSuccess={loadData}
        projectId={project.id}
      />
    </div>
  );
}

export default ProjectArticlesLibrary;
