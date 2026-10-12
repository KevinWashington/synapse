import { useState } from "react";
import { ArrowRightIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 4;
function formatDate(value) {
  const date = value && new Date(value);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("pt-BR") : "Data não informada";
}

function ProjectOverviewSection({ activeTab, filteredProjects, loading, error, onRetry, onOpenProject, onTabChange, tabs, loadedProjectCount, projectTotal }) {
  const [pagination, setPagination] = useState({ tab: activeTab, page: 1 });
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const page = pagination.tab === activeTab ? Math.min(pagination.page, totalPages) : 1;
  const visibleProjects = filteredProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section aria-label="Projetos recentes" className="min-w-0 overflow-hidden rounded-xl border border-[#e2e6ef] bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0"><h2 className="text-base font-semibold tracking-[-0.02em] text-[#111936]">Continue sua revisão</h2><p className="mt-1 text-sm text-[#667391]">Abra um projeto para retomar o trabalho.</p></div>
        <Button variant="outline" size="sm" onClick={() => onOpenProject()}>Ver todos os projetos</Button>
      </header>
      <nav aria-label="Filtros de projetos recentes" className="grid grid-cols-3 border-y border-[#edf0f7] bg-[#fbfcff]">
        {tabs.map((tab) => <button key={tab.key} type="button" aria-pressed={activeTab === tab.key} onClick={() => { setPagination({ tab: tab.key, page: 1 }); onTabChange(tab.key); }}
          className={cn("min-w-0 border-b-2 px-2 py-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[#6259ff] sm:text-sm", activeTab === tab.key ? "border-[#6259ff] bg-white text-[#554bea]" : "border-transparent text-[#667391] hover:text-[#111936]")}>
          {tab.label}<span className="ml-1.5 rounded-full bg-[#eef0f7] px-1.5 py-0.5 text-[10px] font-medium text-[#667391]">{tab.count}</span>
        </button>)}
      </nav>
      {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 p-5 text-sm text-[#667391]"><LoaderIcon className="h-4 w-4 animate-spin" />Carregando projetos...</div>
        : error ? <div role="alert" className="space-y-3 p-5 text-sm text-[#667391]"><p>Não foi possível carregar seus projetos.</p><Button variant="outline" onClick={onRetry}>Tentar novamente</Button></div>
        : visibleProjects.length ? <div className="divide-y divide-[#edf0f7]">
          {visibleProjects.map((project) => <button key={project.id} type="button" aria-label={`Abrir ${project.title}`} onClick={() => onOpenProject(project.id)}
            className="group flex w-full min-w-0 items-center gap-3 px-4 py-4 text-left hover:bg-[#fbfcff] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#6259ff] sm:px-5">
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 break-words text-sm font-semibold leading-5 text-[#111936]">{project.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <StatusBadge status={project.status} />
                <span className="text-xs text-[#667391]">{new Intl.NumberFormat("pt-BR").format(project.articleCount ?? 0)} artigos</span>
                <span className="text-xs text-[#667391]">Atualizado em {formatDate(project.updatedAt || project.createdAt || project.created_at)}</span>
              </div>
            </div>
            <ArrowRightIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#929bb0] group-hover:text-[#6259ff]" />
          </button>)}
        </div> : <div className="space-y-2 p-5 py-10 text-center"><p className="text-sm font-medium text-[#111936]">{projectTotal === 0 ? "Seu primeiro projeto começa aqui." : "Nenhum projeto neste filtro."}</p><p className="text-xs text-[#667391]">{projectTotal === 0 ? "Crie uma revisão na página de projetos para começar." : "Consulte os outros filtros ou abra a lista completa de projetos."}</p></div>}
      {!loading && !error && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f7] bg-[#fbfcff] px-4 py-3 sm:px-5">
        <p className="text-xs leading-5 text-[#667391]">{loadedProjectCount < projectTotal ? `Filtros nos ${loadedProjectCount} mais recentes de ${projectTotal} projetos.` : `${projectTotal} projetos · mais recentes primeiro.`}</p>
        {filteredProjects.length > PAGE_SIZE && <div className="flex items-center gap-2"><Button variant="outline" size="sm" aria-label="Página anterior" disabled={page === 1} onClick={() => setPagination({ tab: activeTab, page: page - 1 })}>Anterior</Button><span className="text-xs text-[#667391]">{page} de {totalPages}</span><Button variant="outline" size="sm" aria-label="Próxima página" disabled={page === totalPages} onClick={() => setPagination({ tab: activeTab, page: page + 1 })}>Próxima</Button></div>}
      </footer>}
    </section>
  );
}

export default ProjectOverviewSection;
