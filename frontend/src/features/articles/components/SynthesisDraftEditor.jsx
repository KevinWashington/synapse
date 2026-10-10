import { useEffect, useState } from "react";
import { Sparkles, Save, LoaderCircle, Clock3, CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function SynthesisDraftEditor({ detail, value, dirty, canEdit, conflict, job, onChange, onSave, onGenerate, onReload, onOpenArticle }) {
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const content = value || { narrative: "", keyFindings: [], divergences: [], limitations: [] };
  useEffect(() => setConfirm(false), [detail?.rqNumber, detail?.draft?.version]);
  if (!detail) return <div className="p-6 text-sm text-[var(--syn-text-secondary)]">Selecione uma pergunta de pesquisa para começar.</div>;
  const hasSavedContent = Boolean(detail.draft?.content?.narrative?.trim() || ["keyFindings", "divergences", "limitations"].some((key) => detail.draft?.content?.[key]?.some((item) => item.text?.trim())));
  const activeJob = job && ["queued", "running"].includes(job.status);
  const busy = submitting || activeJob;
  const generationLabel = submitting ? "Enviando solicitação…" : job?.status === "queued" ? "Aguardando na fila…" : activeJob ? "Gerando rascunho…" : confirm ? "Confirmar substituição" : "Gerar rascunho por IA";
  async function generate() {
    if (busy || dirty) return;
    setConfirm(false);
    setGenerationError(null);
    setSubmitting(true);
    try { await onGenerate(hasSavedContent); }
    catch (error) { setGenerationError(error.message || "Não foi possível solicitar a geração. Tente novamente."); }
    finally { setSubmitting(false); }
  }
  return <div className="space-y-5 p-4 sm:p-6">
    <div><p className="text-xs uppercase tracking-wide text-[var(--syn-text-secondary)]">RQ {detail.rqNumber}</p><h2 className="mt-2 text-lg font-semibold leading-7 text-[var(--syn-text-primary)]">{detail.question}</h2></div>
    {(submitting || job) && <GenerationStatus job={submitting ? { status: "submitting" } : job} />}
    {generationError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{generationError}</p>}
    {job?.errorCode === "DEEPSEEK_KEY_REQUIRED" && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Configure sua chave DeepSeek para gerar o rascunho. <a className="font-semibold underline" href="/settings">Abrir Configurações</a></p>}
    {conflict && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><p>{conflict.message || "A versão salva mudou. Seu texto local foi preservado."}</p><Button size="sm" variant="outline" className="mt-2" onClick={onReload}>Descartar local e recarregar versão salva</Button></div>}
    <label className="block"><span className="mb-2 block text-sm font-semibold">Síntese do achado</span><textarea value={content.narrative || ""} disabled={!canEdit} onChange={(event) => onChange({ narrative: event.target.value })} rows={9} className="w-full resize-y rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-3 text-sm leading-6 text-[var(--syn-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--syn-accent)]" placeholder="Escreva uma síntese sustentada pelas evidências incluídas…" /></label>
    {[["keyFindings", "Achados-chave"], ["divergences", "Divergências"], ["limitations", "Limitações"]].map(([key, label]) => <Findings key={key} title={label} items={content[key] || []} editable={canEdit} onChange={(items) => onChange({ [key]: items })} onOpenArticle={onOpenArticle} />)}
    {detail.draft?.sourceArticleIds?.length > 0 && <div className="border-t border-[var(--syn-border)] pt-4"><h3 className="text-sm font-semibold">Fontes vinculadas</h3><div className="mt-2 flex flex-wrap gap-2">{detail.draft.sourceArticleIds.map((id) => <button key={id} type="button" onClick={() => onOpenArticle?.(id)} className="rounded-full border border-[var(--syn-border)] px-2 py-1 text-xs text-[var(--syn-accent)] hover:bg-[var(--syn-bg-secondary)]">Abrir estudo #{id}</button>)}</div></div>}
    {detail.context?.freshness === "stale" && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">A pergunta mudou desde a criação deste rascunho. Revise o texto antes de reutilizá-lo.</p>}
    {canEdit && <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--syn-border)] bg-[var(--syn-bg-primary)] py-3">
      {busy && <span className="mr-auto flex items-center gap-2 text-xs font-medium text-[#554bea]"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />{submitting ? "Solicitando geração" : job?.status === "queued" ? "Solicitação recebida" : "Geração em andamento"}</span>}
      <Button variant="outline" disabled={!dirty} onClick={onSave} className="gap-2"><Save className="h-4 w-4" />Salvar rascunho</Button>
      <Button disabled={dirty || busy} aria-busy={Boolean(busy)} onClick={() => hasSavedContent && !confirm ? setConfirm(true) : generate()} className="gap-2">
        {busy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Sparkles className="h-4 w-4" />}{generationLabel}
      </Button>
      {dirty && <span role="status" className="self-center text-xs text-[var(--syn-text-secondary)]">Salve suas alterações antes de gerar.</span>}
      {confirm && !busy && <Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button>}
    </div>}
  </div>;
}

function GenerationStatus({ job }) {
  const running = job.status === "running";
  const busy = ["submitting", "queued", "running"].includes(job.status);
  const total = Math.max(0, Number(job.totalBatches) || 0);
  const completed = Math.min(total, Math.max(0, Number(job.completedBatches) || 0));
  const consolidating = running && total > 0 && completed === total;
  const progress = running && total > 0 && !consolidating ? Math.round(completed / total * 100) : undefined;
  const states = {
    submitting: ["Solicitando rascunho por IA", "Enviando sua solicitação para iniciar a geração."],
    queued: ["Rascunho por IA na fila", "Solicitação recebida. Aguardando o início do processamento."],
    running: [consolidating ? "Consolidando os achados" : "IA gerando o rascunho", consolidating ? "A análise dos lotes terminou. A IA está preparando a síntese final." : "Analisando as evidências e organizando os achados desta pergunta."],
    succeeded: ["Rascunho gerado", "O resultado está disponível para sua revisão."],
    failed: ["Não foi possível gerar o rascunho", "A geração foi interrompida. Confira o aviso e tente novamente."],
    cancelled: ["Geração cancelada", "Nenhum novo rascunho foi aplicado."],
    conflict: ["O rascunho precisa de revisão", "Os dados ou a versão salva mudaram durante a geração. Atualize a síntese antes de tentar novamente."],
  };
  const [title, description] = states[job.status] || ["Status da geração indisponível", "Atualize a síntese para consultar o estado atual."];
  const failed = ["failed", "conflict"].includes(job.status);
  const Icon = busy ? job.status === "queued" ? Clock3 : LoaderCircle : job.status === "succeeded" ? CircleCheck : TriangleAlert;
  return <div role={failed ? "alert" : "status"} aria-live={failed ? "assertive" : "polite"} aria-atomic="true" className={`sticky top-0 z-20 rounded-xl border p-4 shadow-sm ${busy ? "border-[#d9d4ff] bg-[#f5f3ff] text-[#4035a8]" : failed ? "border-amber-200 bg-amber-50 text-amber-900" : job.status === "succeeded" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-[#e2e6ef] bg-[#fbfcff] text-[#667391]"}`}>
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80"><Icon aria-hidden="true" className={`h-5 w-5 ${busy && job.status !== "queued" ? "animate-spin motion-reduce:animate-none" : ""}`} /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5">{description}</p>
        {busy && <div className="mt-3">
          {running && total > 0 && <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs"><span>{completed} de {total} lotes de evidências analisados</span>{progress != null && <span>{progress}%</span>}</div>}
          <div role="progressbar" aria-label="Progresso da geração por IA" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={progress == null ? title : `${completed} de ${total} lotes analisados`} className="h-1.5 overflow-hidden rounded-full bg-[#e5dfff]">
            <div className={`h-full rounded-full bg-[#6259ff] ${progress == null ? "w-1/3 animate-pulse motion-reduce:animate-none" : "transition-[width] duration-500 motion-reduce:transition-none"}`} style={progress != null ? { width: `${progress}%` } : undefined} />
          </div>
          <p className="mt-2 text-[11px] leading-4">O status é atualizado automaticamente. O rascunho aparecerá aqui ao concluir.</p>
        </div>}
      </div>
    </div>
  </div>;
}

function Findings({ title, items, editable, onChange, onOpenArticle }) {
  return <section><h3 className="text-sm font-semibold text-[var(--syn-text-primary)]">{title}</h3><div className="mt-2 space-y-2">{items.map((item, index) => <div key={`${index}-${item.text}`} className="rounded-lg border border-[var(--syn-border)] p-3">{editable ? <textarea aria-label={`${title} ${index + 1}`} value={item.text} onChange={(event) => onChange(items.map((current, itemIndex) => itemIndex === index ? { ...current, text: event.target.value } : current))} rows={3} className="w-full resize-y bg-transparent text-sm leading-6 outline-none" /> : <p className="text-sm leading-6">{item.text}</p>}{editable && <label className="mt-2 block text-xs text-[var(--syn-text-secondary)]">IDs das fontes (separados por vírgula)<input aria-label={`Fontes de ${title} ${index + 1}`} value={(item.articleIds || []).join(", ")} onChange={(event) => { const articleIds = event.target.value.split(",").map((id) => Number(id.trim())).filter((id) => Number.isSafeInteger(id) && id > 0); onChange(items.map((current, itemIndex) => itemIndex === index ? { ...current, articleIds } : current)); }} className="mt-1 w-full rounded border border-[var(--syn-border)] px-2 py-1 text-xs" /></label>}{item.articleIds?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{item.articleIds.map((id) => <button key={id} type="button" onClick={() => onOpenArticle?.(id)} className="text-xs text-[var(--syn-accent)] hover:underline">Fonte: artigo #{id}</button>)}</div>}</div>)}{editable && <button type="button" className="text-sm text-[var(--syn-accent)] hover:underline" onClick={() => onChange([...items, { text: "", articleIds: [] }])}>+ Adicionar item</button>}</div></section>;
}
