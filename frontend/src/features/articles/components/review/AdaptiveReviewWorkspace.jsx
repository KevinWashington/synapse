import { useState } from "react";
import { cn } from "@/lib/utils";

function AdaptiveReviewWorkspace({ activeStage, queue, content, tool }) {
  const [activeRegion, setActiveRegion] = useState("content");
  const regions = { queue, content, tool };
  const regionDefinitions = [
    { key: "queue", label: "Fila" },
    { key: "content", label: activeStage === "included" ? "Extração" : "Artigo" },
    { key: "tool", label: "Decisão" },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-[#edf0f7] bg-white">
      <div
        role="tablist"
        aria-label="Áreas do workspace"
        className="grid grid-cols-3 border-b border-[#edf0f7] bg-[#fbfcff] xl:hidden"
      >
        {regionDefinitions.map((region) => (
          <button
            key={region.key}
            id={`review-region-tab-${region.key}`}
            type="button"
            role="tab"
            aria-controls={`review-region-${region.key}`}
            aria-selected={activeRegion === region.key}
            onClick={() => setActiveRegion(region.key)}
            className={cn(
              "border-b-2 px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff] focus-visible:ring-inset",
              activeRegion === region.key
                ? "border-[#6259ff] bg-white text-[#554bea]"
                : "border-transparent text-[#667391] hover:text-[#111936]"
            )}
          >
            {region.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-[620px] xl:grid-cols-[minmax(250px,0.72fr)_minmax(0,1.45fr)_minmax(280px,0.83fr)]">
        {regionDefinitions.map((region) => {
          const isActive = activeRegion === region.key;
          return (
            <section
              key={region.key}
              id={`review-region-${region.key}`}
              role="region"
              aria-label={region.label}
              aria-labelledby={`review-region-tab-${region.key}`}
              data-active-region={String(isActive)}
              className={cn(
                "min-h-0 min-w-0 overflow-hidden",
                region.key !== "queue" && "border-l border-[#edf0f7]",
                isActive ? "block" : "hidden",
                "xl:block"
              )}
            >
              {regions[region.key]}
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default AdaptiveReviewWorkspace;
