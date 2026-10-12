import { Link } from "react-router-dom";
import { readingUrl } from "../utils/readingResume";
import HomeResourceState, { HomePagination } from "./HomeResourceState";
export default function PersonalWorkPanel({ phase, setPhase, page, setPage, resource, counts }) {
  return <section aria-label="Seu trabalho pendente" className="min-w-0">
    <header className="p-4 sm:p-5"><h2 className="text-base font-semibold text-[#111936]">Seu trabalho pendente</h2><p className="mt-1 text-sm text-[#667391]">Artigos atribuídos a você, prontos para revisão.</p></header>
    <div role="tablist" aria-label="Etapa das suas tarefas" className="flex border-y border-[#edf0f7] px-4 sm:px-5">{[["screening", "Triagem", counts?.screeningPending], ["eligibility", "Elegibilidade", counts?.eligibilityPending]].map(([key, label, count]) => <button key={key} role="tab" aria-selected={phase === key} onClick={() => setPhase(key)} className={`min-w-0 border-b-2 px-3 py-3 text-sm ${phase === key ? "border-[#6259ff] text-[#6259ff]" : "border-transparent text-[#667391]"}`}>{label}{count != null && <span className="ml-2 rounded-full bg-[#f0efff] px-2 py-0.5 text-xs">{count}</span>}</button>)}</div>
    <HomeResourceState resource={resource} empty="Nenhum artigo atribuído a você nesta etapa. Quando houver novas atribuições, elas aparecerão aqui.">
      <ul className="divide-y divide-[#edf0f7]">{resource.data?.items.map((item) => <li key={item.assignmentId}><Link to={readingUrl(item, "notas", true)} className="group block min-w-0 px-4 py-5 transition-colors hover:bg-[#faf9ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6259ff] sm:px-5"><span className="mb-2 block truncate text-xs text-[#667391]">{item.projectTitle}</span><span className="line-clamp-2 text-sm font-medium leading-6 text-[#111936] group-hover:text-[#6259ff]">{item.title}</span><span className="mt-2 block truncate text-xs text-[#667391]">{item.year} · {item.journal}</span><span className="mt-3 inline-block text-xs font-medium text-[#6259ff]">Revisar artigo →</span></Link></li>)}</ul>
    </HomeResourceState>
    {!resource.error && resource.data && <HomePagination page={page} total={resource.data.total} setPage={setPage} loading={resource.loading} />}
  </section>;
}
