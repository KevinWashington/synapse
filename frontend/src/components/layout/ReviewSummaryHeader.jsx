import { useId } from "react";

export default function ReviewSummaryHeader({ title, description, actions, metrics }) {
  const id = useId();

  return (
    <header className="min-w-0 rounded-xl border border-[#e2e6ef] bg-white">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#111936]">{title}</h2>
          <p className="mt-1 text-sm text-[#667391]">{description}</p>
        </div>
        {actions}
      </div>
      <dl aria-label="Indicadores da revisão" className={`grid min-w-0 grid-cols-2 border-t border-[#edf0f7] ${metrics.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
        {metrics.map((metric, index) => (
          <div key={metric.label} className={`min-w-0 border-[#edf0f7] px-4 py-3 odd:border-r [&:nth-child(n+3)]:border-t md:[&:nth-child(n+3)]:border-t-0 md:[&:not(:last-child)]:border-r sm:px-5 ${metrics.length === 3 && index === 2 ? "col-span-2 !border-r-0 md:col-span-1" : ""}`}>
            <dt id={`${id}-${index}`} aria-label={metric.label} className="break-words text-xs font-medium text-[#667391]">{metric.label}</dt>
            <dd aria-labelledby={`${id}-${index}`} className="mt-1 break-words text-xl font-semibold tabular-nums text-[#111936]">
              {metric.value}
              {metric.description && <span className="mt-1 block text-xs font-normal text-[#667391]">{metric.description}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
