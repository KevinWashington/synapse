import { MessageSquareIcon, PenLineIcon } from "lucide-react";
import { ArticleChatPanel } from "@features/ai";
import NotesEditor from "@features/articles/components/NotesEditor";

function ArticleWorkspacePanel({
  article,
  onAddNote,
  onSaveNotes,
  pdfData,
  rightTab,
  setRightTab,
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)]">
      <div className="flex shrink-0 border-b border-[var(--syn-border)]">
        <button
          onClick={() => setRightTab("notas")}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            rightTab === "notas"
              ? "text-[var(--syn-text-primary)]"
              : "text-[var(--syn-text-secondary)] hover:text-[var(--syn-text-primary)]"
          }`}
        >
          <PenLineIcon className="h-4 w-4" />
          Notas
          {rightTab === "notas" && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--syn-sidebar-accent)]" />
          )}
        </button>
        <button
          onClick={() => setRightTab("chat")}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            rightTab === "chat"
              ? "text-[var(--syn-text-primary)]"
              : "text-[var(--syn-text-secondary)] hover:text-[var(--syn-text-primary)]"
          }`}
        >
          <MessageSquareIcon className="h-4 w-4" />
          Assistente IA
          {rightTab === "chat" && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--syn-sidebar-accent)]" />
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {rightTab === "notas" ? (
          <NotesEditor valorInicial={article.notas} onSalvar={onSaveNotes} />
        ) : (
          <ArticleChatPanel
            article={article}
            onAddNote={onAddNote}
            pdfData={pdfData}
          />
        )}
      </div>
    </div>
  );
}

export default ArticleWorkspacePanel;

