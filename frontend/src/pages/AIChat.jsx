import {
  ChatContextSidebar,
  ChatConversationPanel,
  useAIChatPage,
} from "@/features/ai";
import { usePageTitle } from "@hooks/usePageTitle";

function AIChatPage() {
  const {
    aiProvider,
    handleSend,
    input,
    isLoading,
    messages,
    modelLabel,
    projects,
    selectedProjectId,
    setInput,
    setSelectedProjectId,
  } = useAIChatPage();

  usePageTitle({ title: "Chat IA" });

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-4">
      <div className="flex min-h-0 flex-1 gap-4">
        <ChatConversationPanel
          handleSend={handleSend}
          input={input}
          isLoading={isLoading}
          messages={messages}
          modelLabel={modelLabel}
          selectedProjectId={selectedProjectId}
          setInput={setInput}
        />

        <ChatContextSidebar
          aiProvider={aiProvider}
          modelLabel={modelLabel}
          projects={projects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
        />
      </div>
    </div>
  );
}

export default AIChatPage;

