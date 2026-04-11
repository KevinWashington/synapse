import { memo, useCallback, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

function PlanningArrayField({
  fieldKey,
  items = [],
  label,
  placeholder,
  isLongText = false,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
}) {
  const [input, setInput] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState("");

  const handleAdd = useCallback(() => {
    const trimmedValue = input.trim();
    if (!trimmedValue) {
      return;
    }

    onAddItem(fieldKey, trimmedValue);
    setInput("");
  }, [fieldKey, input, onAddItem]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" && !event.shiftKey && !isLongText) {
        event.preventDefault();
        handleAdd();
      }
    },
    [handleAdd, isLongText]
  );

  const handleStartEditing = useCallback((index, value) => {
    setEditingIndex(index);
    setEditValue(value);
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingIndex(null);
    setEditValue("");
  }, []);

  const handleSaveEdit = useCallback(() => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue || editingIndex === null) {
      return;
    }

    onUpdateItem(fieldKey, editingIndex, trimmedValue);
    handleCancelEditing();
  }, [editValue, editingIndex, fieldKey, handleCancelEditing, onUpdateItem]);

  const handleEditInputKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter") {
        handleSaveEdit();
      }

      if (event.key === "Escape") {
        handleCancelEditing();
      }
    },
    [handleCancelEditing, handleSaveEdit]
  );

  return (
    <div className="space-y-3">
      <Label className="text-[var(--syn-text-primary)]">{label}</Label>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${fieldKey}-${index}`} className="space-y-1">
              {editingIndex === index ? (
                <div className="flex gap-2">
                  {isLongText ? (
                    <Textarea
                      className="flex-1 min-h-[80px]"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      autoFocus
                    />
                  ) : (
                    <Input
                      className="flex-1"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      onKeyDown={handleEditInputKeyDown}
                      autoFocus
                    />
                  )}
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-green-600"
                      onClick={handleSaveEdit}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500"
                      onClick={handleCancelEditing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1 group">
                  <div
                    className="flex-1 p-2 px-3 rounded-lg bg-[var(--syn-bg-secondary)] text-sm text-[var(--syn-text-primary)] border border-transparent group-hover:border-[var(--syn-border)] transition-all cursor-pointer"
                    onClick={() => handleStartEditing(index, item)}
                  >
                    {item}
                  </div>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEditing(index, item)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveItem(fieldKey, index)}
                      className="h-8 w-8 p-0 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {isLongText ? (
          <Textarea
            placeholder={placeholder}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="flex-1 min-h-[60px]"
          />
        ) : (
          <Input
            placeholder={placeholder}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
        )}
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="h-auto"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default memo(PlanningArrayField);


