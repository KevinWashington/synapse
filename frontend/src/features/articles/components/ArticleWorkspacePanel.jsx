import { useEffect } from "react";
import { DatabaseIcon, MessageSquareIcon, PenLineIcon } from "lucide-react";
import { ArticleChatPanel } from "@features/ai";
import ArticleEvidenceEditor from "@features/articles/components/ArticleEvidenceEditor";
import NotesEditor from "@features/articles/components/NotesEditor";

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
    label: "Extracao",
    icon: DatabaseIcon,
  },
  REVIEW_TABS[1],
];

function ArticleWorkspacePanel({
  activeFlow,
  article,
  project,
  onAddNote,
  onSaveEvidence,
  onSaveNotes,
  pdfData,
  rightTab,
  setRightTab,
  isSavingEvidence,
}) {
  const workspaceTabs = activeFlow === "included" ? INCLUDED_TABS : REVIEW_TABS;
  const effectiveRightTab = workspaceTabs.some((tab) => tab.key === rightTab)
    ? rightTab
    : "notas";

  useEffect(() => {
    if (effectiveRightTab !== rightTab) {
      setRightTab(effectiveRightTab);
    }
  }, [effectiveRightTab, rightTab, setRightTab]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)]">
      <div className="flex shrink-0 flex-wrap gap-1 border-b border-[var(--syn-border)] p-2">
        {workspaceTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = effectiveRightTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRightTab(tab.key)}
              className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--syn-bg-secondary)] text-[var(--syn-text-primary)]"
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

      <div className="min-h-0 flex-1 overflow-hidden">
        {effectiveRightTab === "notas" ? (
          <NotesEditor valorInicial={article?.notas} onSalvar={onSaveNotes} />
        ) : effectiveRightTab === "extracao" ? (
          <ArticleEvidenceEditor
            article={article}
            project={project}
            isSaving={isSavingEvidence}
            onSave={onSaveEvidence}
          />
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
