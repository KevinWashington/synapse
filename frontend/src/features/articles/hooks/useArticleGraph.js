import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { articleService } from "@features/articles/services/articleService";
import {
  ARTICLE_GRAPH_LAYOUT,
  ARTICLE_GRAPH_STYLE,
  spreadIsolatedNodes,
  toCytoscapeElements,
} from "@features/articles/utils/articleGraph";

function useArticleGraph({ graphRefreshToken = 0, projectId }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [relationshipType, setRelationshipType] = useState("semantic");
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodeSearchStatus, setNodeSearchStatus] = useState("");
  const [minSimilarity, setMinSimilarity] = useState(0.7);
  const [debouncedSimilarity, setDebouncedSimilarity] = useState(0.7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const graphRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const lastRefreshTokenRef = useRef(graphRefreshToken);

  useEffect(() => {
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSimilarity(minSimilarity);
    }, 500);

    return () => clearTimeout(debounceTimerRef.current);
  }, [minSimilarity]);

  const fetchGraphData = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await articleService.getProjectGraph(projectId, {
        relationshipType,
        minSimilarity: debouncedSimilarity,
      });

      setGraphData(data);
    } catch (requestError) {
      console.error("Erro ao buscar dados do grafo:", requestError);
      setError("Não foi possível carregar o grafo de relacionamentos.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSimilarity, projectId, relationshipType]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  useEffect(() => {
    if (graphRefreshToken === lastRefreshTokenRef.current) {
      return;
    }

    lastRefreshTokenRef.current = graphRefreshToken;
    fetchGraphData();
  }, [fetchGraphData, graphRefreshToken]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const hasNode = graphData.nodes.some(
      (node) => String(node.id) === String(selectedNodeId)
    );

    if (!hasNode) {
      setSelectedNodeId(null);
    }
  }, [graphData.nodes, selectedNodeId]);

  const graphModel = useMemo(
    () => toCytoscapeElements(graphData, relationshipType),
    [graphData, relationshipType]
  );

  const visibleNodeElements = useMemo(
    () => graphModel.elements.filter((element) => !element.data.source),
    [graphModel]
  );

  const nodeSearchSuggestions = useMemo(() => {
    const seen = new Set();
    const suggestions = [];

    visibleNodeElements.forEach((element) => {
      const title = String(element.data.title || "").trim();
      if (!title) {
        return;
      }

      const normalized = title.toLowerCase();
      if (seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      suggestions.push(title);
    });

    return suggestions.slice(0, 80);
  }, [visibleNodeElements]);

  const graphStats = useMemo(() => {
    const nodeElements = graphModel.elements.filter(
      (element) => !element.data.source
    );
    const articleNodes = nodeElements.filter(
      (node) => String(node.data.kind || "article") === "article"
    );
    const clusterIds = new Set(
      nodeElements.map((node) => String(node.data.clusterId ?? 0))
    );

    return {
      articleNodes: articleNodes.length,
      clusters: clusterIds.size,
      linksDisplayed: graphModel.stats.displayedLinks,
      linksTotal: graphModel.stats.totalLinks,
      nodes: nodeElements.length,
    };
  }, [graphModel]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }

    return (
      graphData.nodes.find(
        (node) => String(node.id) === String(selectedNodeId)
      ) || null
    );
  }, [graphData.nodes, selectedNodeId]);

  const handleCyInit = useCallback((cy) => {
    graphRef.current = cy;
    cy.minZoom(0.35);
    cy.maxZoom(2.4);

    cy.off("tap", "node");
    cy.off("tap");

    cy.on("tap", "node", (event) => {
      const node = event.target;
      const relatedElements = node.closedNeighborhood();

      setSelectedNodeId(node.id());
      cy.animate(
        {
          fit: {
            eles: relatedElements,
            padding: 140,
          },
        },
        { duration: 350 }
      );
    });

    cy.on("tap", (event) => {
      if (event.target !== cy) {
        return;
      }

      setSelectedNodeId(null);
      cy.animate(
        {
          fit: {
            eles: cy.elements(),
            padding: 170,
          },
        },
        { duration: 350 }
      );
    });
  }, []);

  useEffect(() => {
    const cy = graphRef.current;

    if (!cy) {
      return;
    }

    const layout = cy.layout({
      ...ARTICLE_GRAPH_LAYOUT,
      stop: () => {
        spreadIsolatedNodes(cy);

        if (!selectedNodeId) {
          cy.fit(cy.elements(), 170);
        }
      },
    });

    layout.run();
  }, [graphModel.elements, selectedNodeId]);

  useEffect(() => {
    const cy = graphRef.current;

    if (!cy) {
      return;
    }

    cy.elements().removeClass("faded");
    cy.elements().removeClass("highlight");

    if (!selectedNodeId) {
      return;
    }

    const selectedNodeElement = cy.getElementById(String(selectedNodeId));

    if (!selectedNodeElement || selectedNodeElement.empty()) {
      return;
    }

    const relatedElements = selectedNodeElement.closedNeighborhood();
    cy.elements().addClass("faded");
    relatedElements.removeClass("faded").addClass("highlight");
  }, [selectedNodeId]);

  const zoomToLevel = useCallback((level) => {
    const cy = graphRef.current;

    if (!cy) {
      return;
    }

    cy.zoom({
      level,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    const cy = graphRef.current;

    if (!cy) {
      return;
    }

    zoomToLevel(Math.min(cy.maxZoom(), cy.zoom() * 1.2));
  }, [zoomToLevel]);

  const handleZoomOut = useCallback(() => {
    const cy = graphRef.current;

    if (!cy) {
      return;
    }

    zoomToLevel(Math.max(cy.minZoom(), cy.zoom() / 1.2));
  }, [zoomToLevel]);

  const handleZoomReset = useCallback(() => {
    const cy = graphRef.current;

    if (!cy) {
      return;
    }

    cy.fit(cy.elements(), 140);
  }, []);

  const handleSearchNode = useCallback(
    (queryValue) => {
      const searchTerm = String(queryValue ?? nodeSearch)
        .trim()
        .toLowerCase();

      if (!searchTerm) {
        setNodeSearchStatus("Digite um termo para buscar.");
        return false;
      }

      const rankedMatches = visibleNodeElements
        .map((element) => {
          const title = String(element.data.title || "");
          const kind = String(element.data.kind || "");
          const metadata = [
            title,
            String(element.data.authors || ""),
            String(element.data.methodology || ""),
            String(element.data.domain || ""),
            String(element.data.year || ""),
            String(element.data.id || ""),
          ]
            .join(" ")
            .toLowerCase();

          if (!metadata.includes(searchTerm)) {
            return null;
          }

          const titleLower = title.toLowerCase();
          const exactTitle = titleLower === searchTerm ? 0 : 1;
          const startsWithTitle = titleLower.startsWith(searchTerm) ? 0 : 1;
          const kindPriority = kind === "article" ? 0 : 1;
          const index = metadata.indexOf(searchTerm);

          return {
            element,
            score: [exactTitle, startsWithTitle, kindPriority, index],
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          for (let i = 0; i < a.score.length; i += 1) {
            if (a.score[i] !== b.score[i]) {
              return a.score[i] - b.score[i];
            }
          }
          return 0;
        });

      if (rankedMatches.length === 0) {
        setNodeSearchStatus("Nenhum nó encontrado no filtro atual.");
        return false;
      }

      const bestMatch = rankedMatches[0].element;
      const matchId = String(bestMatch.data.id);
      setSelectedNodeId(matchId);
      setNodeSearchStatus(`Nó encontrado: ${bestMatch.data.title}`);

      const cy = graphRef.current;
      if (cy) {
        const selected = cy.getElementById(matchId);
        if (selected && !selected.empty()) {
          cy.animate(
            {
              fit: {
                eles: selected.closedNeighborhood(),
                padding: 140,
              },
            },
            { duration: 320 }
          );
        }
      }

      return true;
    },
    [nodeSearch, visibleNodeElements]
  );

  useEffect(() => {
    if (!nodeSearchStatus) {
      return;
    }

    const timer = setTimeout(() => {
      setNodeSearchStatus("");
    }, 3500);

    return () => clearTimeout(timer);
  }, [nodeSearchStatus]);

  return {
    error,
    graphData,
    graphElements: graphModel.elements,
    graphStats,
    graphStyle: ARTICLE_GRAPH_STYLE,
    handleCyInit,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    layoutConfig: ARTICLE_GRAPH_LAYOUT,
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
  };
}

export default useArticleGraph;
