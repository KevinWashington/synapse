import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import ScreeningDecisionForm from "./ScreeningDecisionForm";

function ScreeningDecisionDialog({
  article,
  initialDecision = "included",
  isOpen,
  isSaving,
  onClose,
  onSubmit,
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Decisão de triagem</DialogTitle>
          <DialogDescription>{article?.title || "Registro selecionado"}</DialogDescription>
        </DialogHeader>
        <ScreeningDecisionForm
          article={article}
          aiCopyLabel="Copiar justificativa da IA"
          initialDecision={initialDecision}
          isSaving={isSaving}
          onSubmit={onSubmit}
          secondaryAction={(
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}

export default ScreeningDecisionDialog;
