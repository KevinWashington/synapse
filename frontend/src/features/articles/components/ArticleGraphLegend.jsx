import { LINK_COLORS } from "@features/articles/utils/articleGraph";

function ArticleGraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs">
      {Object.entries(LINK_COLORS).map(([type, color]) => (
        <div key={type} className="flex items-center gap-1.5">
          <div
            className="h-0.5 w-4 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="capitalize text-[var(--syn-text-secondary)]">
            {type.replace(/-/g, " ").replace("same ", "mesmo ")}
          </span>
        </div>
      ))}

      <div className="h-3 w-px bg-[var(--syn-border)]" />

      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-[var(--syn-text-secondary)]">Analisado</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-red-500" />
        <span className="text-[var(--syn-text-secondary)]">Excluído</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-amber-500" />
        <span className="text-[var(--syn-text-secondary)]">Pendente</span>
      </div>
    </div>
  );
}

export default ArticleGraphLegend;
