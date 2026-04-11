import { Network } from "lucide-react";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { RELATIONSHIP_LABELS } from "@features/articles/utils/articleGraph";

function ArticleGraphToolbar({
  graphStats,
  minSimilarity,
  relationshipType,
  setMinSimilarity,
  setRelationshipType,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-[var(--syn-text-secondary)]" />
        <span className="text-xs text-[var(--syn-text-secondary)]">
          {graphStats.nodes} artigos · {graphStats.linksDisplayed}/
          {graphStats.linksTotal} relações · {graphStats.clusters} clusters
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="relationship-type"
            className="whitespace-nowrap text-xs text-[var(--syn-text-secondary)]"
          >
            Relação:
          </Label>
          <Select value={relationshipType} onValueChange={setRelationshipType}>
            <SelectTrigger id="relationship-type" className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {relationshipType === "all" || relationshipType === "semantic" ? (
          <div className="flex items-center gap-2">
            <Label
              htmlFor="min-similarity"
              className="whitespace-nowrap text-xs text-[var(--syn-text-secondary)]"
            >
              Min:
            </Label>
            <input
              id="min-similarity"
              type="range"
              min="0.1"
              max="0.95"
              step="0.01"
              value={minSimilarity}
              onChange={(event) => setMinSimilarity(Number.parseFloat(event.target.value))}
              className="w-20 accent-[var(--syn-sidebar-accent)]"
            />
            <span className="w-8 text-xs font-medium text-[var(--syn-text-secondary)]">
              {(minSimilarity * 100).toFixed(0)}%
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ArticleGraphToolbar;
