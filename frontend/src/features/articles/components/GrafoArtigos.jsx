import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { articleService } from "../services/articleService";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Loader2,
    Network,
    AlertCircle,
    ZoomIn,
    ZoomOut,
    Maximize2,
} from "lucide-react";

// Cores por tipo de relacionamento
const LINK_COLORS = {
    "similar-to": "#8B5CF6",       // purple - similaridade semântica
    "same-methodology": "#10B981", // green - mesma metodologia
    "same-author": "#3B82F6",      // blue - mesmos autores
    "manual": "#6B7280",           // gray - relacionamentos manuais
};

const RELATIONSHIP_LABELS = {
    all: "Todas as relações",
    semantic: "Similaridade Semântica",
    methodology: "Mesma Metodologia",
    authors: "Mesmos Autores",
};

export function GrafoArtigos({ projectId }) {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [relationshipType, setRelationshipType] = useState("all");
    const [minSimilarity, setMinSimilarity] = useState(0.7);
    const [debouncedSimilarity, setDebouncedSimilarity] = useState(0.7);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dimensions, setDimensions] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);
    const graphRef = useRef();
    const containerRef = useRef();
    const debounceTimerRef = useRef(null);

    // Debounce do slider de similaridade
    useEffect(() => {
        debounceTimerRef.current = setTimeout(() => {
            setDebouncedSimilarity(minSimilarity);
        }, 500);
        return () => clearTimeout(debounceTimerRef.current);
    }, [minSimilarity]);

    // Observar redimensionamento do container
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Capturar dimensões iniciais imediatamente
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            setDimensions({ width: rect.width, height: rect.height });
        }

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    setDimensions({ width, height });
                }
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, [loading]);

    const fetchGraphData = useCallback(async () => {
        if (!projectId) return;

        setLoading(true);
        setError(null);

        try {
            const data = await articleService.getProjectGraph(projectId, {
                relationshipType,
                minSimilarity: debouncedSimilarity,
            });

            setGraphData(data);
        } catch (err) {
            console.error("Erro ao buscar dados do grafo:", err);
            setError("Não foi possível carregar o grafo de relacionamentos.");
        } finally {
            setLoading(false);
        }
    }, [projectId, relationshipType, debouncedSimilarity]);

    useEffect(() => {
        fetchGraphData();
    }, [fetchGraphData]);

    // Configurar forças d3 para espalhar nós e preencher a área
    useEffect(() => {
        const fg = graphRef.current;
        if (!fg) return;

        // Repulsão forte entre nós para evitar sobreposição
        fg.d3Force('charge')?.strength(-200);
        // Distância mínima entre nós conectados
        fg.d3Force('link')?.distance(100);
        // Força centrípeta fraca para não comprimir demais
        fg.d3Force('center')?.strength(0.05);

        // Reheat para aplicar as novas forças
        fg.d3ReheatSimulation();
    }, [graphData]);

    // Calcular raio do nó baseado no número de conexões
    const nodeConnections = useMemo(() => {
        const connections = {};
        graphData.links.forEach((link) => {
            const sourceId = typeof link.source === "object" ? link.source.id : link.source;
            const targetId = typeof link.target === "object" ? link.target.id : link.target;
            connections[sourceId] = (connections[sourceId] || 0) + 1;
            connections[targetId] = (connections[targetId] || 0) + 1;
        });
        return connections;
    }, [graphData.links]);

    // Tamanho do nó baseado em conexões — guardado para reusar
    const getNodeRadius = useCallback((node) => {
        const connections = nodeConnections[node.id] || 0;
        return 5 + Math.min(connections * 1, 5); // 5px base, máx 10px
    }, [nodeConnections]);

    // Configuração do nó — nós menores e mais clean
    const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
        const radius = getNodeRadius(node);
        const isHovered = hoveredNode === node.id;

        // Cor do nó — baseado nos status reais do backend
        const nodeColor = node.status === "analisado" ? "#10B981" :  // verde — analisado
            node.status === "excluido" ? "#EF4444" :                 // vermelho — excluído
                "#F59E0B";                                               // amarelo — pendente

        // Glow sutil no hover
        if (isHovered) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI);
            ctx.fillStyle = nodeColor + "30";
            ctx.fill();
        }

        // Nó principal
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = isHovered ? nodeColor : nodeColor + "CC";
        ctx.fill();
        ctx.strokeStyle = isHovered ? "#ffffffaa" : "#ffffff40";
        ctx.lineWidth = isHovered ? 1.5 : 1;
        ctx.stroke();

        // Label — mostra sempre mas com tamanhos diferentes
        const label = node.title?.substring(0, 22) + (node.title?.length > 22 ? "…" : "");
        const fontSize = Math.max(11 / globalScale, 2.5);
        ctx.font = `${isHovered ? "600" : "400"} ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHovered ? "#f3f4f6" : "#9ca3afbb";
        ctx.fillText(label, node.x, node.y + radius + 3);
    }, [hoveredNode, getNodeRadius]);

    // Cor do link baseada no tipo
    const getLinkColor = useCallback((link) => {
        const color = LINK_COLORS[link.type] || LINK_COLORS.manual;
        return color + "80"; // 50% opacidade
    }, []);

    // Tooltip do nó
    const getNodeLabel = useCallback((node) => {
        let label = `<div style="background:#1f2937;border:1px solid #374151;border-radius:8px;padding:10px 14px;font-size:13px;color:#e5e7eb;max-width:320px;line-height:1.5;box-shadow:0 4px 12px rgba(0,0,0,0.3);">`;
        label += `<div style="font-weight:600;font-size:14px;color:#f9fafb;margin-bottom:6px;">${node.title}</div>`;
        if (node.authors) label += `<div style="color:#9ca3af;">👤 ${node.authors}</div>`;
        if (node.year) label += `<div style="color:#9ca3af;">📅 ${node.year}</div>`;
        if (node.methodology && node.methodology !== "other") label += `<div style="color:#9ca3af;">🔬 ${node.methodology}</div>`;
        if (node.domain) label += `<div style="color:#9ca3af;">📁 ${node.domain}</div>`;
        label += `</div>`;
        return label;
    }, []);

    // Controles de zoom
    const handleZoomIn = useCallback(() => {
        const fg = graphRef.current;
        if (!fg) return;
        const currentZoom = fg.zoom();
        fg.zoom(currentZoom * 1.5, 300);
    }, []);

    const handleZoomOut = useCallback(() => {
        const fg = graphRef.current;
        if (!fg) return;
        const currentZoom = fg.zoom();
        fg.zoom(currentZoom / 1.5, 300);
    }, []);

    const handleZoomReset = useCallback(() => {
        graphRef.current?.zoomToFit(400, 60);
    }, []);

    // Click no nó — centraliza com zoom suave
    const handleNodeClick = useCallback((node) => {
        graphRef.current?.centerAt(node.x, node.y, 600);
        graphRef.current?.zoom(3, 600);
    }, []);

    if (loading) {
        return (
            <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] shadow-[var(--syn-shadow-card)]">
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-[var(--syn-text-secondary)]">Carregando grafo...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-[var(--syn-radius-card)] border border-destructive/50 bg-[var(--syn-bg-primary)] shadow-[var(--syn-shadow-card)]">
                <div className="flex items-center justify-center py-16">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <span className="ml-3 text-destructive">{error}</span>
                </div>
            </div>
        );
    }

    if (graphData.nodes.length === 0) {
        return (
            <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] shadow-[var(--syn-shadow-card)]">
                <div className="flex flex-col items-center justify-center py-16">
                    <Network className="h-16 w-16 text-[var(--syn-text-secondary)]/50 mb-4" />
                    <p className="text-[var(--syn-text-secondary)] text-center">
                        Nenhum artigo encontrado.<br />
                        Adicione artigos ao projeto para visualizar o grafo de relacionamentos.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Controls bar */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-[var(--syn-text-secondary)]" />
                    <span className="text-xs text-[var(--syn-text-secondary)]">
                        {graphData.nodes.length} artigos · {graphData.links.length} relações
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="relationship-type" className="text-xs text-[var(--syn-text-secondary)] whitespace-nowrap">
                            Relação:
                        </Label>
                        <Select value={relationshipType} onValueChange={setRelationshipType}>
                            <SelectTrigger id="relationship-type" className="w-44 h-8 text-xs">
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

                    {(relationshipType === "all" || relationshipType === "semantic") && (
                        <div className="flex items-center gap-2">
                            <Label htmlFor="min-similarity" className="text-xs text-[var(--syn-text-secondary)] whitespace-nowrap">
                                Min:
                            </Label>
                            <input
                                id="min-similarity"
                                type="range"
                                min="0.5"
                                max="0.95"
                                step="0.05"
                                value={minSimilarity}
                                onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                                className="w-20 accent-[var(--syn-sidebar-accent)]"
                            />
                            <span className="text-xs font-medium text-[var(--syn-text-secondary)] w-8">
                                {(minSimilarity * 100).toFixed(0)}%
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
                {Object.entries(LINK_COLORS).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1.5">
                        <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[var(--syn-text-secondary)] capitalize">
                            {type.replace(/-/g, " ").replace("same ", "mesmo ")}
                        </span>
                    </div>
                ))}
                <div className="h-3 w-px bg-[var(--syn-border)]" />
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[var(--syn-text-secondary)]">Analisado</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[var(--syn-text-secondary)]">Excluído</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[var(--syn-text-secondary)]">Pendente</span>
                </div>
            </div>

            {/* Graph canvas */}
            <div className="rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] shadow-[var(--syn-shadow-card)] overflow-hidden relative">
                {/* Zoom controls */}
                <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 bg-[var(--syn-bg-primary)]/80 backdrop-blur-sm"
                        onClick={handleZoomIn}
                        title="Zoom In"
                    >
                        <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 bg-[var(--syn-bg-primary)]/80 backdrop-blur-sm"
                        onClick={handleZoomOut}
                        title="Zoom Out"
                    >
                        <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 bg-[var(--syn-bg-primary)]/80 backdrop-blur-sm"
                        onClick={handleZoomReset}
                        title="Ajustar à tela"
                    >
                        <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                </div>

                <div
                    ref={containerRef}
                    className="h-[600px] w-full"
                >
                    {dimensions ? (
                        <ForceGraph2D
                            ref={graphRef}
                            graphData={graphData}
                            width={dimensions.width}
                            height={dimensions.height}
                            nodeLabel={getNodeLabel}
                            nodeCanvasObject={nodeCanvasObject}
                            nodePointerAreaPaint={(node, color, ctx) => {
                                // Área de hover generosa: 16px de raio para fácil interação
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, 16, 0, 2 * Math.PI);
                                ctx.fillStyle = color;
                                ctx.fill();
                            }}
                            nodeCanvasObjectMode={() => "replace"}
                            linkColor={getLinkColor}
                            linkWidth={1.5}
                            linkDirectionalParticles={1}
                            linkDirectionalParticleWidth={1.5}
                            linkDirectionalParticleSpeed={0.003}
                            linkCurvature={0.1}
                            backgroundColor="transparent"
                            enableNodeDrag={true}
                            enableZoomInteraction={true}
                            enablePanInteraction={true}
                            minZoom={0.3}
                            maxZoom={8}
                            d3AlphaDecay={0.05}
                            d3VelocityDecay={0.4}
                            warmupTicks={50}
                            cooldownTicks={80}
                            onNodeClick={handleNodeClick}
                            onNodeHover={(node) => setHoveredNode(node?.id || null)}
                            onNodeDragEnd={(node) => {
                                // Fixar nó onde foi solto
                                node.fx = node.x;
                                node.fy = node.y;
                            }}
                            onEngineStop={() => {
                                const fg = graphRef.current;
                                if (!fg) return;
                                fg.zoomToFit(400, 40);
                                fg.d3Force('charge')?.strength(0);
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-[var(--syn-text-secondary)]" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GrafoArtigos;
