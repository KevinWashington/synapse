import { Network, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  LINK_COLORS,
  RELATIONSHIP_FILTER_OPTIONS,
} from "@features/articles/utils/articleGraph";

const FILTER_COLOR_BY_VALUE = {
  semantic: LINK_COLORS["similar-to"],
  methodology: LINK_COLORS["same-methodology"],
  authors: LINK_COLORS["same-author"],
  keywords: LINK_COLORS["shares-keyword"],
  venue: LINK_COLORS["same-venue"],
  authored: LINK_COLORS.authored,
  "has-keyword": LINK_COLORS["has-keyword"],
  "published-in": LINK_COLORS["published-in"],
};

function getSelectedFilterLabel(value) {
  return (
    RELATIONSHIP_FILTER_OPTIONS.find((option) => option.value === value)?.label ||
    "Filtro"
  );
}

function ArticleGraphToolbar({
  graphStats,
  minSimilarity,
  nodeSearch,
  nodeSearchStatus,
  nodeSearchSuggestions,
  onSearchNode,
  relationshipType,
  setNodeSearch,
  setMinSimilarity,
  setRelationshipType,
}) {
  const suggestionListId = "graph-node-search-options";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-[var(--syn-text-secondary)]" />
        <span className="text-xs text-[var(--syn-text-secondary)]">
          {graphStats.articleNodes} artigos · {graphStats.nodes} nos · {graphStats.linksDisplayed}/
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
            <SelectTrigger id="relationship-type" className="h-10 w-64 text-left">
              <SelectValue>{getSelectedFilterLabel(relationshipType)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-start gap-2 py-0.5">
                    <span
                      className="mt-1 inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: FILTER_COLOR_BY_VALUE[option.value] || "#9CA3AF" }}
                    />
                    <div className="leading-tight">
                      <p className="text-xs font-medium text-[var(--syn-text-primary)]">{option.label}</p>
                      <p className="text-[10px] text-[var(--syn-text-secondary)]">
                        {option.description}
                      </p>
                    </div>
                  </div>
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

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSearchNode(nodeSearch);
        }}
      >
        <Label
          htmlFor="node-search"
          className="whitespace-nowrap text-xs text-[var(--syn-text-secondary)]"
        >
          Buscar nó:
        </Label>
        <Input
          id="node-search"
          value={nodeSearch}
          onChange={(event) => setNodeSearch(event.target.value)}
          placeholder="Título, autor, keyword, venue..."
          list={suggestionListId}
          className="h-9 w-[320px] max-w-full"
        />
        <datalist id={suggestionListId}>
          {nodeSearchSuggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <Button type="submit" size="sm" className="h-9 gap-1.5">
          <Search className="h-3.5 w-3.5" />
          Encontrar
        </Button>
        {nodeSearchStatus ? (
          <span className="text-xs text-[var(--syn-text-secondary)]">{nodeSearchStatus}</span>
        ) : null}
      </form>
    </div>
  );
}

export default ArticleGraphToolbar;
