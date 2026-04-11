import ArticleChatComposer from "@features/ai/components/ArticleChatComposer";
import ArticleChatMessages from "@features/ai/components/ArticleChatMessages";
import useArticleChat from "@features/ai/hooks/useArticleChat";

function ArticleChatPanel({ article, onAddNote, pdfData }) {
  const {
    error,
    handleAddToNotes,
    handleSend,
    input,
    isLoading,
    messages,
    setInput,
  } = useArticleChat({
    article,
    onAddNote,
    pdfData,
  });

  return (
    <div className="flex h-full flex-col">
      <ArticleChatMessages
        error={error}
        isLoading={isLoading}
        messages={messages}
        onAddToNotes={handleAddToNotes}
      />

      <ArticleChatComposer
        input={input}
        isLoading={isLoading}
        onInputChange={setInput}
        onSend={handleSend}
      />
    </div>
  );
}

export default ArticleChatPanel;
