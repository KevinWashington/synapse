import { useEffect, useRef, useState } from "react";
import { DatabaseIcon, MessageSquareIcon, PenLineIcon } from "lucide-react";
import { ArticleChatPanel } from "@features/ai";
import ArticleEvidenceEditor from "@features/articles/components/ArticleEvidenceEditor";
import NotesEditor from "@features/articles/components/NotesEditor";
import { collaborativeReview } from "../utils/collaborativeReview";

const REVIEW_TABS = [
  {
    key: "notas",
    label: "Notas",
    icon: PenLineIcon,
  },
  {
    key: "chat",
    label: "Assistente IA",
    icon: MessageSquareIcon,
  },
];

const INCLUDED_TABS = [
  REVIEW_TABS[0],
  {
    key: "extracao",
    label: "Extração",
    icon: DatabaseIcon,
  },
  REVIEW_TABS[1],
];

function ArticleWorkspacePanel({
  activeFlow,
  article,
  project,
  onSaveEvidence,
  onSaveNotes,
  pdfData,
  rightTab,
  setRightTab,
  isSavingEvidence,
  chatSession,
}) {
  const notesRef = useRef(null);
  const [chatOpenedFor, setChatOpenedFor] = useState(null);
  const workspaceTabs = activeFlow === "included" ? INCLUDED_TABS : REVIEW_TABS;
  const review = collaborativeReview(article);
  const effectiveRightTab = workspaceTabs.some((tab) => tab.key === rightTab)
    ? rightTab
    : "notas";

  useEffect(() => {
    if (effectiveRightTab !== rightTab) {
      setRightTab(effectiveRightTab);
    }
  }, [effectiveRightTab, rightTab, setRightTab]);

  useEffect(() => {
    if (effectiveRightTab === "chat") setChatOpenedFor(article.id);
  }, [effectiveRightTab, article.id]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--syn-bg-primary)]">
      <div className="flex shrink-0 flex-wrap gap-1 border-b border-[var(--syn-border)] p-2">
        {workspaceTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = effectiveRightTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRightTab(tab.key)}
              aria-pressed={isActive}
              className={`relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[var(--syn-sidebar-accent)]"
                  : "text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)] hover:text-[var(--syn-text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {isActive ? (
                <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-[var(--syn-sidebar-accent)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {review.writeExplanation ? <p className="border-b border-[var(--syn-border)] p-3 text-xs text-[var(--syn-text-secondary)]">{review.writeExplanation}</p> : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div hidden={effectiveRightTab !== "notas"} className="h-full">
          <NotesEditor key={article.id} ref={notesRef} valorInicial={article?.notas} onSalvar={onSaveNotes} readOnly={!review.canWrite} />
        </div>
        {effectiveRightTab === "extracao" ? (
          <ArticleEvidenceEditor
            article={article}
            project={project}
            isSaving={isSavingEvidence}
            onSave={onSaveEvidence}
            readOnly={!review.canWrite}
          />
        ) : null}
        <div hidden={effectiveRightTab !== "chat"} className="h-full">
          {effectiveRightTab === "chat" || chatOpenedFor === article.id ? <ArticleChatPanel
            key={article.id}
            session={chatSession}
            article={article}
            onAddNote={review.canWrite ? (content) => {
              const saving = notesRef.current?.append(content);
              setRightTab("notas");
              return saving;
            } : undefined}
            pdfData={pdfData}
          /> : null}
        </div>
      </div>
    </div>
  );
}

export default ArticleWorkspacePanel;
