import { Button } from "@/components/ui/Button";

function ArticleDialogFooter({
  cancelLabel = "Cancelar",
  confirmIcon,
  confirmLabel,
  disabled,
  loading,
  loadingLabel,
  onCancel,
}) {
  const Icon = confirmIcon;

  return (
    <div className="flex justify-end gap-2 pt-4">
      <Button type="button" variant="outline" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="submit" disabled={disabled}>
        {loading ? (
          loadingLabel
        ) : (
          <>
            {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
            {confirmLabel}
          </>
        )}
      </Button>
    </div>
  );
}

export default ArticleDialogFooter;
