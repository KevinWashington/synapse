import { Button } from "@/components/ui/Button";

function ProviderConfigPanel({ children, isExpanded, onToggle, title }) {
  return (
    <div className="rounded-lg border bg-muted/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>

        <Button variant="outline" size="sm" onClick={onToggle}>
          {isExpanded ? "Ocultar" : "Configurar"}
        </Button>
      </div>

      {isExpanded ? <div className="space-y-3">{children}</div> : null}
    </div>
  );
}

export default ProviderConfigPanel;
