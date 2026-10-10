import { CheckCircle2Icon, ChevronDownIcon, CircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function PlanningAccordionSection({ actions, children, expanded, onExpandedChange, section }) {
  const triggerId = `planning-section-trigger-${section.key}`;
  const panelId = `planning-section-panel-${section.key}`;

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-[#e2e6ef] bg-white">
      <div className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
        <button
          id={triggerId}
          type="button"
          aria-controls={panelId}
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff]"
        >
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", section.complete ? "bg-[#e8f8ef] text-[#258c55]" : "bg-[#f1f3f8] text-[#8993aa]") }>
            {section.complete ? <CheckCircle2Icon className="h-4 w-4" /> : <CircleIcon className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[#111936]">{section.label}</span>
            <span className="mt-0.5 block text-xs leading-5 text-[#667391]">{section.summary}</span>
          </span>
          <ChevronDownIcon className={cn("h-4 w-4 shrink-0 text-[#667391] transition-transform", expanded && "rotate-180")} />
        </button>
        {actions ? <div className="ml-11 flex min-w-0 flex-wrap items-center gap-2 sm:ml-0">{actions}</div> : null}
      </div>
      <div id={panelId} role="region" aria-labelledby={triggerId} hidden={!expanded} className="border-t border-[#edf0f7] px-4 py-5 sm:px-5">
        <p className="mb-4 text-xs leading-5 text-[#667391]">{section.description}</p>
        {children}
      </div>
    </section>
  );
}

export default PlanningAccordionSection;
