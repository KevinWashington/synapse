import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

function ArticleAIBanner({ article, onAccept, onExclude }) {
  if (!article?.aiEvaluation) {
    return null;
  }

  return (
    <div className="mb-4 flex items-center gap-4 rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-4 py-3 shadow-[var(--syn-shadow-card)]">
      <div className="flex shrink-0 items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--syn-sidebar-accent)]" />
        <span className="text-xs font-semibold text-[var(--syn-text-primary)]">IA</span>
      </div>
      <div
        className={`shrink-0 text-xl font-bold ${
          article.aiSuggestedStatus === "incluido" ? "text-emerald-600" : "text-red-500"
        }`}
      >
        {article.aiRelevanceScore}%
      </div>
      <div className="h-6 w-px bg-[var(--syn-border)]" />
      <p
        className="flex-1 truncate text-sm text-[var(--syn-text-secondary)]"
        title={article.aiEvaluation}
      >
        {article.aiEvaluation}
      </p>
      {article.status === "pendente" && (
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-emerald-200 text-xs hover:bg-emerald-50 hover:text-emerald-700"
            onClick={onAccept}
          >
            <CheckCircle2 className="h-3 w-3" />
            Aceitar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-red-200 text-xs hover:bg-red-50 hover:text-red-700"
            onClick={onExclude}
          >
            <XCircle className="h-3 w-3" />
            Excluir
          </Button>
        </div>
      )}
    </div>
  );
}

export default ArticleAIBanner;
