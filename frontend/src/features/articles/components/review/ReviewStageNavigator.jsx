import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const REVIEW_STAGES = [
  { key: "identification", number: 1, label: "Identificação" },
  { key: "screening", number: 2, label: "Triagem" },
  { key: "eligibility", number: 3, label: "Elegibilidade" },
  { key: "included", number: 4, label: "Inclusão" },
];

function getStageCount(summary, stageKey) {
  if (stageKey === "included") return summary?.included || 0;
  return summary?.[stageKey]?.total || 0;
}

function formatCount(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function ReviewStageNavigator({ activeStage, onStageChange, summary }) {
  const activeIndex = REVIEW_STAGES.findIndex((stage) => stage.key === activeStage);

  return (
    <nav aria-label="Etapas da revisão" className="border-b border-[#edf0f7] bg-white px-3 py-3 sm:px-5">
      <div className="flex gap-2 overflow-x-auto pb-1 xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0">
        {REVIEW_STAGES.map((stage, index) => {
          const isActive = stage.key === activeStage;
          const isDone = index < activeIndex;

          return (
            <button
              key={stage.key}
              type="button"
              aria-current={isActive ? "step" : undefined}
              onClick={() => onStageChange(stage.key)}
              className={cn(
                "relative flex min-w-44 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors xl:min-w-0",
                isActive
                  ? "bg-[#f0edff] text-[#554bea]"
                  : "text-[#667391] hover:bg-[#f7f8fc] hover:text-[#111936]"
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  isActive
                    ? "border-[#6259ff] bg-[#6259ff] text-white"
                    : isDone
                      ? "border-[#bfe8cf] bg-[#eefaf3] text-[#19884f]"
                      : "border-[#dfe4ef] bg-white text-[#111936]"
                )}
              >
                {isDone ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : stage.number}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{stage.label}</span>
                <span className="mt-0.5 block text-xs font-normal text-[#667391]">
                  {formatCount(getStageCount(summary, stage.key))} artigos
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default ReviewStageNavigator;
