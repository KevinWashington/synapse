import { useMemo, useState } from "react";
import {
  CheckIcon,
  CopyCheckIcon,
  DownloadIcon,
  EyeIcon,
  FileIcon,
  LoaderIcon,
  PlusIcon,
  SparklesIcon,
  UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { articleService } from "@features/articles/services/articleService";
import { useProjectArticles } from "@features/articles/hooks/useProjectArticles";
import { FLOW_TABS, formatSourceLabel, OUTCOME_LABELS, PHASE_LABELS } from "@features/articles/utils/selectionFlow";
import { toast } from "@/lib/toast";
import EligibilityDecisionDialog from "./EligibilityDecisionDialog";
import ImportBibTeXModal from "./ImportBibTeXModal";
import NewArticleModal from "./NewArticleModal";
import RQSynthesisPanel from "./RQSynthesisPanel";
import ScreeningDecisionDialog from "./ScreeningDecisionDialog";
import UploadPDFModal from "./UploadPDFModal";

function FunnelCard({ value, label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4 text-left shadow-[var(--syn-shadow-card)] transition-colors hover:bg-[var(--syn-bg-secondary)]"
    >
      <p className="text-xs uppercase tracking-wide text-[var(--syn-text-secondary)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--syn-text-primary)]">{value}</p>
      <p className="mt-2 text-xs text-[var(--syn-text-secondary)]">{description}</p>
    </button>
  );
}

function PhaseTable({
  articles,
  emptyLabel,
  actions,
  leadingCell,
  leadingHeader,
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--syn-radius-card)] border border-[var(--syn-border)]">
      <Table className="min-w-[880px]">
        <TableHeader>
          <TableRow>
            {leadingCell ? <TableHead className="w-[48px]">{leadingHeader || ""}</TableHead> : null}
            <TableHead>Titulo</TableHead>
            <TableHead>Autores</TableHead>
            <TableHead>Ano</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Fase</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="w-[220px]">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.length ? (
            articles.map((article) => (
              <TableRow key={article.id}>
                {leadingCell ? <TableCell>{leadingCell(article)}</TableCell> : null}
                <TableCell className="max-w-[320px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--syn-text-primary)]" title={article.title}>
                      {article.title}
                    </p>
                    {article.abstract ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--syn-text-secondary)]" title={article.abstract}>
                        {article.abstract}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="max-w-[220px] text-xs text-[var(--syn-text-secondary)]">
                  <span className="line-clamp-2" title={article.authors}>
                    {article.authors}
                  </span>
                </TableCell>
                <TableCell>{article.year}</TableCell>
                <TableCell className="text-xs text-[var(--syn-text-secondary)]">
                  {formatSourceLabel(article)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={article.currentPhase} label={PHASE_LABELS[article.currentPhase] || article.currentPhase} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={article.reviewOutcome} label={OUTCOME_LABELS[article.reviewOutcome] || article.reviewOutcome} />
                </TableCell>
                <TableCell>{actions(article)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={leadingCell ? 8 : 7} className="py-8 text-center text-sm text-[var(--syn-text-secondary)]">
                {emptyLabel}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function DuplicateReviewPanel({
  duplicateCandidates,
  isLoadingDuplicates,
  onApply,
  onAnalyze,
  onSelectCanonical,
  selectedDuplicateMap,
}) {
  return (
    <div className="space-y-3 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--syn-text-primary)]">Revisao de duplicatas</p>
          <p className="text-xs text-[var(--syn-text-secondary)]">
            Detecta candidatos automaticamente e pede confirmacao humana antes de consolidar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAnalyze} disabled={isLoadingDuplicates} className="gap-2">
            {isLoadingDuplicates ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : <SparklesIcon className="h-3.5 w-3.5" />}
            Analisar duplicatas
          </Button>
          <Button size="sm" onClick={onApply} className="gap-2" disabled={!duplicateCandidates.length}>
            <CopyCheckIcon className="h-3.5 w-3.5" />
            Aplicar revisao
          </Button>
        </div>
      </div>

      {duplicateCandidates.length ? (
        <div className="space-y-3">
          {duplicateCandidates.map((group) => (
            <div key={group.groupKey} className="rounded-md border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--syn-text-primary)]">{group.reasonText}</p>
                  <p className="text-xs text-[var(--syn-text-secondary)]">{group.groupKey}</p>
                </div>
                <span className="text-xs text-[var(--syn-text-secondary)]">{group.candidateIds.length} registros</span>
              </div>

              <div className="space-y-2">
                {group.articles.map((article) => {
                  const selected = selectedDuplicateMap[group.groupKey] === article.id;
                  return (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => onSelectCanonical(group.groupKey, article.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left ${
                        selected
                          ? "border-[var(--syn-sidebar-accent)] bg-[var(--syn-bg-primary)]"
                          : "border-[var(--syn-border)] bg-[var(--syn-bg-primary)]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--syn-text-primary)]" title={article.title}>
                          {article.title}
                        </p>
                        <p className="text-xs text-[var(--syn-text-secondary)]">
                          {article.year} · {article.sourceName}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-[var(--syn-text-secondary)]">
                        {selected ? "Canonico" : "Selecionar"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--syn-text-secondary)]">Nenhum grupo pendente de revisao.</p>
      )}
    </div>
  );
}

function ReportPanel({ onExport, report, isLoadingReport }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--syn-text-primary)]">Relatorio operacional PRISMA</p>
          <p className="text-xs text-[var(--syn-text-secondary)]">Contagens por fase, origem e motivos de exclusao.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => onExport("json")}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => onExport("csv")}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {isLoadingReport ? (
        <div className="flex items-center gap-2 rounded-md border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-4 py-3 text-sm text-[var(--syn-text-secondary)]">
          <LoaderIcon className="h-4 w-4 animate-spin" />
          Carregando relatorio...
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <FunnelCard value={report.counts.identified} label="Identified" description="Total de registros identificados." />
            <FunnelCard value={report.counts.duplicatesRemoved} label="Duplicatas" description="Duplicatas removidas apos revisao." />
            <FunnelCard value={report.counts.excludedScreening} label="Excluidos no Screening" description="Eliminados na leitura rapida." />
            <FunnelCard value={report.counts.included} label="Included" description="Corpus final para sintese." />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4">
              <p className="text-sm font-semibold text-[var(--syn-text-primary)]">Por origem</p>
              <div className="mt-3 space-y-2">
                {report.bySource.map((item) => (
                  <div key={`${item.sourceCategory}-${item.sourceName}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--syn-text-primary)]">{item.sourceName}</span>
                    <span className="text-[var(--syn-text-secondary)]">{item.total}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4">
              <p className="text-sm font-semibold text-[var(--syn-text-primary)]">Motivos de exclusao</p>
              <div className="mt-3 space-y-3">
                {Object.entries(report.exclusionReasons || {}).map(([phase, reasons]) => (
                  <div key={phase}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--syn-text-secondary)]">{phase}</p>
                    <div className="mt-2 space-y-2">
                      {reasons.length ? (
                        reasons.map((item) => (
                          <div key={`${phase}-${item.reason}`} className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-[var(--syn-text-primary)]">{item.reason}</span>
                            <span className="text-[var(--syn-text-secondary)]">{item.count}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[var(--syn-text-secondary)]">Sem exclusoes registradas.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ProjectArticles({ project, onNavigate, onGraphNeedsRefresh }) {
  const [showNewArticleModal, setShowNewArticleModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUploadPdfModal, setShowUploadPdfModal] = useState(false);
  const [pdfTarget, setPdfTarget] = useState(null);

  const {
    activeFlowTab,
    applyDuplicateReview,
    articles,
    duplicateCandidates,
    eligibilityArticle,
    handleDeleteArticle,
    identificationArticles,
    isBatchEvaluating,
    isLoadingArticles,
    isLoadingDuplicates,
    isLoadingReport,
    isLoadingRQSynthesis,
    isLoadingSummary,
    isSavingDecision,
    loadRQSynthesis,
    promoteSelectedToScreening,
    report,
    refreshAll,
    rqSynthesisData,
    runBatchEvaluate,
    runDedupAnalysis,
    screeningArticle,
    searchTerm,
    selectedDuplicateMap,
    selectedIdentificationIds,
    setActiveFlowTab,
    setEligibilityArticle,
    setScreeningArticle,
    setSearchTerm,
    setSelectedDuplicateMap,
    submitEligibilityDecision,
    submitScreeningDecision,
    summary,
    toggleIdentificationSelection,
    updateFullTextStatus,
  } = useProjectArticles(project, onGraphNeedsRefresh);

  const includedArticles = useMemo(
    () => articles.filter((article) => article.reviewOutcome === "included"),
    [articles]
  );

  async function handleExportReport(format) {
    try {
      await articleService.exportSelectionReport(project.id, format);
      toast.success(`Relatorio ${format.toUpperCase()} exportado.`);
    } catch (error) {
      toast.error(`Erro ao exportar relatorio ${format.toUpperCase()}: ${error.message}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[var(--syn-text-primary)]">Workspace de Selecao</p>
          <p className="text-sm text-[var(--syn-text-secondary)]">
            Identification, Screening, Eligibility, Included e relatorio operacional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => setShowImportModal(true)}>
            <UploadIcon className="h-3.5 w-3.5" />
            Importar BibTeX
          </Button>
          <Button size="sm" className="gap-2 text-xs" onClick={() => setShowNewArticleModal(true)}>
            <PlusIcon className="h-3.5 w-3.5" />
            Adicionar registro
          </Button>
        </div>
      </div>

      <Tabs value={activeFlowTab} onValueChange={setActiveFlowTab}>
        <TabsList className="flex w-full flex-wrap gap-2 bg-transparent p-0">
          {FLOW_TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-3 py-2 data-[state=active]:bg-[var(--syn-sidebar-accent)] data-[state=active]:text-white"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {isLoadingSummary ? (
            <div className="flex items-center gap-2 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-4 py-3 text-sm text-[var(--syn-text-secondary)]">
              <LoaderIcon className="h-4 w-4 animate-spin" />
              Carregando resumo do funil...
            </div>
          ) : null}

          {summary ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <FunnelCard
                  value={summary.identification?.active || 0}
                  label="Identification"
                  description="Registros ativos aguardando envio ao screening."
                  onClick={() => setActiveFlowTab("identification")}
                />
                <FunnelCard
                  value={summary.screening?.active || 0}
                  label="Screening"
                  description="Fila de leitura rapida por titulo e resumo."
                  onClick={() => setActiveFlowTab("screening")}
                />
                <FunnelCard
                  value={summary.eligibility?.active || 0}
                  label="Eligibility"
                  description="Artigos aguardando texto completo e checklist."
                  onClick={() => setActiveFlowTab("eligibility")}
                />
                <FunnelCard
                  value={summary.included || 0}
                  label="Included"
                  description="Corpus final para sintese, grafo e RAG."
                  onClick={() => setActiveFlowTab("included")}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4">
                  <p className="text-sm font-semibold text-[var(--syn-text-primary)]">Atalhos do fluxo</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveFlowTab("identification")}>
                      <EyeIcon className="h-3.5 w-3.5" />
                      Revisar Identification
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveFlowTab("screening")}>
                      <SparklesIcon className="h-3.5 w-3.5" />
                      Continuar Screening
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveFlowTab("eligibility")}>
                      <FileIcon className="h-3.5 w-3.5" />
                      Finalizar Eligibility
                    </Button>
                  </div>
                </div>

                <DuplicateReviewPanel
                  duplicateCandidates={duplicateCandidates}
                  isLoadingDuplicates={isLoadingDuplicates}
                  onAnalyze={runDedupAnalysis}
                  onApply={applyDuplicateReview}
                  selectedDuplicateMap={selectedDuplicateMap}
                  onSelectCanonical={(groupKey, articleId) =>
                    setSelectedDuplicateMap((current) => ({ ...current, [groupKey]: articleId }))
                  }
                />
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="identification" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por titulo, autores ou origem..."
              className="border-input bg-background h-9 w-full max-w-md rounded-md border px-3 text-sm"
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={runDedupAnalysis}>
                <SparklesIcon className="h-3.5 w-3.5" />
                Detectar duplicatas
              </Button>
              <Button size="sm" className="gap-2" onClick={promoteSelectedToScreening}>
                <CheckIcon className="h-3.5 w-3.5" />
                Enviar ao screening
              </Button>
            </div>
          </div>

          <DuplicateReviewPanel
            duplicateCandidates={duplicateCandidates}
            isLoadingDuplicates={isLoadingDuplicates}
            onAnalyze={runDedupAnalysis}
            onApply={applyDuplicateReview}
            selectedDuplicateMap={selectedDuplicateMap}
            onSelectCanonical={(groupKey, articleId) =>
              setSelectedDuplicateMap((current) => ({ ...current, [groupKey]: articleId }))
            }
          />

          <PhaseTable
            articles={identificationArticles}
            emptyLabel="Nenhum registro ativo em Identification."
            leadingHeader="Sel."
            leadingCell={(article) => (
              <input
                type="checkbox"
                checked={selectedIdentificationIds.includes(article.id)}
                onChange={() => toggleIdentificationSelection(article.id)}
              />
            )}
            actions={(article) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="h-8" onClick={() => onNavigate(`/projetos/${project.id}/artigos/${article.id}`)}>
                  Ver detalhes
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => handleDeleteArticle(article)}>
                  Remover
                </Button>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="screening" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por titulo, autores ou origem..."
              className="border-input bg-background h-9 w-full max-w-md rounded-md border px-3 text-sm"
            />
            <Button variant="outline" size="sm" className="gap-2" onClick={runBatchEvaluate} disabled={isBatchEvaluating}>
              {isBatchEvaluating ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : <SparklesIcon className="h-3.5 w-3.5" />}
              Triagem IA
            </Button>
          </div>

          <PhaseTable
            articles={articles}
            emptyLabel="Nenhum artigo aguardando screening."
            actions={(article) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8" onClick={() => setScreeningArticle(article)}>
                  Incluir / Excluir
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => onNavigate(`/projetos/${project.id}/artigos/${article.id}`)}>
                  Ver detalhes
                </Button>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="eligibility" className="space-y-4">
          <PhaseTable
            articles={articles}
            emptyLabel="Nenhum artigo em elegibilidade."
            actions={(article) => (
              <div className="flex flex-wrap gap-2">
                {!article.hasPdf ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => {
                      setPdfTarget(article);
                      setShowUploadPdfModal(true);
                    }}
                  >
                    <UploadIcon className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                ) : null}
                <Button size="sm" className="h-8" onClick={() => setEligibilityArticle(article)}>
                  Decisao final
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => updateFullTextStatus(article, "unavailable")}>
                  Sem full text
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => onNavigate(`/projetos/${project.id}/artigos/${article.id}`)}>
                  Detalhes
                </Button>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="included" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-[var(--syn-text-secondary)]">
              {includedArticles.length} artigo(s) no corpus final.
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={loadRQSynthesis} disabled={isLoadingRQSynthesis}>
              {isLoadingRQSynthesis ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : <SparklesIcon className="h-3.5 w-3.5" />}
              Sintese por RQ
            </Button>
          </div>

          {rqSynthesisData ? (
            <RQSynthesisPanel
              data={rqSynthesisData}
              isLoading={isLoadingRQSynthesis}
              onRefresh={loadRQSynthesis}
              onOpenArticle={(articleId) => onNavigate(`/projetos/${project.id}/artigos/${articleId}`)}
            />
          ) : null}

          <PhaseTable
            articles={includedArticles}
            emptyLabel="Nenhum artigo incluido no corpus final."
            actions={(article) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8" onClick={() => onNavigate(`/projetos/${project.id}/artigos/${article.id}`)}>
                  Abrir workspace
                </Button>
              </div>
            )}
          />
        </TabsContent>

        <TabsContent value="report">
          <ReportPanel onExport={handleExportReport} report={report} isLoadingReport={isLoadingReport} />
        </TabsContent>
      </Tabs>

      {isLoadingArticles && activeFlowTab !== "overview" && activeFlowTab !== "report" ? (
        <div className="flex items-center gap-2 rounded-md border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-4 py-3 text-sm text-[var(--syn-text-secondary)]">
          <LoaderIcon className="h-4 w-4 animate-spin" />
          Carregando registros da fase atual...
        </div>
      ) : null}

      <NewArticleModal
        isOpen={showNewArticleModal}
        onClose={() => setShowNewArticleModal(false)}
        onSuccess={() => refreshAll()}
        projectId={project.id}
      />

      <ImportBibTeXModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => refreshAll()}
        projectId={project.id}
      />

      <UploadPDFModal
        isOpen={showUploadPdfModal}
        onClose={() => {
          setShowUploadPdfModal(false);
          setPdfTarget(null);
        }}
        onSuccess={() => refreshAll()}
        project={project}
        article={pdfTarget}
      />

      <ScreeningDecisionDialog
        article={screeningArticle}
        isOpen={Boolean(screeningArticle)}
        isSaving={isSavingDecision}
        onClose={() => setScreeningArticle(null)}
        onSubmit={submitScreeningDecision}
      />

      <EligibilityDecisionDialog
        article={eligibilityArticle}
        checklist={project?.eligibilityChecklist || []}
        researchQuestions={project?.researchQuestions || []}
        isOpen={Boolean(eligibilityArticle)}
        isSaving={isSavingDecision}
        onClose={() => setEligibilityArticle(null)}
        onSubmit={submitEligibilityDecision}
      />
    </div>
  );
}

export default ProjectArticles;
