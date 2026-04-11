import { memo, useCallback } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import PlanningSection from "./PlanningSection";
import ProjectFrameworkBadge from "./ProjectFrameworkBadge";

const PlanejamentoFrameworkField = memo(function PlanejamentoFrameworkField({
  componentConfig,
  value,
  onChange,
}) {
  const handleChange = useCallback(
    (event) => {
      onChange(componentConfig.key, event.target.value);
    },
    [componentConfig.key, onChange]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-[var(--syn-text-primary)]">
          {componentConfig.labelPt}
          {componentConfig.required ? "" : (
            <span className="ml-1 text-xs font-normal text-[var(--syn-text-secondary)]">
              (opcional)
            </span>
          )}
        </Label>
        <div className="group relative">
          <Info className="h-3.5 w-3.5 text-[var(--syn-text-secondary)] cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-[var(--syn-bg-secondary)] border border-[var(--syn-border)] text-xs text-[var(--syn-text-primary)] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {componentConfig.tooltip}
          </div>
        </div>
      </div>
      <Input
        value={value || ""}
        onChange={handleChange}
        placeholder={componentConfig.placeholder}
      />
    </div>
  );
});

function PlanningFrameworkFields({
  framework,
  components,
  values,
  onChange,
}) {
  return (
    <PlanningSection
      title={`Framework ${framework}`}
      actions={<ProjectFrameworkBadge framework={framework} />}
    >
      {components.map((componentConfig) => (
        <PlanejamentoFrameworkField
          key={componentConfig.key}
          componentConfig={componentConfig}
          value={values[componentConfig.key]}
          onChange={onChange}
        />
      ))}
    </PlanningSection>
  );
}

export default memo(PlanningFrameworkFields);


