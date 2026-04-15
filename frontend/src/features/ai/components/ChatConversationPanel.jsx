import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Loader2, Send, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import ChatSourcesPanel from "@features/ai/components/ChatSourcesPanel";
import ChatAgentTracePanel from "@features/ai/components/ChatAgentTracePanel";

function ChatConversationPanel({
  handleSend,
  input,
  isLoading,
  messages,
  selectedProjectId,
  setInput,
}) {
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] dark:bg-[var(--syn-bg-primary)]">
      <div ref={chatContainerRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                message.role === "user"
                  ? "bg-[var(--syn-sidebar-bg)] text-white"
                  : "bg-[var(--syn-badge-blue-bg)]"
              }`}
            >
              {message.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4 text-[var(--syn-badge-blue-text)]" />
              )}
            </div>

            <div className="min-w-0 max-w-[75%]">
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "rounded-tr-sm bg-[var(--syn-sidebar-bg)] text-white"
                    : "rounded-tl-sm border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] text-[var(--syn-text-primary)]"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="mb-1 flex items-center gap-1.5">
                    <StatusBadge
                      variant="blue"
                      label="Assistente de revisao"
                      className="px-1.5 py-0 text-[10px]"
                    />
                  </div>
                )}

                {message.role === "assistant" ? (
                  <div className="chat-markdown">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
              </div>

              <ChatSourcesPanel
                sources={message.sources}
                projectId={selectedProjectId}
              />

              {message.role === "assistant" && (
                <ChatAgentTracePanel
                  provenance={message.provenance}
                  selectedProjectId={selectedProjectId}
                />
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--syn-badge-blue-bg)]">
              <Bot className="h-4 w-4 text-[var(--syn-badge-blue-text)]" />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--syn-text-secondary)]" />
                <span className="text-xs text-[var(--syn-text-secondary)]">
                  {selectedProjectId ? "Pensando e selecionando tools..." : "Processando..."}
                </span>
              </div>

              <ChatAgentTracePanel
                isLoading
                selectedProjectId={selectedProjectId}
              />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-[var(--syn-border)] p-3">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            selectedProjectId
              ? "Pergunte sobre os artigos do projeto..."
              : "Digite sua pergunta..."
          }
          className="min-h-[40px] max-h-[120px] resize-none"
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          className="h-10 w-10 flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

export default ChatConversationPanel;
