import { useEffect, useRef } from "react";
import { PlusCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

function ArticleChatMessages({
  error,
  isLoading,
  messages,
  onAddToNotes,
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
            className={`relative max-w-[80%] ${message.role === "assistant" ? "group/message" : ""}`}
          >
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "rounded-br-md bg-[var(--syn-sidebar-bg)] text-white"
                  : "rounded-bl-md border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] text-[var(--syn-text-primary)]"
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

            {message.role === "assistant" && message.id !== "welcome" ? (
              <button
                type="button"
                className="absolute -right-9 top-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[var(--syn-text-secondary)] opacity-0 transition-all hover:bg-[var(--syn-badge-neutral-bg)] hover:text-[var(--syn-text-primary)] group-hover/message:opacity-100"
                onClick={() => onAddToNotes(message.content)}
                title="Adicionar às notas"
              >
                <PlusCircle className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {isLoading ? (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-md border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--syn-text-secondary)] [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--syn-text-secondary)] [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--syn-text-secondary)] [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-pink-200 bg-[var(--syn-badge-high-bg)] p-3">
          <span className="text-sm text-[var(--syn-badge-high-text)]">
            Erro: {error}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default ArticleChatMessages;
