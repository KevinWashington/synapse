import { AlertCircle, Loader2, Network } from "lucide-react";
import ArticleGraphLegend from "@features/articles/components/ArticleGraphLegend";
import ArticleGraphNodeDetails from "@features/articles/components/ArticleGraphNodeDetails";
import ArticleGraphState from "@features/articles/components/ArticleGraphState";
import ArticleGraphToolbar from "@features/articles/components/ArticleGraphToolbar";
import ArticleGraphViewport from "@features/articles/components/ArticleGraphViewport";
import useArticleGraph from "@features/articles/hooks/useArticleGraph";

export function ArticleGraph({ projectId, graphRefreshToken = 0 }) {
  const {
    error,
    graphData,
    graphElements,
    graphStats,
    graphStyle,
    handleCyInit,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    layoutConfig,
    loading,
    minSimilarity,
    nodeSearch,
    nodeSearchStatus,
    nodeSearchSuggestions,
    relationshipType,
    selectedNode,
    handleSearchNode,
    setNodeSearch,
    setMinSimilarity,
    setRelationshipType,
  } = useArticleGraph({
    graphRefreshToken,
    projectId,
  });

  if (loading) {
    return (
      <ArticleGraphState>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-[var(--syn-text-secondary)]">
          Carregando grafo...
        </span>
      </ArticleGraphState>
    );
  }

  if (error) {
    return (
      <ArticleGraphState tone="error">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <span className="ml-3 text-destructive">{error}</span>
      </ArticleGraphState>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <ArticleGraphState>
        <div className="flex flex-col items-center justify-center">
          <Network className="mb-4 h-16 w-16 text-[var(--syn-text-secondary)]/50" />
          <p className="text-center text-[var(--syn-text-secondary)]">
            Nenhum artigo encontrado.
            <br />
            Adicione artigos ao projeto para visualizar o grafo de relacionamentos.
          </p>
        </div>
      </ArticleGraphState>
    );
  }

  return (
    <div className="space-y-4">
      <ArticleGraphToolbar
        graphStats={graphStats}
        minSimilarity={minSimilarity}
        nodeSearch={nodeSearch}
        nodeSearchStatus={nodeSearchStatus}
        nodeSearchSuggestions={nodeSearchSuggestions}
        onSearchNode={handleSearchNode}
        relationshipType={relationshipType}
        setNodeSearch={setNodeSearch}
        setMinSimilarity={setMinSimilarity}
        setRelationshipType={setRelationshipType}
      />

      <ArticleGraphLegend />

      <ArticleGraphViewport
        elements={graphElements}
        handleCyInit={handleCyInit}
        layout={layoutConfig}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        stylesheet={graphStyle}
      />

      <ArticleGraphNodeDetails selectedNode={selectedNode} />
    </div>
  );
}

export default ArticleGraph;

