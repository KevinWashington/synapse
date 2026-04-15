import { useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

const TOOL_LABELS = {
  search_semantic: "Busca semantica vetorial (Qdrant)",
  "vector.search": "Busca semantica vetorial (Qdrant)",
  execute_expansion: "Expansao de relacoes no grafo (Neo4j)",
  "graph.expand": "Expansao de relacoes no grafo (Neo4j)",
  rerank_by_impact: "Re-ranqueamento por impacto (Postgres)",
  "sql.rerank": "Re-ranqueamento por impacto (Postgres)",
  "graph.cluster_project": "Analise de clusters no grafo",
  "graph.bridge_authors": "Autores ponte entre clusters",
  "graph.timeline_by_methodology": "Timeline por metodologia",
  "graph.recommend_related_reads": "Recomendacao de leituras relacionadas",
  "graph.find_author_topic_paths": "Caminhos autor-topico",
};

const INTENT_LABELS = {
  fallback_hybrid_rag: "Fallback Hybrid RAG",
  cluster_bridge_analysis: "Analise de clusters e autores ponte",
  methodology_timeline: "Timeline por metodologia",
  author_topic_paths: "Caminhos entre autor e topico",
  related_reads: "Leituras relacionadas",
};

function friendlyToolName(tool) {
  return TOOL_LABELS[tool] || tool;
}

function friendlyIntent(intent) {
  return INTENT_LABELS[intent] || intent || "nao informado";
}

function compactObservation(observation) {
  if (!observation || typeof observation !== "object") {
    return "";
  }

  const pieces = [];
  if (typeof observation.candidateCount === "number") {
    pieces.push(`candidatos: ${observation.candidateCount}`);
  }
  if (observation.resolvedPaperId) {
    pieces.push(`paper resolvido: ${observation.resolvedPaperId}`);
  }
  if (typeof observation.calls === "number") {
    pieces.push(`chamadas: ${observation.calls}`);
  }

  return pieces.join(" | ");
}

function ChatAgentTracePanel({ provenance, isLoading = false, selectedProjectId }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const trace = provenance?.agentTrace || [];
  const plannedTools = provenance?.agentTools || [];

  const executedTools = useMemo(() => {
    const fromTrace = trace.map((step) => step?.tool).filter(Boolean);
    return [...new Set(fromTrace)];
  }, [trace]);

  const toolsUsed = executedTools.length > 0 ? executedTools : plannedTools;
  const hasDebugInfo = Boolean(provenance?.agentIntent || toolsUsed.length > 0 || trace.length > 0);

  if (!selectedProjectId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-2 rounded-lg border border-[var(--syn-border)] bg-[var(--syn-bg-secondary)]/40 p-2.5">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--syn-text-secondary)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--syn-text-secondary)]">
            Pensando no plano de tools...
          </span>
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-[var(--syn-text-secondary)]">
          <p>1. Classificando intencao da pergunta</p>
          <p>2. Escolhendo tools do MCP</p>
          <p>3. Buscando evidencias no projeto</p>
        </div>
      </div>
    );
  }

  if (!hasDebugInfo) {
    return null;
  }

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-[var(--syn-border)]">
      <button
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center gap-2 bg-[var(--syn-bg-secondary)] px-3 py-2 text-left transition-colors hover:bg-[var(--syn-bg-primary)]"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-[var(--syn-text-secondary)]" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-[var(--syn-text-secondary)]" />
        )}
        <Bot className="h-3 w-3 flex-shrink-0 text-[var(--syn-text-secondary)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--syn-text-secondary)]">
          O que o sistema fez
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-2 bg-[var(--syn-bg-secondary)]/50 p-2.5 text-xs text-[var(--syn-text-primary)]">
          <p>
            <span className="font-semibold">Intent:</span> {friendlyIntent(provenance?.agentIntent)}
          </p>

          {toolsUsed.length > 0 && (
            <div>
              <p className="font-semibold">Tools usadas:</p>
              <div className="mt-1 space-y-1">
                {toolsUsed.map((tool) => (
                  <p key={tool} className="text-[11px] text-[var(--syn-text-secondary)]">
                    - {friendlyToolName(tool)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {trace.length > 0 && (
            <div>
              <p className="font-semibold">Trilha de execucao:</p>
              <div className="mt-1 space-y-1.5">
                {trace.map((step, index) => {
                  const detail = compactObservation(step?.observation);
                  return (
                    <div key={`${step?.tool || "step"}-${index}`} className="rounded border border-[var(--syn-border)] bg-[var(--syn-bg-primary)] p-1.5">
                      <p className="text-[11px] font-medium">{index + 1}. {friendlyToolName(step?.tool || "tool")}</p>
                      {detail && <p className="text-[10px] text-[var(--syn-text-secondary)]">{detail}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChatAgentTracePanel;
