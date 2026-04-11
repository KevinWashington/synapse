import { memo } from "react";

function PlanningSection({ title, actions, children }) {
  return (
    <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] shadow-[var(--syn-shadow-card)] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--syn-border)]">
        <h3 className="text-sm font-semibold text-[var(--syn-text-primary)]">
          {title}
        </h3>
        {actions}
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

export default memo(PlanningSection);

