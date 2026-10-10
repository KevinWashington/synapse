import ArticleChatComposer from "@features/ai/components/ArticleChatComposer";
import ArticleChatMessages from "@features/ai/components/ArticleChatMessages";
import useArticleChat from "@features/ai/hooks/useArticleChat";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

const SUGGESTIONS = [
  ["Resumir estudo", "Resuma o objetivo, método e principais achados disponíveis. Separe o que está documentado do que não pode ser verificado."],
  ["Explicar método", "Explique o método descrito neste estudo e suas limitações, com base nas evidências disponíveis."],
  ["Localizar evidências", "Localize trechos que sustentem os principais achados, indicando a fonte de cada citação literal."],
];

function ArticleChatView({ session, onAddNote }) {
  const {
    error,
    handleSend,
    input,
    isLoading,
    messages,
    setInput,
    source,
    retrySend,
    retryPdf,
  } = session;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--syn-text-primary)]" aria-live="polite">
          {source.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {source.label}
        </div>
        <p className="text-xs leading-5 text-[var(--syn-text-secondary)]">{source.detail}</p>
        {retryPdf ? <Button variant="outline" size="sm" onClick={retryPdf}>Tentar ler PDF novamente</Button> : null}
        {messages.length === 1 ? <div className="flex flex-wrap gap-2 pt-1">
          {SUGGESTIONS.map(([label, question]) => <Button key={label} variant="outline" size="sm"
            disabled={source.loading || isLoading} onClick={() => setInput(question)}>{label}</Button>)}
        </div> : null}
      </div>
      <ArticleChatMessages
        error={error}
        isLoading={isLoading}
        messages={messages}
        onAddToNotes={onAddNote}
        onRetry={retrySend}
      />

      <ArticleChatComposer
        input={input}
        isLoading={isLoading}
        disabled={source.loading}
        onInputChange={setInput}
        onSend={handleSend}
      />
    </div>
  );
}

function StandaloneArticleChatPanel(props) {
  const session = useArticleChat(props);
  return <ArticleChatView session={session} onAddNote={props.onAddNote} />;
}

export default function ArticleChatPanel(props) {
  return props.session
    ? <ArticleChatView session={props.session} onAddNote={props.onAddNote} />
    : <StandaloneArticleChatPanel {...props} />;
}
