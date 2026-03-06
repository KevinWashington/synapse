import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendDirection = "up",
  loading,
  className,
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--syn-radius-card)] bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)]",
        "p-5 flex flex-col gap-1",
        "shadow-[var(--syn-shadow-card)]",
        "border border-[var(--syn-border)]",
        "syn-transition hover:shadow-[var(--syn-shadow-card-hover)]",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--syn-text-secondary)]">
          {title}
        </span>
        {Icon && (
          <Icon className="h-5 w-5 text-[var(--syn-text-secondary)] opacity-60" />
        )}
      </div>

      <div className="flex items-baseline gap-2">
        {loading ? (
          <div className="h-9 w-20 rounded bg-[var(--syn-badge-neutral-bg)] animate-pulse" />
        ) : (
          <span className="text-3xl font-bold text-[var(--syn-text-primary)] tabular-nums">
            {value}
          </span>
        )}
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold",
              trendDirection === "up"
                ? "text-[var(--syn-badge-low-text)]"
                : "text-[var(--syn-badge-high-text)]"
            )}
          >
            {trendDirection === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <span className="text-xs text-[var(--syn-text-secondary)]">
          {subtitle}
        </span>
      )}
    </div>
  );
}
