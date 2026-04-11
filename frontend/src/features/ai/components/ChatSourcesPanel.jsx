import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronDown, ChevronRight, FileText } from "lucide-react";

function ChatSourcesPanel({ projectId, sources }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-[var(--syn-border)]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 bg-[var(--syn-bg-secondary)] px-3 py-2 text-left transition-colors hover:bg-[var(--syn-bg-primary)]"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-[var(--syn-text-secondary)]" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-[var(--syn-text-secondary)]" />
        )}
        <BookOpen className="h-3 w-3 flex-shrink-0 text-[var(--syn-text-secondary)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--syn-text-secondary)]">
          Fontes ({sources.length} artigos)
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-1 bg-[var(--syn-bg-secondary)]/50 p-2">
          {sources.map((source) => (
            <Link
              key={source.id}
              to={`/projetos/${projectId}/artigos/${source.id}`}
              className="group flex items-start gap-2 rounded-md p-1.5 transition-colors hover:bg-[var(--syn-bg-primary)]"
            >
              <FileText className="mt-0.5 h-3 w-3 flex-shrink-0 text-[var(--syn-badge-blue-text)]" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--syn-text-primary)] transition-colors group-hover:text-[var(--syn-badge-blue-text)]">
                  {source.title}
                </p>
                <p className="text-[10px] text-[var(--syn-text-secondary)]">
                  {source.authors && source.authors.length > 50
                    ? `${source.authors.substring(0, 50)}...`
                    : source.authors}
                  {source.year ? ` (${source.year})` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChatSourcesPanel;
