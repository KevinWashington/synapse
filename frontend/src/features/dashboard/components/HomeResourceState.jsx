import { Button } from "@/components/ui/Button";
export default function HomeResourceState({ resource, empty, children }) {
  if (resource.loading) return <p role="status" className="p-5 text-sm text-[#667391]">Carregando…</p>;
  if (resource.error) return <div role="alert" className="space-y-3 p-5 text-sm text-[#667391]"><p>Não foi possível carregar esta área.</p><Button variant="outline" size="sm" onClick={resource.reload}>Tentar novamente</Button></div>;
  if (!resource.data?.items?.length) return <p className="p-5 text-sm leading-6 text-[#667391]">{empty}</p>;
  return children;
}
export function HomePagination({ page, total, setPage, loading }) {
  const pages = Math.max(1, Math.ceil(total / 4));
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f7] px-5 py-3 text-xs text-[#667391]">
    <span>{total} {total === 1 ? "artigo" : "artigos"} · página {page} de {pages}</span>
    <div className="flex gap-2"><Button size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={loading || page >= pages} onClick={() => setPage(page + 1)}>Próxima</Button></div>
  </div>;
}
