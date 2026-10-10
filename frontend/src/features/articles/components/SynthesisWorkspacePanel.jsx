import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSynthesisWorkspace } from "../hooks/useSynthesisWorkspace";
import SynthesisHeader, { SynthesisModeNavigation } from "./SynthesisHeader";
import SynthesisWorkspaceShell from "./SynthesisWorkspaceShell";
import SynthesisDraftEditor from "./SynthesisDraftEditor";

const WORKSPACE_TOKENS = {
  "--syn-accent": "#6259ff",
  "--syn-accent-soft": "#f1efff",
  "--syn-border": "#edf0f7",
  "--syn-bg-primary": "#ffffff",
  "--syn-bg-secondary": "#fbfcff",
  "--syn-text-primary": "#111936",
  "--syn-text-secondary": "#667391",
  "--syn-danger": "#b42318",
};

export default function SynthesisWorkspacePanel({ project, canEdit, onDirtyChange, onOpenArticle }) {
  const workspace = useSynthesisWorkspace({ projectId: project?.id, canEdit, onDirtyChange });
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(null);
  const [visibleFields, setVisibleFields] = useState(() => (project?.dataExtractionSchema || []).slice(0, 6).map((field) => field.key));
  const { mode, setMode, resources, selection, actions, draft } = workspace;
  const loading = resources.overview.loading || resources.rqs.loading;
  const activeKeys = mode === "rqs" ? ["rqs", "detail", "evidence"] : mode === "matrix" ? ["matrix", "study"] : mode === "visualizations" ? ["chartCatalog", "chart"] : ["criteria", "quality", "study"];
  const loadError = ["overview", ...activeKeys].some((key) => resources[key]?.error);
  const onExport = (kind, scope) => actions.export(kind, { scope });

  const requestOpenArticle = (articleId) => {
    if (draft.dirty) setPending({ type: "article", articleId });
    else onOpenArticle?.(articleId);
  };
  const requestSelectRQ = (rqNumber) => {
    if (draft.dirty) setPending({ type: "rq", rqNumber });
    else actions.selectRQ(rqNumber);
  };
  const requestModeChange = (nextMode) => {
    if (draft.dirty && nextMode !== mode) setPending({ type: "mode", mode: nextMode });
    else setMode(nextMode);
  };
  const continuePending = async (saveFirst) => {
    if (saveFirst) {
      try {
        const saved = await actions.save();
        if (!saved) return;
      } catch { return; }
    }
    const next = pending;
    setPending(null);
    if (!saveFirst) actions.discardDraft();
    if (next?.type === "rq") actions.selectRQ(next.rqNumber);
    if (next?.type === "article") onOpenArticle?.(next.articleId);
    if (next?.type === "mode") setMode(next.mode);
  };

  let regions;
  if (mode === "rqs") {
    const items = (resources.rqs.data?.items || []).filter((item) => item.question.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    regions = {
      index: <Index title="Perguntas de pesquisa" search={search} onSearch={(value) => { setSearch(value); actions.setFilter("search", value); }} count={resources.rqs.data?.total}>
        {items.map((item) => <button key={item.rqNumber} type="button" onClick={() => requestSelectRQ(item.rqNumber)} className={`w-full border-b border-[var(--syn-border)] p-3 text-left hover:bg-[var(--syn-bg-secondary)] ${selection.rqNumber === item.rqNumber ? "bg-[var(--syn-accent-soft)]" : ""}`}><span className="flex items-start justify-between gap-2"><span className="line-clamp-3 text-sm font-medium">RQ {item.rqNumber} · {item.question}</span><StatePill state={item.draftState} /></span><span className="mt-2 block text-xs text-[var(--syn-text-secondary)]">{item.evidenceCount} estudos com evidência</span></button>)}
        {items.length > 0 && <Pagination page={resources.rqs.data?.page} total={resources.rqs.data?.total} onPage={(page) => actions.setPage("rqs", page)} />}
        {resources.rqs.loading && !items.length && <p role="status" className="p-4 text-sm text-[var(--syn-text-secondary)]">Carregando perguntas…</p>}
        {!items.length && !resources.rqs.loading && !resources.rqs.error && <Empty>Cadastre perguntas no planejamento para iniciar a síntese.</Empty>}
      </Index>,
      content: <SynthesisDraftEditor detail={resources.detail.data} value={draft.content} dirty={draft.dirty} canEdit={canEdit} conflict={draft.conflict} job={resources.detail.data?.activeGeneration || resources.detail.data?.lastGeneration} onChange={actions.setDraft} onSave={actions.save} onGenerate={(replace) => actions.generate(replace)} onReload={() => { actions.discardDraft(); actions.selectRQ(selection.rqNumber); }} onOpenArticle={requestOpenArticle} />,
      context: <EvidenceContext page={resources.evidence.data} pageNumber={workspace.pages.evidence} rqNumber={selection.rqNumber} onPage={(page) => actions.setPage("evidence", page)} onOpenArticle={requestOpenArticle} />,
    };
  } else if (mode === "matrix") {
    const fields = project?.dataExtractionSchema || [];
    const columns = ["title", "year", "sourceName", "qualityRating", ...fields.filter((field) => visibleFields.includes(field.key)).map((field) => field.key)];
    regions = {
      index: <Index title="Matriz de extração" search={search} onSearch={(value) => { setSearch(value); actions.setFilter("search", value); }}><AdditionalFilters filters={workspace.filters} onChange={actions.setFilter} /><details className="mx-3 mb-3 rounded-lg border border-[var(--syn-border)]"><summary className="cursor-pointer px-3 py-2 text-sm font-medium">Campos exibidos ({visibleFields.length}/{fields.length})</summary><div className="max-h-56 overflow-y-auto border-t border-[var(--syn-border)] p-2">{fields.map((field) => <label key={field.key} className="flex items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-[var(--syn-bg-secondary)]"><input type="checkbox" checked={visibleFields.includes(field.key)} onChange={(event) => setVisibleFields((current) => event.target.checked ? [...current, field.key] : current.filter((key) => key !== field.key))} /><span>{field.label || field.key}</span></label>)}</div></details><p className="p-3 text-xs text-[var(--syn-text-secondary)]">A matriz mostra estudos incluídos, com filtros aplicados no servidor.</p></Index>,
      content: <MatrixContent columns={columns} fields={fields} rows={resources.matrix.data?.items || []} total={resources.matrix.data?.total} page={resources.matrix.data?.page} onPage={(page) => actions.setPage("matrix", page)} selectedArticleId={selection.articleId} onSelectArticle={actions.selectArticle} />,
      context: <StudyContext study={resources.study.data} mode={mode} fields={mode === "matrix" ? project?.dataExtractionSchema : project?.qualityAssessmentSchema} onOpenArticle={requestOpenArticle} />,
    };
  } else if (mode === "visualizations") {
    const catalog = resources.chartCatalog.data || [];
    regions = {
      index: <Index title="Visualizações"><p className="p-3 text-xs text-[var(--syn-text-secondary)]">Escolha um campo extraído para explorar sua distribuição.</p>{catalog.map((item) => <button key={item.key} onClick={() => actions.selectChart(item.key)} className={`w-full border-b border-[var(--syn-border)] p-3 text-left text-sm ${selection.chartKey === item.key ? "bg-[var(--syn-accent-soft)]" : ""}`}>{item.label}</button>)}</Index>,
      content: <ChartContent chart={resources.chart.data} page={workspace.pages.chart} onPage={(page) => actions.setPage("chart", page)} onOpenArticle={requestOpenArticle} />,
      context: <div className="space-y-3 p-4"><div><h3 className="font-semibold">Como ler</h3><p className="mt-2 text-sm leading-6 text-[var(--syn-text-secondary)]">Os valores são agregados sobre o conjunto filtrado, não apenas sobre a página visível. Estudos sem valor são contabilizados à parte.</p><p className="mt-4 text-sm">Amostra: {resources.chart.data?.sampleSize ?? 0}</p><p className="text-sm">Sem resposta: {resources.chart.data?.missingCount ?? 0}</p></div><Button size="sm" variant="outline" onClick={() => setMode("matrix")}>Ver estudos na matriz</Button></div>,
    };
  } else {
    const criteria = resources.criteria.data || [];
    regions = {
      index: <Index title="Avaliação da qualidade" search={search} onSearch={(value) => { setSearch(value); actions.setFilter("search", value); }}><AdditionalFilters filters={workspace.filters} onChange={actions.setFilter} />{criteria.map((item) => <button key={item.key} onClick={() => actions.selectCriterion(item.key)} className={`w-full border-b border-[var(--syn-border)] p-3 text-left text-sm ${selection.criterionKey === item.key ? "bg-[var(--syn-accent-soft)]" : ""}`}><span className="block font-medium">{item.label}</span><span className="mt-1 block text-xs text-[var(--syn-text-secondary)]">{item.total ?? 0} estudos</span></button>)}</Index>,
      content: <QualityContent criterion={criteria.find((item) => item.key === selection.criterionKey)} page={resources.quality.data} selectedArticleId={selection.articleId} onSelectArticle={actions.selectArticle} onPage={(page) => actions.setPage("quality", page)} />,
      context: <StudyContext study={resources.study.data} mode={mode} fields={mode === "matrix" ? project?.dataExtractionSchema : project?.qualityAssessmentSchema} onOpenArticle={requestOpenArticle} />,
    };
  }
  return <div className="min-w-0 space-y-5" style={WORKSPACE_TOKENS}><SynthesisHeader overview={resources.overview.data} loading={loading} onRefresh={actions.refresh} onExport={onExport} />{loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><p>Não foi possível carregar os dados da síntese. Tente atualizar novamente.</p><Button variant="outline" size="sm" onClick={actions.refresh}>Tentar novamente</Button></div>}<SynthesisWorkspaceShell {...regions} navigation={<SynthesisModeNavigation mode={mode} onModeChange={requestModeChange} />} />{pending && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="synthesis-unsaved-title"><div className="w-full max-w-md rounded-xl bg-[var(--syn-bg-primary)] p-5 shadow-xl"><h2 id="synthesis-unsaved-title" className="font-semibold">Alterações não salvas</h2><p className="mt-2 text-sm text-[var(--syn-text-secondary)]">Salve ou descarte o rascunho antes de continuar.</p>{draft.conflict?.message && <p role="alert" className="mt-2 text-sm text-[var(--syn-danger)]">{draft.conflict.message}</p>}<div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setPending(null)}>Continuar editando</Button><Button variant="outline" onClick={() => continuePending(false)}>Descartar</Button><Button onClick={() => continuePending(true)}>Salvar e continuar</Button></div></div></div>}</div>;
}

