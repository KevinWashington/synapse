import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function DecisionOptions({ decision, onChange, disabled, allowUnavailable = false }) {
  function option(value, label) {
    const selected = decision === value;
    return (
      <Button key={value} type="button" variant="outline" data-decision={value} aria-pressed={selected}
        disabled={disabled} onClick={() => onChange(value)}
        className={cn("h-auto min-h-10 w-full min-w-0 gap-2 whitespace-normal border-[#dfe4ef] bg-white px-3 py-2 text-sm text-[#56627f] shadow-none", selected && "border-[#6259ff] bg-[#f0edff] font-semibold text-[#554bea] hover:bg-[#ebe7ff]")}>
        {selected && <CheckIcon aria-hidden="true" className="h-4 w-4 shrink-0" />}{label}
      </Button>
    );
  }
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-sm font-medium text-[#111936]">Sua decisão</legend>
      <div className="grid grid-cols-2 gap-2">{option("included", "Incluir")}{option("excluded", "Excluir")}</div>
      {allowUnavailable && option("full_text_unavailable", "Texto completo indisponível")}
    </fieldset>
  );
}
