import React, { useState, useEffect, useRef, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  LoaderIcon,
  AlertTriangleIcon,
  NetworkIcon,
  RefreshCwIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  MinimizeIcon,
} from "lucide-react";
import { articleService } from "../services/artigosService";

function GrafoRelacionamentos({
  projetoId,
  highlightedNodeId = null,
  onNodeClick = null,
  className = "",
}) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const graphRef = useRef();

  const fetchGraphData = useCallback(async () => {
    if (!projetoId) return;

    try {
      setLoading(true);
      setError(null);

      const data = await articleService.getProjectGraph(projetoId);

      const nodes = data.nodes.map((node) => ({
        id: node.id,
        title: node.title,
        authors: node.authors,
        year: node.year,
        journal: node.journal,
        status: node.status,
        val: 5,
        color: getNodeColor(node.status),
      }));

      const links = data.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        color: "#999",
        width: 2,
      }));

      setGraphData({ nodes, links });
    } catch (err) {
      console.error("Erro ao carregar grafo:", err);
      setError("Erro ao carregar grafo de relacionamentos");
    } finally {
      setLoading(false);
    }
  }, [projetoId]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const getNodeColor = (status) => {
    switch (status) {
      case "analisado":
        return "#22c55e";
      case "pendente":
        return "#eab308";
      case "excluido":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const handleNodeClick = useCallback(
    (node) => {
      setSelectedNode(node);
      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [onNodeClick]
  );

  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());

  const handleNodeHover = useCallback(
    (node) => {
      const newHighlightNodes = new Set();
      const newHighlightLinks = new Set();

      if (node) {
        newHighlightNodes.add(node);
        graphData.links.forEach((link) => {
          if (
            link.source === node ||
            link.target === node ||
            (typeof link.source === "object" && link.source.id === node.id) ||
            (typeof link.target === "object" && link.target.id === node.id)
          ) {
            newHighlightLinks.add(link);
            const sourceNode =
              typeof link.source === "object"
                ? link.source
                : graphData.nodes.find((n) => n.id === link.source);
            const targetNode =
              typeof link.target === "object"
                ? link.target
                : graphData.nodes.find((n) => n.id === link.target);
            if (sourceNode) newHighlightNodes.add(sourceNode);
            if (targetNode) newHighlightNodes.add(targetNode);
          }
        });
      }

      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);
    },
    [graphData]
  );

  const handleZoomIn = () => {
    if (graphRef.current && graphRef.current.zoom) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.5);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current && graphRef.current.zoom) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 0.7);
    }
  };

  const handleFitToScreen = () => {
    if (graphRef.current && graphRef.current.zoomToFit) {
      graphRef.current.zoomToFit(400);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NetworkIcon className="h-5 w-5" />
            Grafo de Relacionamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <LoaderIcon className="h-8 w-8 animate-spin mr-2" />
            <span>Carregando grafo...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NetworkIcon className="h-5 w-5" />
            Grafo de Relacionamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-red-500">
            <AlertTriangleIcon className="h-8 w-8 mb-2" />
            <span>{error}</span>
            <Button
              onClick={fetchGraphData}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 bg-background"
    : className;

  return (
    <Card className={containerClass}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <NetworkIcon className="h-5 w-5" />
          Grafo de Relacionamentos
          {graphData.nodes.length > 0 && (
            <Badge variant="secondary">
              {graphData.nodes.length} artigos, {graphData.links.length}{" "}
              conexões
            </Badge>
          )}
        </CardTitle>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleZoomIn}>
            <ZoomInIcon className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleZoomOut}>
            <ZoomOutIcon className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleFitToScreen}>
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <MinimizeIcon className="h-4 w-4" />
            ) : (
              <MaximizeIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {graphData.nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <NetworkIcon className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhuma conexão encontrada</p>
            <p className="text-sm text-center px-4">
              Adicione relacionamentos entre artigos para visualizar o grafo de
              conexões
            </p>
          </div>
        ) : (
          <div className="relative">
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={isFullscreen ? window.innerWidth : 800}
              height={isFullscreen ? window.innerHeight - 120 : 500}
              nodeLabel={(node) => `
                <div style="padding: 8px; border-radius: 4px; max-width: 200px;">
                  <strong >${node.title}</strong><br/>
                  <small >${node.authors}</small><br/>
                  <small >${node.year} • ${node.journal}</small><br/>
                  <span style="padding: 2px 6px; background: ${getNodeColor(
                    node.status
                  )}; color: white; border-radius: 2px; font-size: 10px;">
                    ${node.status}
                  </span>
                </div>
              `}
              nodeColor={(node) => {
                if (node.id === highlightedNodeId) return "#ff6b6b";
                if (highlightNodes.size > 0 && !highlightNodes.has(node))
                  return "#ddd";
                return getNodeColor(node.status);
              }}
              nodeVal={(node) => (node.id === highlightedNodeId ? 15 : 10)}
              linkColor={(link) => {
                if (highlightLinks.size > 0 && !highlightLinks.has(link))
                  return "#ddd";
                return link.color || "#999";
              }}
              linkWidth={(link) => link.width || 2}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onBackgroundClick={() => {
                setHighlightNodes(new Set());
                setHighlightLinks(new Set());
                setSelectedNode(null);
              }}
              onLinkHover={() => {}}
              cooldownTicks={100}
              nodeCanvasObjectMode={() => "after"}
              nodeCanvasObject={(node, ctx, globalScale) => {
                if (node.id === highlightedNodeId) {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 8 * 1.4, 0, 2 * Math.PI, false);
                  ctx.strokeStyle = "#ff6b6b";
                  ctx.lineWidth = 3 / globalScale;
                  ctx.stroke();
                }
              }}
            />

            {/* Legenda */}
            <div className="absolute top-4 right-4 bg-background/90 p-3 rounded-lg border shadow-sm">
              <h4 className="font-medium text-sm mb-2">Status dos Artigos</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Analisado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Pendente</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Excluído</span>
                </div>
              </div>
            </div>

            {/* Informações do nó selecionado */}
            {selectedNode && (
              <div className="absolute bottom-4 left-4 bg-background/90 p-4 rounded-lg border shadow-sm max-w-xs">
                <h4 className="font-medium truncate">{selectedNode.title}</h4>
                <p className="text-sm truncate">{selectedNode.authors}</p>
                <p className="text-sm">
                  {selectedNode.year} • {selectedNode.journal}
                </p>
                <Badge
                  variant={
                    selectedNode.status === "analisado"
                      ? "default"
                      : selectedNode.status === "pendente"
                      ? "secondary"
                      : "destructive"
                  }
                  className="text-xs mt-2"
                >
                  {selectedNode.status}
                </Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GrafoRelacionamentos;
