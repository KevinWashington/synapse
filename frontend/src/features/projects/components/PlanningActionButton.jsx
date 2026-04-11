import { memo } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

function PlanningActionButton({
  disabled,
  loading,
  label = "Gerar com IA",
  onClick,
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="gap-2 text-xs"
    >
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...
        </>
      ) : (
        <>
          <Sparkles className="w-3.5 h-3.5" /> {label}
        </>
      )}
    </Button>
  );
}

export default memo(PlanningActionButton);


