import { lazy, Suspense, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, LoaderIcon, PanelRightCloseIcon, PanelRightOpenIcon, SearchIcon, SparklesIcon, TrashIcon, UploadIcon } from "lucide-react";
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

const REVIEW_STAGE_CONFIG = {
  identification: {
    title: "Identificação",
    description: "Revise os metadados importados antes de enviar o registro para triagem.",
    listTitle: "Registros identificados",
  },
  screening: {
    title: "Triagem",
    description: "Avalie título, resumo e critérios para registrar a decisão de triagem.",
    listTitle: "Estudos em triagem",
  },
  eligibility: {
    title: "Elegibilidade",
    description: "Revise o texto completo e registre a decisão de elegibilidade.",
    listTitle: "Estudos em elegibilidade",
  },
  included: {
    title: "Extração de dados",
    description: "Preencha as informações do estudo com base no planejamento definido.",
    listTitle: "Estudos incluídos",
  },
};

function getReviewStatus(article, activeFlow, currentArticleId, extractionSchema) {
  if (activeFlow === "included") {
    return getExtractionStatus(article, currentArticleId, extractionSchema);
  }

  if (activeFlow === "screening") {
    if (article.screeningDecision === "included" || article.currentPhase === "eligibility") {
      return { label: "Incluir", className: "bg-[#e8f8ef] text-[#258c55]" };
    }
    if (article.screeningDecision === "excluded" || article.aiSuggestedStatus === "excluido") {
      return { label: "Excluir", className: "bg-[#ffecef] text-[#d94343]" };
    }
    return { label: "Pendente", className: "bg-[#f2f4f8] text-[#667391]" };
  }

  if (activeFlow === "eligibility") {
    if (article.reviewOutcome === "included") {
      return { label: "Incluir", className: "bg-[#e8f8ef] text-[#258c55]" };
    }
    if (article.reviewOutcome?.includes("excluded") || article.reviewOutcome === "full_text_unavailable") {
      return { label: "Excluir", className: "bg-[#ffecef] text-[#d94343]" };
    }
    return { label: "Aguardando", className: "bg-[#f2f4f8] text-[#667391]" };
  }

  return { label: "Identificado", className: "bg-[#eef1ff] text-[#6259ff]" };
}

