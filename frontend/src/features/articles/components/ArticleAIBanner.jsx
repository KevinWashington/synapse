import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

function ArticleAIBanner({ article, onApplySuggestion, onReviewManually }) {
  if (!article?.aiEvaluation) {
    return null;
  }

  const isSuggestedIncluded = article.aiSuggestedStatus !== "excluido";
  const suggestionLabel = isSuggestedIncluded
    ? "Sugestao: incluir na triagem"
    : "Sugestao: excluir na triagem";

  return (
    <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] px-4 py-3 shadow-[var(--syn-shadow-card)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--syn-sidebar-accent)]" />
          <span className="text-xs font-semibold text-[var(--syn-text-primary)]">IA</span>
        </div>
        <div
          className={`shrink-0 text-xl font-bold ${
            isSuggestedIncluded ? "text-emerald-600" : "text-red-500"
          }`}
        >
          {article.aiRelevanceScore != null ? `${article.aiRelevanceScore}%` : "-"}
        </div>
        <div className="hidden h-6 w-px bg-[var(--syn-border)] lg:block" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--syn-text-primary)]">{suggestionLabel}</p>
          <p
            className="mt-1 text-sm text-[var(--syn-text-secondary)]"
            title={article.aiEvaluation}
          >
            {article.aiEvaluation}
          </p>
        </div>
      </div>

      {(article.aiSuggestedRQs || []).length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {article.aiSuggestedRQs.map((rqNumber) => (
            <span
              key={`ai-rq-${article.id || "article"}-${rqNumber}`}
              className="rounded bg-[var(--syn-bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--syn-text-secondary)]"
            >
              {`RQ ${rqNumber}`}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="gap-1"
          onClick={onApplySuggestion}
        >
          <CheckCircle2 className="h-3 w-3" />
          Aplicar sugestao
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReviewManually}
        >
          Revisar manualmente
        </Button>
      </div>
    </div>
  );
}

export default ArticleAIBanner;
