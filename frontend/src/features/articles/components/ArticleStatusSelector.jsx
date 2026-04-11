import { Label } from "@/components/ui/Label";
import { StatusBadge } from "@/components/ui/StatusBadge";

function ArticleStatusSelector({
  label = "Status",
  onChange,
  options,
  selectedStatus,
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedStatus === status
                ? "border-transparent bg-[var(--syn-sidebar-bg)] text-white"
                : "border-[var(--syn-border)] text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)]"
            }`}
          >
            <StatusBadge status={status} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default ArticleStatusSelector;
