import { useEffect, useRef } from "react";
import { Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ReactMarkdown from "react-markdown";

function ArticleChatMessages({
  error,
  isLoading,
  messages,
  onAddToNotes,
  onRetry,
}) {
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [isLoading, messages]);

  return (
    <div
      ref={chatContainerRef}
      className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={message.role === "assistant" ? "min-w-0 w-full" : "min-w-0 max-w-[90%]"}
          >
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "rounded-br-md bg-[var(--syn-sidebar-accent)] text-white"
                  : "px-0 py-1 text-[var(--syn-text-primary)]"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="chat-markdown">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
            {message.sourceLabel ? <p className="mt-2 text-xs text-[var(--syn-text-secondary)]">Base da resposta: {message.sourceLabel}</p> : null}

            {message.role === "assistant" && message.id !== "welcome" && onAddToNotes ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 gap-2 text-[var(--syn-sidebar-accent)]"
                onClick={() => onAddToNotes(message.content)}
                title="Adicionar às notas"
              >
                <PlusCircle className="h-4 w-4" />
                Adicionar às notas
              </Button>
            ) : null}
          </div>
        </div>
      ))}

      {isLoading ? (
        <div role="status" className="flex items-center gap-2 rounded-lg bg-[var(--syn-bg-secondary)] p-3 text-sm text-[var(--syn-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparando resposta com as fontes disponíveis...
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="space-y-2 rounded-lg border border-pink-200 bg-[var(--syn-badge-high-bg)] p-3">
          <span className="text-sm text-[var(--syn-badge-high-text)]">
            Erro: {error}
          </span>
          {onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>Tentar novamente</Button> : null}
        </div>
      ) : null}
    </div>
  );
}

export default ArticleChatMessages;
