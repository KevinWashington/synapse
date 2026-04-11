import { BookOpen, Bot } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

function ChatContextSidebar({
  aiProvider,
  modelLabel,
  projects,
  selectedProjectId,
  setSelectedProjectId,
}) {
  return (
    <div className="hidden w-[260px] flex-col gap-4 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-4 dark:bg-[var(--syn-bg-primary)] lg:flex">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
        Contexto
      </h3>

      <div className="space-y-2">
        <label className="text-xs text-[var(--syn-text-secondary)]">Projeto ativo</label>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-full text-xs">
            <SelectValue placeholder="Selecionar projeto" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id.toString()}>
                {project.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <div className="space-y-2">
        <label className="text-xs text-[var(--syn-text-secondary)]">Modelo ativo</label>
        <div className="flex items-center gap-2 rounded-lg bg-[var(--syn-bg-secondary)] p-2">
          <Bot className="h-4 w-4 text-[var(--syn-badge-blue-text)]" />
          <div>
            <p className="text-xs font-medium text-[var(--syn-text-primary)]">
              {aiProvider === "gemini" ? "Google Gemini" : "Ollama"}
            </p>
            <p className="text-[10px] text-[var(--syn-text-secondary)]">{modelLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatContextSidebar;
