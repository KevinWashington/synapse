import { cn } from "@/lib/utils";

const variants = {
  high: "bg-[var(--syn-badge-high-bg)] text-[var(--syn-badge-high-text)]",
  medium: "bg-[var(--syn-badge-medium-bg)] text-[var(--syn-badge-medium-text)]",
  low: "bg-[var(--syn-badge-low-bg)] text-[var(--syn-badge-low-text)]",
  blue: "bg-[var(--syn-badge-blue-bg)] text-[var(--syn-badge-blue-text)]",
  neutral: "bg-[var(--syn-badge-neutral-bg)] text-[var(--syn-badge-neutral-text)]",
};

const STATUS_MAP = {
  // Project statuses
  ideia: { variant: "neutral", label: "Todo" },
  "em-progresso": { variant: "blue", label: "In Progress" },
  concluido: { variant: "low", label: "Completed" },
  pausado: { variant: "medium", label: "On Hold" },
  // Article statuses
  pendente: { variant: "medium", label: "Não lido" },
  analisado: { variant: "low", label: "Lido" },
  excluido: { variant: "high", label: "Excluído" },
  incluido: { variant: "blue", label: "Incluído" },
  lendo: { variant: "neutral", label: "Lendo" },
};

const PRIORITY_MAP = {
  high: { variant: "high", label: "High Priority" },
  medium: { variant: "medium", label: "Medium Priority" },
  low: { variant: "low", label: "Low Priority" },
};

const TYPE_MAP = {
  "revisao-sistematica": { variant: "high", label: "Revisão Sistemática" },
  "meta-analise": { variant: "blue", label: "Meta-análise" },
  "scoping-review": { variant: "low", label: "Scoping Review" },
};

export function StatusBadge({
  variant = "neutral",
  label,
  status,
  priority,
  type,
  onClick,
  className,
}) {
  let resolvedVariant = variant;
  let resolvedLabel = label;

  if (status && STATUS_MAP[status]) {
    resolvedVariant = STATUS_MAP[status].variant;
    resolvedLabel = resolvedLabel || STATUS_MAP[status].label;
  }
  if (priority && PRIORITY_MAP[priority]) {
    resolvedVariant = PRIORITY_MAP[priority].variant;
    resolvedLabel = resolvedLabel || PRIORITY_MAP[priority].label;
  }
  if (type && TYPE_MAP[type]) {
    resolvedVariant = TYPE_MAP[type].variant;
    resolvedLabel = resolvedLabel || TYPE_MAP[type].label;
  }

  return (
    <span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick(e) : undefined}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        "transition-all duration-200",
        variants[resolvedVariant] || variants.neutral,
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      style={{ borderRadius: "var(--syn-radius-badge)" }}
    >
      {resolvedLabel}
    </span>
  );
}

export { STATUS_MAP, PRIORITY_MAP, TYPE_MAP };