function Index({ title, count, search, onSearch, children }) { return <div><div className="sticky top-0 z-10 border-b border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-3"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{title}</h2>{count != null && <span className="rounded-full bg-[var(--syn-accent-soft)] px-2 py-0.5 text-xs text-[var(--syn-accent)]">{count}</span>}</div>{search !== undefined && <FilterBox value={search} onChange={onSearch} />}</div>{children}</div>; }
function FilterBox({ value, onChange }) { return <label className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--syn-border)] px-3"><Search className="h-4 w-4 text-[var(--syn-text-secondary)]" /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Buscar artigos ou perguntas" className="min-w-0 flex-1 py-2 text-sm outline-none" /></label>; }
function AdditionalFilters({ filters, onChange }) { return <div className="grid grid-cols-2 gap-2 p-3"><label className="text-xs text-[var(--syn-text-secondary)]">Ano inicial<input type="number" value={filters.yearFrom || ""} onChange={(event) => onChange("yearFrom", event.target.value || undefined)} className="mt-1 w-full rounded-md border border-[var(--syn-border)] px-2 py-1.5 text-sm text-[var(--syn-text-primary)]" /></label><label className="text-xs text-[var(--syn-text-secondary)]">Ano final<input type="number" value={filters.yearTo || ""} onChange={(event) => onChange("yearTo", event.target.value || undefined)} className="mt-1 w-full rounded-md border border-[var(--syn-border)] px-2 py-1.5 text-sm text-[var(--syn-text-primary)]" /></label><label className="col-span-2 text-xs text-[var(--syn-text-secondary)]">Extração<select value={filters.completion || "all"} onChange={(event) => onChange("completion", event.target.value === "all" ? undefined : event.target.value)} className="mt-1 w-full rounded-md border border-[var(--syn-border)] px-2 py-1.5 text-sm text-[var(--syn-text-primary)]"><option value="all">Todos</option><option value="complete">Concluída</option><option value="partial">Parcial</option><option value="empty">Sem dados</option></select></label></div>; }
function MatrixContent({ columns, fields, rows, total, page, onPage, selectedArticleId, onSelectArticle }) {
  const pinnedStyle = (index) => index === 0 ? { position: "sticky", left: 0, zIndex: 3 } : index === 1 ? { position: "sticky", left: 280, zIndex: 2 } : undefined;
  return <div className="min-w-0 p-3"><h2 className="mb-3 text-base font-semibold">Matriz de extração</h2><div className="max-w-full overflow-auto rounded-lg border border-[var(--syn-border)]"><table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm"><colgroup>{columns.map((column, index) => <col key={column} style={{ width: index === 0 ? 280 : index === 1 ? 80 : 180 }} />)}</colgroup><thead className="sticky top-0 bg-[var(--syn-bg-secondary)]"><tr>{columns.map((column, index) => <th key={column} style={pinnedStyle(index)} className="border-b border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] p-2 font-semibold">{({ title: "Artigo", year: "Ano", sourceName: "Fonte", qualityRating: "Avaliação" })[column] || fields.find((field) => field.key === column)?.label || "Campo sem nome"}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.articleId} className="border-b border-[var(--syn-border)]">{columns.map((column, index) => <td key={column} style={pinnedStyle(index)} className={`truncate p-2 ${selectedArticleId === row.articleId ? "bg-[var(--syn-accent-soft)]" : "bg-[var(--syn-bg-primary)]"}`}><button type="button" aria-pressed={selectedArticleId === row.articleId} className="max-w-full truncate text-left hover:underline" title={matrixValue(row, column)} onClick={() => onSelectArticle(row.articleId)}>{matrixValue(row, column)}</button></td>)}</tr>)}</tbody></table></div><Pagination page={page} total={total} onPage={onPage} /></div>;
}
function Empty({ children }) { return <p className="p-4 text-sm text-[var(--syn-text-secondary)]">{children}</p>; }
function StatePill({ state }) { const label = { not_started: "Não iniciado", draft: "Rascunho", stale: "Revisar" }[state] || state; return <span className="shrink-0 rounded-full bg-[var(--syn-bg-secondary)] px-2 py-1 text-[10px]">{label}</span>; }
function EvidenceContext({ page, pageNumber, rqNumber, onPage, onOpenArticle }) { return <div className="p-3"><h3 className="text-sm font-semibold">Evidências · RQ {rqNumber || "—"}</h3><p className="mt-1 text-xs text-[var(--syn-text-secondary)]">{page?.total ?? 0} estudos encontrados</p>{(page?.items || []).map((item) => <button key={item.articleId} onClick={() => onOpenArticle?.(item.articleId)} className="block w-full border-b border-[var(--syn-border)] py-3 text-left"><span className="line-clamp-2 text-sm font-medium">{item.title}</span><span className="mt-1 block text-xs text-[var(--syn-text-secondary)]">{item.year || "Ano indisponível"} · {formatQualityRating(item.qualityRating)}</span>{item.evidenceExcerpt && <span className="mt-2 line-clamp-3 block text-xs leading-5">{item.evidenceExcerpt}</span>}</button>)}<Pagination page={pageNumber} total={page?.total} onPage={onPage} /></div>; }
function StudyContext({ study, mode, fields = [], onOpenArticle }) {
  if (!study) return <Empty>Selecione um estudo para ver os detalhes completos.</Empty>;
  const values = (mode === "matrix" ? study.extractionValues : study.qualityAnswers) || {};
  const entries = fields.length ? fields.map((field) => [field.key, field.label || "Campo sem nome"]) : Object.keys(values).map((key, index) => [key, `Campo ${index + 1}`]);
  return <div className="space-y-4 p-4">
    <h3 className="font-semibold">{study.title}</h3>
    <p className="text-sm text-[var(--syn-text-secondary)]">{study.year || "Ano indisponível"} · {formatQualityRating(study.qualityRating)}{study.qualityScore != null ? ` · ${study.qualityScore}%` : ""}</p>
    <Button size="sm" variant="outline" onClick={() => onOpenArticle?.(study.articleId)}>Abrir na extração</Button>
    <div><h4 className="text-sm font-semibold">{mode === "matrix" ? "Dados extraídos" : "Respostas da avaliação"}</h4>
      {entries.length ? <dl className="mt-3 divide-y divide-[var(--syn-border)]">{entries.map(([key, label]) => <div key={key} className="space-y-1 py-3 first:pt-0"><dt className="text-xs font-medium text-[var(--syn-text-secondary)]">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm leading-6">{formatAnswer(values[key], mode === "quality")}</dd></div>)}</dl> : <p className="mt-3 text-sm text-[var(--syn-text-secondary)]">Nenhuma resposta registrada.</p>}
    </div>
  </div>;
}
function formatQualityRating(value) { return { high: "Alta", medium: "Média", low: "Baixa" }[value] || "Sem avaliação"; }
function formatAnswer(value, quality = false) {
  if (value == null || value === "") return "Não preenchido";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.length ? value.map((item) => formatAnswer(item, quality)).join(", ") : "Não preenchido";
  if (typeof value === "object") return Object.values(value).map((item) => formatAnswer(item, quality)).join("; ") || "Não preenchido";
  if (quality) return { yes: "Sim", partial: "Parcial", no: "Não", na: "Não se aplica" }[value] || String(value);
  return String(value);
}
function matrixValue(row, column) { return column === "qualityRating" ? formatQualityRating(row[column]) : formatAnswer(row[column] ?? row.extractionValues?.[column]); }
function QualityContent({ criterion, page, selectedArticleId, onSelectArticle, onPage }) {
  const distribution = Object.entries(criterion?.distribution || {}).map(([value, count]) => ({ value: criterion?.key === "overall" ? formatQualityRating(value) : formatAnswer(value, true), count }));
  return <div className="min-w-0 p-4"><h2 className="font-semibold">{criterion?.label || "Estudos avaliados"}</h2><p className="mt-1 text-xs text-[var(--syn-text-secondary)]">Distribuição do conjunto filtrado · {criterion?.total ?? 0} estudos</p>{distribution.length > 0 && <div className="mt-3 h-48 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="value" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="var(--syn-accent)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}<h3 className="mb-2 mt-4 text-sm font-semibold">Estudos avaliados</h3>{(page?.items || []).map((item) => <button key={item.articleId} onClick={() => onSelectArticle(item.articleId)} className={`block w-full border-b border-[var(--syn-border)] p-3 text-left text-sm ${selectedArticleId === item.articleId ? "bg-[var(--syn-accent-soft)]" : ""}`}><span className="block font-medium">{item.title}</span><span className="text-xs text-[var(--syn-text-secondary)]">{item.year || "Ano indisponível"} · {formatQualityRating(item.qualityRating)}</span></button>)}<Pagination page={page?.page} total={page?.total} onPage={onPage} /></div>;
}
function ChartContent({ chart, page, onPage, onOpenArticle }) { return <div className="p-4"><h2 className="text-base font-semibold">{chart?.field?.label || "Distribuição"}</h2><p className="mt-1 text-xs text-[var(--syn-text-secondary)]">Dados subjacentes · n={chart?.sampleSize ?? 0}</p>{chart?.rows?.items ? <><div className="mt-4 space-y-2">{chart.rows.items.map((row) => <button type="button" key={row.articleId} onClick={() => onOpenArticle?.(row.articleId)} className="block w-full border-b border-[var(--syn-border)] py-2 text-left text-sm hover:underline">{row.title}: {row.value}</button>)}</div><Pagination page={page} total={chart.rows.total} onPage={onPage} /></> : <div className="mt-4 h-[360px] min-w-0">{chart?.rows?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chart.rows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="value" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="var(--syn-accent)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty>Não há dados para este campo.</Empty>}<div className="mt-4 max-h-64 overflow-auto">{(chart?.rows || []).map((row) => <div key={row.value} className="flex justify-between border-b border-[var(--syn-border)] py-2 text-sm"><span className="truncate">{row.value}</span><span>{row.count}</span></div>)}</div></div>}</div>; }
function Pagination({ page = 1, total = 0, onPage }) { const pages = Math.max(1, Math.ceil(total / 20)); return <div className="flex items-center justify-between border-t border-[var(--syn-border)] p-3 text-xs"><span>{total} estudos · página {page || 1} de {pages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={(page || 1) <= 1} onClick={() => onPage((page || 1) - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={(page || 1) >= pages} onClick={() => onPage((page || 1) + 1)}>Próxima</Button></div></div>; }
