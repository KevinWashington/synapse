import { DownloadIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

function PlanningEditorHeader({ completed, total, percent, onExport, onOpenSearch }) {
  return (
    <header className="min-w-0 rounded-xl border border-[#e2e6ef] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(18,27,54,0.03)] sm:px-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#111936]">Configurar protocolo</h2>
          <p className="mt-1 text-sm text-[#667391]">{completed} de {total} seções completas</p>
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <Button type="button" variant="outline" className="min-w-0 gap-2 border-[#dfe4ef] bg-white" onClick={onOpenSearch}>
            <SearchIcon className="h-4 w-4" />
            Buscar seção
          </Button>
          <Button type="button" variant="outline" className="min-w-0 gap-2 border-[#dfe4ef] bg-white" onClick={onExport}>
            <DownloadIcon className="h-4 w-4" />
            Exportar planejamento
          </Button>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Progresso do planejamento"
          aria-valuemax="100"
          aria-valuemin="0"
          aria-valuenow={percent}
          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#edf0f7]"
        >
          <span className="block h-full rounded-full bg-[#6259ff] transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <span className="shrink-0 text-xs font-semibold text-[#554bea]">{percent}%</span>
      </div>
    </header>
  );
}

export default PlanningEditorHeader;
