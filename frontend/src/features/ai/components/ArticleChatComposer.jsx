import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

function ArticleChatComposer({
  input,
  isLoading,
  onInputChange,
  onSend,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
  }, [input]);

  return (
    <div className="border-t border-[var(--syn-border)] p-3">
      <form onSubmit={onSend} className="flex items-end gap-2">
        <div className="flex-1">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend(event);
              }
            }}
            placeholder="Pergunte sobre o artigo..."
            className="max-h-20 resize-none rounded-xl border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] text-sm"
            rows={1}
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl"
          disabled={!input.trim() || isLoading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

export default ArticleChatComposer;
