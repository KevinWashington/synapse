import { useState } from "react";
import { CheckCircle2Icon, DownloadIcon, ScanSearchIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function IdentificationTool({
  articleTotal,
  duplicateCandidates,
  canManageArticles = true,
  onRunDedup,
  onPromoteAllUnique,
  onExport,
}) {
  const [confirmPromoteOpen, setConfirmPromoteOpen] = useState(false);
  const duplicateCount = new Set(
    duplicateCandidates.flatMap((candidate) => candidate.candidateIds || [])
  ).size;
  const uniqueCount = Math.max((articleTotal || 0) - duplicateCount, 0);

  return (
    <>
    <aside className="h-full bg-[#fbfbfe] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a94aa]">Identificação</p>
      <h2 className="mt-2 text-base font-semibold text-[#111936]">Organizar registros</h2>

      <dl className="mt-5 space-y-3 border-y border-[#e5e8f0] py-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[#667391]">Únicos na fila</dt>
          <dd className="font-semibold text-[#111936]">{formatNumber(uniqueCount)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[#667391]">Possíveis duplicatas</dt>
          <dd className="font-semibold text-[#d57a00]">{formatNumber(duplicateCount)}</dd>
        </div>
      </dl>

      <p className="mt-4 rounded-lg bg-[#fff8e8] px-3 py-2 text-xs leading-5 text-[#8a5a00]">
        {formatNumber(duplicateCount)} possíveis duplicatas
      </p>

      <div className="mt-5 space-y-2">
        {canManageArticles ? (
          <>
            <Button variant="outline" className="h-10 w-full justify-start gap-2 bg-white" onClick={onRunDedup}>
              <ScanSearchIcon className="h-4 w-4" />
              Detectar duplicatas
            </Button>
            <Button className="h-10 w-full justify-start gap-2 bg-[#6259ff] text-white hover:bg-[#5148ee]" onClick={() => setConfirmPromoteOpen(true)}>
              <CheckCircle2Icon className="h-4 w-4" />
              Enviar únicos para triagem
            </Button>
          </>
        ) : null}
        <Button variant="outline" className="h-10 w-full justify-start gap-2 bg-white" onClick={onExport}>
          <DownloadIcon className="h-4 w-4" />
          Exportar etapa
        </Button>
      </div>
    </aside>
    <ConfirmationDialog
      open={confirmPromoteOpen}
      title="Enviar todos os únicos?"
      description={`Todos os ${formatNumber(uniqueCount)} registros únicos elegíveis serão enviados para triagem.`}
      confirmLabel="Confirmar envio"
      onConfirm={() => {
        setConfirmPromoteOpen(false);
        onPromoteAllUnique();
      }}
      onOpenChange={setConfirmPromoteOpen}
    />
    </>
  );
}

export default IdentificationTool;
