import { cn } from "@/lib/utils";

function PlanningTabs({ activeTab, onTabChange, panels, tabs }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e2e6ef] bg-white">
      <div role="tablist" aria-label="Áreas do planejamento" className="grid min-w-0 grid-cols-3 border-b border-[#e7ebf4] bg-[#fbfcff]">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`planning-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-controls={`planning-panel-${tab.key}`}
              aria-selected={active}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "min-w-0 border-b-2 px-3 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6259ff] focus-visible:ring-inset",
                active ? "border-[#6259ff] bg-white text-[#554bea]" : "border-transparent text-[#667391] hover:text-[#111936]",
              )}
            >
              <span className="block truncate">{tab.label}</span>
              <span className="mt-0.5 block text-[11px] font-medium opacity-75">{tab.completed} de {tab.total}</span>
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <section
          key={tab.key}
          id={`planning-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`planning-tab-${tab.key}`}
          hidden={activeTab !== tab.key}
          className="min-w-0 p-4 sm:p-5"
        >
          {panels[tab.key]}
        </section>
      ))}
    </div>
  );
}

export default PlanningTabs;
