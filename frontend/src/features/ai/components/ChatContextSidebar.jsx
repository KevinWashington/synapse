import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

function ChatContextSidebar({
  projects,
  selectedProjectId,
  setSelectedProjectId,
}) {
  return (
    <div className="hidden h-full min-h-0 w-[260px] flex-shrink-0 flex-col gap-4 overflow-y-auto rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4 dark:bg-[var(--syn-bg-primary)] lg:flex">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
        Contexto
      </h3>

      <div className="space-y-2">
        <label className="text-xs text-[var(--syn-text-secondary)]">Projeto ativo</label>
        <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => setSelectedProjectId("")}
            className={cn(
              "w-full rounded-lg border p-2 text-left transition-colors",
              selectedProjectId
                ? "border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] hover:bg-[var(--syn-bg-tertiary)]"
                : "border-emerald-500/40 bg-emerald-500/10"
            )}
          >
            <p className="text-xs font-semibold text-[var(--syn-text-primary)]">Sem projeto</p>
            <p className="text-[10px] text-[var(--syn-text-secondary)]">Chat geral sem RAG</p>
          </button>

          {projects.map((project) => {
            const isActive = project.id.toString() === selectedProjectId;

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id.toString())}
                className={cn(
                  "w-full rounded-lg border p-2 text-left transition-colors",
                  isActive
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-[var(--syn-border)] bg-[var(--syn-bg-secondary)] hover:bg-[var(--syn-bg-tertiary)]"
                )}
              >
                <p className="line-clamp-2 text-xs font-semibold text-[var(--syn-text-primary)]">
                  {project.title}
                </p>
                <p className="text-[10px] text-[var(--syn-text-secondary)]">Usar contexto deste projeto</p>
              </button>
            );
          })}
        </div>
      </div>

      {selectedProjectId && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
            <BookOpen className="h-4 w-4 flex-shrink-0 text-emerald-500" />
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Modo RAG ativo
              </p>
              <p className="text-[10px] text-[var(--syn-text-secondary)]">
                Respostas baseadas nos artigos
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatContextSidebar;
