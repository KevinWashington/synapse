import { Link } from "react-router-dom";
import { readingUrl } from "../utils/readingResume";
import HomeResourceState, { HomePagination } from "./HomeResourceState";
const labels = { created: "Artigo adicionado", screening: "Triagem registrada", eligibility: "Elegibilidade registrada", included: "Estudo incluído" };
export default function RecentActivityPanel({ resource, page, setPage }) {
  return <section aria-label="Atividade recente" className="min-w-0">
    <header className="border-b border-[#edf0f7] p-4 sm:p-5"><h2 className="text-base font-semibold text-[#111936]">Atividade recente</h2><p className="mt-1 text-sm text-[#667391]">Movimentações nos projetos de que você participa.</p></header>
    <HomeResourceState resource={resource} empty="Ainda não há movimentações nos seus projetos.">
      <ul className="divide-y divide-[#edf0f7]">{resource.data?.items.map((item) => <li key={item.id} className="px-4 py-4 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-medium text-[#6259ff]">{labels[item.type] || "Artigo atualizado"}</span><time className="text-[#667391]" dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</time></div><Link to={readingUrl({ ...item, id: item.articleId })} className="mt-2 block line-clamp-2 text-sm font-medium leading-6 text-[#111936] hover:text-[#6259ff]">{item.title}</Link><p className="mt-1 truncate text-xs text-[#667391]">{item.projectTitle}</p></li>)}</ul>
    </HomeResourceState>
    {!resource.error && resource.data?.total > 4 && <HomePagination page={page} total={resource.data.total} setPage={setPage} loading={resource.loading} />}
  </section>;
}