const ArticleWorkspacePanel = lazy(() =>
  import("@features/articles/components/ArticleWorkspacePanel")
);
const PdfViewer = lazy(() => import("@features/articles/components/PdfViewer"));
function PrismaArticleReviewWorkspace({
  articleState,
  chatSession,
  activeFlow,
  article,
  articleId,
  articleList,
  articleListTotal,
  articleListLoading,
  backUrl,
  onRequestDelete,
  isSavingEvidence,
  navigate,
  onOpenEligibility,
  onOpenScreening,
  onOpenUpload,
  onSaveEvidence,
  onSaveNotes,
  pdfData,
  project,
  projectId,
  rightTab,
  setRightTab,
  suggestedDecision,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [supportCollapsed, setSupportCollapsed] = useState(false);
  const extractionSchema = project?.dataExtractionSchema || [];
  const review = collaborativeReview(article);
  const stage = REVIEW_STAGE_CONFIG[activeFlow] || REVIEW_STAGE_CONFIG.screening;
  const listSource = articleList?.length ? articleList : [article].filter(Boolean);
  const filteredArticles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return listSource.filter((item) => {
      if (!normalizedSearch) {
        return true;
      }
      return `${item.title} ${item.authors} ${item.journal}`.toLowerCase().includes(normalizedSearch);
    });
  }, [listSource, searchTerm]);
  const totalCount = articleListTotal ?? listSource.length;
  const currentIndex = Math.max(
    0,
    listSource.findIndex((item) => String(item.id) === String(articleId))
  );
  const previousArticle = listSource[currentIndex - 1];
  const nextArticle = listSource[currentIndex + 1];
  const progress = totalCount ? Math.round(((currentIndex + 1) / totalCount) * 100) : 0;

  function openArticle(targetArticle) {
    if (!targetArticle) {
      return;
    }
    const params = new URLSearchParams({ flow: activeFlow });
    if (activeFlow === "included") {
      params.set("workspace", "extracao");
    } else if (rightTab === "chat" || rightTab === "notas") {
      params.set("workspace", rightTab);
    }
    navigate(`/projetos/${projectId}/artigos/${targetArticle.id}?${params.toString()}`);
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
          Voltar para revisão
        </Button>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#111936]">{stage.listTitle}</h2>
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
              const status = getReviewStatus(item, activeFlow, articleId, extractionSchema);
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
            <p className="py-8 text-center text-xs text-[#667391]">Nenhum estudo encontrado.</p>
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
            { label: stage.title },
          ]}
        />

        <main className="flex min-h-0 flex-1 flex-col px-5 pb-0 pt-5 md:px-10">
          <div className="mb-5 flex shrink-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold leading-tight tracking-normal text-[#0f1734]">{stage.title}</h1>
              </div>
              <p className="mt-2 text-sm text-[#56627f]">{stage.description}</p>
            </div>

            <div inert={articleState.pending || undefined} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-[260px]">
                <div className="mb-2 flex items-center justify-between gap-4 text-xs font-semibold text-[#182344]">
                  <span>Posição na etapa</span>
                  <span>{formatNumber(currentIndex + 1)} de {formatNumber(totalCount)} estudos&nbsp;&nbsp; {progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e7eaf3]">
                  <div className="h-full rounded-full bg-[#6259ff]" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {(article.currentPhase === "identification" || article.currentPhase === "screening") ? (
                <Button
                  className="h-11 gap-2 rounded-lg bg-[#6259ff] px-5 text-white hover:bg-[#5148ee]"
                  onClick={() => onOpenScreening(article.aiSuggestedStatus ? suggestedDecision : "included")}
                  disabled={!review.canDecide}
                  title={review.explanation}
                >
                  <CheckCircle2Icon className="h-4 w-4" />
                  Registrar triagem
                </Button>
              ) : null}

              {article.currentPhase === "eligibility" && !article.hasPdf ? (
                <Button variant="outline" disabled={!review.canWrite} title={review.writeExplanation} className="h-11 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onOpenUpload}>
                  <UploadIcon className="h-4 w-4" />
                  Enviar PDF
                </Button>
              ) : null}

              {article.currentPhase === "eligibility" ? (
                <Button
                  className="h-11 gap-2 rounded-lg bg-[#6259ff] px-5 text-white hover:bg-[#5148ee]"
                  onClick={() => onOpenEligibility("included")}
                  disabled={!review.canDecide}
                  title={review.explanation}
                >
                  <CheckCircle2Icon className="h-4 w-4" />
                  Registrar elegibilidade
                </Button>
              ) : null}

              {article.reviewOutcome === "included" ? (
                <Button
                  className="h-11 gap-2 rounded-lg bg-[#6259ff] px-5 text-white hover:bg-[#5148ee]"
                  onClick={() => navigate(`/projetos/${projectId}/artigos/${articleId}?flow=included&workspace=extracao`)}
                >
                  <SparklesIcon className="h-4 w-4" />
                  Ir para extração
                </Button>
              ) : null}

              <Button variant="outline" disabled={article.canManageArticle === false} className="h-11 gap-2 rounded-lg border-[#dfe4ef] bg-white" onClick={onRequestDelete}>
                <TrashIcon className="h-4 w-4 text-red-500" />
                Remover
              </Button>
            </div>
          </div>

          {!articleState.pending ? <ReviewAssignmentStatus article={article} /> : null}
          <div className={cn(
            "grid min-h-0 flex-1 overflow-y-auto rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-white xl:overflow-hidden",
            supportCollapsed ? "xl:grid-cols-[minmax(0,1fr)_48px]" : "xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]"
          )}>
            {articleState.pending ? <ArticleTransitionState state={articleState} /> : <>
            <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden p-5 xl:min-h-0">
              <div className="mb-4 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="line-clamp-2 text-lg font-semibold leading-7 text-[#111936]">{article.title}</h2>
                  <p className="mt-2 line-clamp-1 text-sm text-[#56627f]">
                    {article.authors} ({article.year}) - {article.journal}
                  </p>
                </div>
              </div>

              <div className="min-h-[320px] flex-1 overflow-hidden xl:min-h-0">
                <Suspense fallback={<ArticlePanelLoader />}>
                  <PdfViewer article={article} articleId={articleId} pdfData={pdfData} projectId={projectId} />
                </Suspense>
              </div>
            </section>

            <section className={cn("flex min-w-0 flex-col overflow-hidden border-t border-[var(--syn-border)] xl:min-h-0 xl:border-l xl:border-t-0", supportCollapsed ? "min-h-0" : "min-h-[480px]")}>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--syn-border)] p-2">
                {!supportCollapsed ? <h2 className="pl-2 text-xs font-medium text-[var(--syn-text-secondary)]">Ferramentas do estudo</h2> : null}
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  aria-label={supportCollapsed ? "Expandir painel de apoio" : "Recolher painel de apoio"}
                  title={supportCollapsed ? "Expandir painel de apoio" : "Recolher painel de apoio"}
                  aria-expanded={!supportCollapsed} aria-controls="article-support-panel"
                  onClick={() => setSupportCollapsed((value) => !value)}>
                  {supportCollapsed ? <PanelRightOpenIcon className="h-4 w-4" /> : <PanelRightCloseIcon className="h-4 w-4" />}
                </Button>
              </div>
              <div id="article-support-panel" hidden={supportCollapsed} className="min-h-0 flex-1">
                <Suspense fallback={<ArticlePanelLoader />}>
                <ArticleWorkspacePanel
                  key={article.id}
                  chatSession={chatSession}
                  activeFlow={activeFlow}
                  article={article}
                  onSaveEvidence={onSaveEvidence}
                  onSaveNotes={onSaveNotes}
                  pdfData={pdfData}
                  project={project}
                  rightTab={rightTab}
                  setRightTab={setRightTab}
                  isSavingEvidence={isSavingEvidence}
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

export default PrismaArticleReviewWorkspace;
