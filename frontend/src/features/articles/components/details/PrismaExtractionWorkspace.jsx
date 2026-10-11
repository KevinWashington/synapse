import { lazy, Suspense, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, ChevronDownIcon, LoaderIcon, SaveIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AppHeader, LoadingState } from "@/components/layout";
import { cn } from "@/lib/utils";
import { collaborativeReview } from "@features/articles/utils/collaborativeReview";
import { getExtractionProgress } from "@features/articles/utils/reviewWorkspace";
import ReviewAssignmentStatus from "@features/articles/components/ReviewAssignmentStatus";
const FOCUS_WORKSPACE_THEME = {
  "--syn-sidebar-accent": "#6259ff",
  "--syn-border": "#edf0f7",
  "--syn-text-primary": "#111936",
  "--syn-text-secondary": "#667391",
  "--syn-bg-secondary": "#fbfcff",
};

function ArticlePanelLoader() {
  return <LoadingState message="Carregando conteúdo..." />;
}

function ArticleTransitionState({ state }) {
  return <div className="col-span-full flex min-h-[320px] flex-1 items-center justify-center p-5">
    {state.error ? <div role="alert" className="space-y-3 text-center">
      <p className="text-sm text-[var(--syn-text-secondary)]">{state.error}</p>
      <Button variant="outline" onClick={state.retry}>Tentar novamente</Button>
    </div> : <div role="status" className="flex items-center gap-2 text-sm text-[var(--syn-text-secondary)]">
      <LoaderIcon className="h-5 w-5 animate-spin" />Carregando artigo...
    </div>}
  </div>;
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatPercent(value, total) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function getExtractionStatus(article, currentArticleId, schema) {
  if (String(article.id) === String(currentArticleId)) {
    return { label: "Em extração", className: "bg-[#eef1ff] text-[#6259ff]" };
  }

  if (article.extractionCompletedAt) {
    return { label: "Extraido", className: "bg-[#e8f8ef] text-[#258c55]" };
  }

  if (getExtractionProgress(article, schema).state !== "not_started") {
    return { label: "Rascunho", className: "bg-[#fff6e5] text-[#d48700]" };
  }

  return { label: "Pendente", className: "bg-[#f2f4f8] text-[#667391]" };
}

const ArticleEvidenceEditor = lazy(() =>
  import("@features/articles/components/ArticleEvidenceEditor")
);
const PdfViewer = lazy(() => import("@features/articles/components/PdfViewer"));
const NotesEditor = lazy(() => import("@features/articles/components/NotesEditor"));
function PrismaExtractionWorkspace({
  articleState,
  article,
  articleId,
  articleList,
  articleListTotal,
  articleListLoading,
  backUrl,
  isSavingEvidence,
  navigate,
  onSaveEvidence,
  onSaveNotes,
  pdfData,
  project,
  projectId,
  selectionSummary,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [leftTab, setLeftTab] = useState("pdf");
  const review = collaborativeReview(article);
  const extractionSchema = project?.dataExtractionSchema || [];
  const filteredArticles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return (articleList || []).filter((item) => {
      if (!normalizedSearch) {
        return true;
      }
      return `${item.title} ${item.authors} ${item.journal}`.toLowerCase().includes(normalizedSearch);
    });
  }, [articleList, searchTerm]);
  const totalCount = articleListTotal ?? articleList?.length ?? 0;
  const completedCount = selectionSummary
    ? Math.max((selectionSummary.included || 0) - (selectionSummary.pendingExtraction || 0), 0)
    : (articleList || []).filter((item) => item.extractionCompletedAt).length;
  const progress = formatPercent(completedCount, totalCount);
  const currentIndex = Math.max(
    0,
    (articleList || []).findIndex((item) => String(item.id) === String(articleId))
  );
  const previousArticle = articleList?.[currentIndex - 1];
  const nextArticle = articleList?.[currentIndex + 1];

  function openArticle(targetArticle) {
    if (!targetArticle) {
      return;
    }
    navigate(`/projetos/${projectId}/artigos/${targetArticle.id}?flow=included&workspace=extracao`);
  }

  return (
    <div style={FOCUS_WORKSPACE_THEME} className="grid h-screen overflow-hidden bg-[#fbfcff] text-[#101936] xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col border-r border-[#edf0f7] bg-[#fbfcff] px-5 pb-4 xl:flex">
        <Link
          to="/"
          className="flex h-[72px] shrink-0 items-center text-xl font-semibold tracking-normal text-[#111936]"
        >
          Synapse
        </Link>

        <Button
          variant="ghost"
          className="mb-8 mt-4 h-9 justify-start gap-2 px-0 text-xs font-semibold text-[#6259ff] hover:bg-transparent hover:text-[#5148ee]"
          onClick={() => navigate(backUrl)}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para inclusão
        </Button>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#111936]">Estudos incluídos</h2>
          <span className="rounded-full bg-[#eef1f7] px-2.5 py-1 text-xs font-semibold text-[#111936]">
            {formatNumber(totalCount)}
          </span>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a4adc2]" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-10 rounded-lg border-[#dfe4ef] bg-white pl-9 text-sm shadow-none"
            placeholder="Buscar estudos"
          />
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {articleListLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#667391]">
              <LoaderIcon className="h-4 w-4 animate-spin" />
              Carregando estudos...
            </div>
          ) : filteredArticles.length ? (
            filteredArticles.map((item) => {
              const active = String(item.id) === String(articleId);
              const status = getExtractionStatus(item, articleId, extractionSchema);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openArticle(item)}
                  className={cn(
                    "w-full cursor-pointer rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40",
                    active
                      ? "border-[#bdb7ff] bg-[#fbfaff] shadow-[0_12px_28px_rgba(98,89,255,0.08)]"
                      : "border-[#edf0f7] bg-white hover:border-[#cfd6e7]"
                  )}
                >
                  <p className="line-clamp-3 text-xs font-semibold leading-5 text-[#111936]">{item.title}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#56627f]">{item.authors}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-[#56627f]">{item.year}</span>
                    <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", status.className)}>
                      {status.label}
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <p className="py-8 text-center text-xs text-[#667391]">Nenhum estudo incluído encontrado.</p>
          )}
        </div>

        <div className="mt-4 flex shrink-0 items-center border-t border-[#edf0f7] pt-3 text-xs text-[#667391]">
          <span>{formatNumber(currentIndex + 1)} de {formatNumber(totalCount)} selecionado</span>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        <AppHeader
          compact
          breadcrumbs={[
            { label: "Projetos", href: "/projetos" },
            { label: project?.title || "Projeto", href: `/projetos/${projectId}` },
            { label: "Extração de dados" },
          ]}
        />

        <main className="flex min-h-0 flex-1 flex-col px-5 pb-0 pt-5 md:px-10">
          <div className="mb-5 flex shrink-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold leading-tight tracking-normal text-[#0f1734]">Extração de dados</h1>
                <span className="rounded-full bg-[#eef1ff] px-3 py-1 text-xs font-semibold text-[#6259ff]">
                  {project?.status === "em-progresso" ? "Em andamento" : project?.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#56627f]">
                Preencha as informações do estudo com base no planejamento definido.
              </p>
            </div>

            <div inert={articleState.pending || undefined} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-[300px]">
                <div className="mb-2 flex items-center justify-between gap-4 text-xs font-semibold text-[#182344]">
                  <span>Progresso geral</span>
                  <span>{formatNumber(completedCount)} de {formatNumber(totalCount)} estudos&nbsp;&nbsp; {progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e7eaf3]">
                  <div className="h-full rounded-full bg-[#6259ff]" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <Button
                type="submit"
                form="article-extraction-form"
                value="draft"
                variant="outline"
                className="h-11 gap-2 rounded-lg border-[#dfe4ef] bg-white px-6 text-[#182344]"
                disabled={isSavingEvidence || !review.canWrite}
              >
                <SaveIcon className="h-4 w-4" />
                Salvar rascunho
              </Button>
              <Button
                type="submit"
                form="article-extraction-form"
                value="complete"
                className="h-11 gap-2 rounded-lg bg-[#6259ff] px-6 text-white shadow-[0_12px_24px_rgba(98,89,255,0.18)] hover:bg-[#5148ee]"
                disabled={isSavingEvidence || !review.canWrite}
              >
                <CheckCircle2Icon className="h-4 w-4" />
                Marcar como concluído
                <ChevronDownIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!articleState.pending ? <ReviewAssignmentStatus article={article} /> : null}
          <div className="grid min-h-0 flex-1 overflow-y-auto rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-white xl:grid-cols-[minmax(0,1fr)_minmax(400px,500px)] xl:overflow-hidden">
            {articleState.pending ? <ArticleTransitionState state={articleState} /> : <>
            <section className="flex min-h-[420px] flex-col overflow-hidden p-5 xl:min-h-0">
              <div className="mb-4 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="line-clamp-2 text-lg font-semibold leading-7 text-[#111936]">{article.title}</h2>
                  <p className="mt-2 line-clamp-1 text-sm text-[#56627f]">
                    {article.authors} ({article.year}) - {article.journal}
                  </p>
                </div>
              </div>

              <div className="mb-4 flex shrink-0 gap-6 border-b border-[#edf0f7] text-sm font-semibold">
                {[{ key: "pdf", label: "PDF" }, { key: "notas", label: "Notas" }].map((tab) => {
                  const active = leftTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setLeftTab(tab.key)}
                      className={cn(
                        "relative cursor-pointer pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]/40",
                        active
                          ? "text-[#6259ff] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[#6259ff]"
                          : "text-[#56627f] hover:text-[#182344]"
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="min-h-[320px] flex-1 overflow-hidden xl:min-h-0">
                <Suspense fallback={<ArticlePanelLoader />}>
                  {leftTab === "pdf" ? (
                    <PdfViewer article={article} articleId={articleId} pdfData={pdfData} projectId={projectId} />
                  ) : (
                    <NotesEditor key={article.id} valorInicial={article?.notas} onSalvar={onSaveNotes} readOnly={!review.canWrite} />
                  )}
                </Suspense>
              </div>
            </section>

            <section className="flex min-h-[480px] flex-col overflow-hidden border-t border-[var(--syn-border)] xl:min-h-0 xl:border-l xl:border-t-0">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf0f7] px-4 py-4">
                <div>
                  <h2 className="text-base font-semibold text-[#111936]">Formulário de extração</h2>
                  <p className="mt-1 text-xs text-[#667391]">Baseado no planejamento da revisão</p>
                </div>
                <Button variant="outline" size="sm" className="h-9 rounded-lg border-[#dfe4ef] bg-white" onClick={() => navigate(`/projetos/${projectId}?tab=planejamento`)}>
                  Ver planejamento
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <Suspense fallback={<ArticlePanelLoader />}>
                  <ArticleEvidenceEditor
                    key={article.id}
                    article={article}
                    className="h-full"
                    formId="article-extraction-form"
                    isSaving={isSavingEvidence}
                    onSave={onSaveEvidence}
                    project={project}
                    showFooterActions={false}
                    readOnly={!review.canWrite}
                    variant="workspace"
                  />
                </Suspense>
              </div>
            </section>
            </>}
          </div>

          <nav aria-label="Navegação entre estudos" className="mt-3 grid min-h-16 shrink-0 grid-cols-2 items-center gap-4 border-t border-[#edf0f7] py-2 text-xs text-[#56627f]">
            <Button variant="ghost" className="h-12 min-w-0 justify-start gap-3 text-[#56627f]" onClick={() => openArticle(previousArticle)} disabled={!previousArticle}>
              <ArrowLeftIcon className="h-4 w-4" />
              <span className="min-w-0 text-left">
                <span className="block font-semibold">Anterior</span>
                {previousArticle ? <span className="block max-w-[260px] truncate">{previousArticle.title}</span> : null}
              </span>
            </Button>
            <Button variant="ghost" className="h-12 min-w-0 justify-end gap-3 text-[#6259ff]" onClick={() => openArticle(nextArticle)} disabled={!nextArticle}>
              <span className="min-w-0 text-right">
                <span className="block font-semibold">Próximo</span>
                {nextArticle ? <span className="block max-w-[260px] truncate">{nextArticle.title}</span> : null}
              </span>
              <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </nav>
        </main>
      </div>
    </div>
  );
}

export default PrismaExtractionWorkspace;
