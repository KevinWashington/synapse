import { memo } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";

const PROJECT_STATUSES = ["ideia", "em-progresso", "concluido", "pausado"];

function ProjectStatusSelector({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onChange(status)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            value === status
              ? "bg-[var(--syn-sidebar-bg)] text-white border-transparent"
              : "border-[var(--syn-border)] text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)]"
          }`}
        >
          <StatusBadge status={status} />
        </button>
      ))}
    </div>
  );
}

export default memo(ProjectStatusSelector);


