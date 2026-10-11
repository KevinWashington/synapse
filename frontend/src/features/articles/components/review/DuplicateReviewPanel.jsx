import { useState } from "react";
import { CheckIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { cn } from "@/lib/utils";


function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}




export function DuplicateReviewPanel({
  candidates,
  isApplying = false,
  onApply,
  onSelectCanonical,
  selectedDuplicateMap,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!candidates.length) {
    return null;
  }

  const recordCount = candidates.reduce(
    (total, candidate) => total + (candidate.articles?.length || 0),
    0
  );

  return (
    <>
    <section className="rounded-lg border border-[#f0d6a8] bg-[#fffdf8] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[#111936]">Revisar duplicatas</h2>
            <span className="rounded-full bg-[#fff0d5] px-2.5 py-1 text-xs font-semibold text-[#b96a00]">
              {formatNumber(candidates.length)} grupo(s) · {formatNumber(recordCount)} registro(s)
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#56627f]">
            Escolha o registro que será mantido em cada grupo. Os demais serão removidos apenas após sua confirmação.
          </p>
        </div>
        <Button
          className="h-9 shrink-0 gap-2 rounded-lg bg-[#6259ff] text-xs text-white hover:bg-[#5148ee]"
          disabled={isApplying || !candidates.every((candidate) => selectedDuplicateMap[candidate.groupKey])}
          onClick={() => setConfirmOpen(true)}
        >
          {isApplying ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
          Confirmar revisão de duplicatas
        </Button>
      </div>

      <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
        {candidates.map((candidate, groupIndex) => (
          <fieldset key={candidate.groupKey} className="rounded-lg border border-[#eadfca] bg-white p-4">
            <legend className="px-1 text-xs font-semibold text-[#7b5a24]">
              Grupo {groupIndex + 1} · {candidate.reasonText}
            </legend>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {(candidate.articles || []).map((candidateArticle) => {
                const checked = selectedDuplicateMap[candidate.groupKey] === candidateArticle.id;
                return (
                  <label
                    key={candidateArticle.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      checked ? "border-[#6259ff] bg-[#f8f7ff]" : "border-[#e5e9f2] hover:border-[#cbd2e1]"
                    )}
                  >
                    <input
                      type="radio"
                      name={`canonical-${candidate.groupKey}`}
                      aria-label={`Manter ${candidateArticle.title}`}
                      checked={checked}
                      onChange={() => onSelectCanonical(candidate.groupKey, candidateArticle.id)}
                      className="mt-1 h-4 w-4 accent-[#6259ff]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-5 text-[#111936]">{candidateArticle.title}</span>
                      <span className="mt-1 block text-xs text-[#667391]">
                        {candidateArticle.authors} · {candidateArticle.year} · {candidateArticle.sourceName}
                      </span>
                      {candidateArticle.doi ? (
                        <span className="mt-1 block text-xs text-[#8b6a35]">DOI: {candidateArticle.doi}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
    <ConfirmationDialog
      open={confirmOpen}
      title="Aplicar revisão de duplicatas?"
      description={`Os registros não canônicos de ${formatNumber(candidates.length)} grupo(s) serão removidos da fila ativa.`}
      confirmLabel="Aplicar revisão"
      isPending={isApplying}
      onConfirm={() => {
        setConfirmOpen(false);
        onApply();
      }}
      onOpenChange={setConfirmOpen}
    />
    </>
  );
}


export default DuplicateReviewPanel;
