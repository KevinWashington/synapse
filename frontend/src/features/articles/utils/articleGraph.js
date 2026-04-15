import cytoscape from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";

cytoscape.use(coseBilkent);

export const LINK_COLORS = {
  "similar-to": "#8B5CF6",
  "same-methodology": "#10B981",
  "same-author": "#3B82F6",
  "shares-keyword": "#F59E0B",
  "same-venue": "#06B6D4",
  authored: "#22C55E",
  "has-keyword": "#FB7185",
  "published-in": "#14B8A6",
  manual: "#6B7280",
};

export const RELATIONSHIP_LABELS = {
  all: "Todas as relações",
  semantic: "Similaridade semântica",
  methodology: "Mesma metodologia",
  authors: "Autores em comum",
  keywords: "Keywords em comum",
  venue: "Mesmo venue",
  authored: "Autoria (autor -> artigo)",
  "has-keyword": "Artigo -> keyword",
  "published-in": "Artigo -> venue",
};

export const RELATIONSHIP_FILTER_OPTIONS = [
  {
    value: "semantic",
    label: "Similaridade semântica",
    description: "Arestas por embedding",
    backendType: "SIMILAR_TO",
  },
  {
    value: "methodology",
    label: "Mesma metodologia",
    description: "Artigos com método equivalente",
    backendType: "SAME_METHODOLOGY",
  },
  {
    value: "authors",
    label: "Autores em comum",
    description: "Conexões por autoria compartilhada",
    backendType: "SAME_AUTHOR",
  },
  {
    value: "keywords",
    label: "Keywords em comum",
    description: "Conexões por termos compartilhados",
    backendType: "SHARES_KEYWORD",
  },
  {
    value: "venue",
    label: "Mesmo venue",
    description: "Artigos publicados no mesmo veículo",
    backendType: "SAME_VENUE",
  },
  {
    value: "authored",
    label: "Autoria",
    description: "Autor conectado ao artigo",
    backendType: "AUTHORED",
  },
  {
    value: "has-keyword",
    label: "Artigo e keyword",
    description: "Artigo conectado à keyword",
    backendType: "HAS_KEYWORD",
  },
  {
    value: "published-in",
    label: "Artigo e venue",
    description: "Artigo conectado ao venue",
    backendType: "PUBLISHED_IN",
  },
  {
    value: "all",
    label: "Todas as relações",
    description: "Visão completa do grafo",
    backendType: "ALL",
  },
];

export const RELATIONSHIP_LEGEND_LABELS = {
  "similar-to": "SIMILAR_TO",
  "same-methodology": "SAME_METHODOLOGY",
  "same-author": "SAME_AUTHOR",
  "shares-keyword": "SHARES_KEYWORD",
  "same-venue": "SAME_VENUE",
  authored: "AUTHORED",
  "has-keyword": "HAS_KEYWORD",
  "published-in": "PUBLISHED_IN",
};

const NODE_KIND_COLORS = {
  article: "#3B82F6",
  author: "#22C55E",
  keyword: "#F59E0B",
  venue: "#06B6D4",
  node: "#6B7280",
};

const ARTICLE_ONLY_FILTERS = new Set([
  "semantic",
  "similar-to",
  "methodology",
  "same-methodology",
  "authors",
  "same-author",
  "keywords",
  "shares-keyword",
  "venue",
  "same-venue",
]);

const ENTITY_FILTER_KIND = {
  authored: "author",
  "has-keyword": "keyword",
  "published-in": "venue",
};

function getVisibleNodeKindPolicy(relationshipType) {
  const normalized = String(relationshipType || "all").trim().toLowerCase();

  if (ARTICLE_ONLY_FILTERS.has(normalized)) {
    return { keepKinds: new Set(["article"]), keepEntityOnlyIfLinked: false };
  }

  if (ENTITY_FILTER_KIND[normalized]) {
    return {
      keepKinds: new Set(["article", ENTITY_FILTER_KIND[normalized]]),
      keepEntityOnlyIfLinked: true,
    };
  }

  return { keepKinds: null, keepEntityOnlyIfLinked: false };
}

const CLUSTER_COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#22C55E",
  "#0EA5E9",
];

function getEdgeLabel(type, score) {
  if (type === "similar-to") {
    return `${Math.round((score || 0) * 100)}%`;
  }

  if (type === "same-methodology") {
    return "Mesma metodologia";
  }

  if (type === "same-author") {
    return "Autor em comum";
  }

  if (type === "shares-keyword") {
    return "Keyword em comum";
  }

  if (type === "same-venue") {
    return "Mesmo venue";
  }

  if (type === "authored") {
    return "Autoria";
  }

  if (type === "has-keyword") {
    return "Tem keyword";
  }

  if (type === "published-in") {
    return "Publicado em";
  }

  if (type === "manual") {
    return "Manual";
  }

  return "Relação";
}

function getShortTitle(title) {
  const cleanTitle = String(title || "");
  return cleanTitle.length > 30 ? `${cleanTitle.slice(0, 27)}...` : cleanTitle;
}

function buildNodeDegrees(links) {
  const degree = {};

  links.forEach((link) => {
    const sourceId = String(
      typeof link.source === "object" ? link.source.id : link.source
    );
    const targetId = String(
      typeof link.target === "object" ? link.target.id : link.target
    );

    degree[sourceId] = (degree[sourceId] || 0) + 1;
    degree[targetId] = (degree[targetId] || 0) + 1;
  });

  return degree;
}

function buildClusterMeta(nodes, edges) {
  const adjacency = {};

  nodes.forEach((node) => {
    adjacency[String(node.id)] = new Set();
  });

  edges.forEach((edge) => {
    const source = String(edge.source);
    const target = String(edge.target);

    if (!adjacency[source]) {
      adjacency[source] = new Set();
    }

    if (!adjacency[target]) {
      adjacency[target] = new Set();
    }

    adjacency[source].add(target);
    adjacency[target].add(source);
  });

  const visited = new Set();
  const clusterByNode = {};
  const clusterSizes = {};
  let clusterCount = 0;

  Object.keys(adjacency).forEach((nodeId) => {
    if (visited.has(nodeId)) {
      return;
    }

    const clusterId = clusterCount;
    clusterCount += 1;
    const stack = [nodeId];
    let clusterSize = 0;

    while (stack.length > 0) {
      const currentNode = stack.pop();

      if (visited.has(currentNode)) {
        continue;
      }

      visited.add(currentNode);
      clusterByNode[currentNode] = clusterId;
      clusterSize += 1;

      adjacency[currentNode].forEach((neighborNode) => {
        if (!visited.has(neighborNode)) {
          stack.push(neighborNode);
        }
      });
    }

    clusterSizes[clusterId] = clusterSize;
  });

  return {
    clusterByNode,
    clusterCount,
    clusterSizes,
  };
}

export function toCytoscapeElements(graphData, relationshipType = "all") {
  const links = Array.isArray(graphData?.links) ? graphData.links : [];
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
  const degreeByNode = buildNodeDegrees(links);
  const dedupedEdges = new Map();

  links.forEach((link) => {
    const sourceId = String(
      typeof link.source === "object" ? link.source.id : link.source
    );
    const targetId = String(
      typeof link.target === "object" ? link.target.id : link.target
    );
    const type = String(link.type || "manual");
    const score = typeof link.score === "number" ? link.score : 1;

    if (
      !sourceId ||
      !targetId ||
      sourceId === "undefined" ||
      targetId === "undefined"
    ) {
      return;
    }

    const [left, right] = [sourceId, targetId].sort();
    const dedupeKey = `${left}::${right}::${type}`;
    const currentEdge = dedupedEdges.get(dedupeKey);

    if (!currentEdge || score > currentEdge.score) {
      dedupedEdges.set(dedupeKey, {
        source: left,
        target: right,
        type,
        score,
      });
    }
  });

  const normalizedEdges = Array.from(dedupedEdges.values());
  const linkedNodeIds = new Set();
  normalizedEdges.forEach((edge) => {
    linkedNodeIds.add(String(edge.source));
    linkedNodeIds.add(String(edge.target));
  });

  const visibilityPolicy = getVisibleNodeKindPolicy(relationshipType);
  const filteredNodes = nodes.filter((node) => {
    const kind = String(node.kind || "article").toLowerCase();

    if (visibilityPolicy.keepKinds && !visibilityPolicy.keepKinds.has(kind)) {
      return false;
    }

    if (visibilityPolicy.keepEntityOnlyIfLinked && kind !== "article") {
      return linkedNodeIds.has(String(node.id));
    }

    return true;
  });

  const filteredNodeIdSet = new Set(filteredNodes.map((node) => String(node.id)));
  const filteredEdges = normalizedEdges.filter(
    (edge) => filteredNodeIdSet.has(String(edge.source)) && filteredNodeIdSet.has(String(edge.target))
  );

  const clusterMeta = buildClusterMeta(filteredNodes, filteredEdges);

  const nodeElements = filteredNodes.map((node) => {
    const nodeId = String(node.id);
    const clusterId = clusterMeta.clusterByNode[nodeId] ?? 0;
    const kind = String(node.kind || "article").toLowerCase();
    const isArticle = kind === "article";
    const clusterColor = CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
    const baseColor = NODE_KIND_COLORS[kind] || NODE_KIND_COLORS.node;

    return {
      data: {
        id: nodeId,
        title: node.title,
        shortTitle: getShortTitle(node.title),
        kind,
        authors: node.authors,
        year: node.year,
        status: node.status || (isArticle ? "pendente" : null),
        methodology: node.methodology,
        domain: node.domain,
        degree: degreeByNode[nodeId] || 0,
        clusterId,
        clusterSize: clusterMeta.clusterSizes[clusterId] || 1,
        clusterColor: isArticle ? clusterColor : baseColor,
      },
    };
  });

  const edgeElements = filteredEdges.map((edge) => ({
    data: {
      id: `${edge.source}-${edge.target}-${edge.type}`,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      score: edge.score,
      strength: edge.type === "similar-to" ? edge.score : 0.72,
      label: getEdgeLabel(edge.type, edge.score),
    },
  }));

  return {
    elements: [...nodeElements, ...edgeElements],
    stats: {
      displayedLinks: filteredEdges.length,
      totalLinks: normalizedEdges.length,
    },
  };
}

export function spreadIsolatedNodes(cy) {
  const isolatedNodes = cy
    .nodes()
    .filter((node) => Number(node.data("degree") || 0) === 0);

  if (isolatedNodes.length < 2) {
    return;
  }

  const connectedNodes = cy
    .nodes()
    .filter((node) => Number(node.data("degree") || 0) > 0);

  const baseBox = connectedNodes.length
    ? connectedNodes.boundingBox()
    : cy.elements().boundingBox();
  const spacing = 130;
  const total = isolatedNodes.length;
  const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.ceil(total / columns);
  const startX = baseBox.x2 + 200;
  const startY =
    baseBox.y1 - Math.max(0, ((rows - 1) * spacing - baseBox.h) / 2);

  isolatedNodes.forEach((node, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;

    node.position({
      x: startX + column * spacing,
      y: startY + row * spacing,
    });
  });
}

export const ARTICLE_GRAPH_STYLE = [
  {
    selector: "node",
    style: {
      label: "data(shortTitle)",
      color: "#d1d5db",
      "font-size": 10,
      "font-family": "Inter, system-ui, sans-serif",
      "text-wrap": "wrap",
      "text-max-width": 90,
      width: "mapData(degree, 0, 12, 16, 42)",
      height: "mapData(degree, 0, 12, 16, 42)",
      "background-color": "data(clusterColor)",
      "border-width": 2,
      "border-color": "#374151",
      "text-valign": "bottom",
      "text-margin-y": 8,
      "overlay-opacity": 0,
    },
  },
  {
    selector: 'node[kind = "author"]',
    style: {
      shape: "round-rectangle",
      "border-color": "#16A34A",
      width: "mapData(degree, 0, 12, 22, 50)",
      height: "mapData(degree, 0, 12, 14, 28)",
    },
  },
  {
    selector: 'node[kind = "keyword"]',
    style: {
      shape: "diamond",
      "border-color": "#D97706",
      width: "mapData(degree, 0, 12, 18, 40)",
      height: "mapData(degree, 0, 12, 18, 40)",
    },
  },
  {
    selector: 'node[kind = "venue"]',
    style: {
      shape: "ellipse",
      "border-color": "#0891B2",
      width: "mapData(degree, 0, 12, 20, 40)",
      height: "mapData(degree, 0, 12, 20, 40)",
    },
  },
  {
    selector: 'node[status = "analisado"]',
    style: {
      "border-color": "#10B981",
    },
  },
  {
    selector: 'node[status = "excluido"]',
    style: {
      "border-color": "#EF4444",
      opacity: 0.7,
    },
  },
  {
    selector: 'node[status = "pendente"]',
    style: {
      "border-color": "#F59E0B",
    },
  },
  {
    selector: "edge",
    style: {
      label: "data(label)",
      "font-size": 9,
      color: "#e5e7eb",
      "text-rotation": "autorotate",
      "text-background-color": "#111827",
      "text-background-opacity": 0.82,
      "text-background-padding": 2,
      "text-background-shape": "roundrectangle",
      width: "mapData(strength, 0.5, 1, 1.3, 3.8)",
      "line-color": "#6B7280",
      "curve-style": "bezier",
      opacity: 0.72,
    },
  },
  {
    selector: 'edge[type = "similar-to"]',
    style: {
      "line-color": LINK_COLORS["similar-to"],
    },
  },
  {
    selector: 'edge[type = "same-methodology"]',
    style: {
      "line-color": LINK_COLORS["same-methodology"],
    },
  },
  {
    selector: 'edge[type = "same-author"]',
    style: {
      "line-color": LINK_COLORS["same-author"],
    },
  },
  {
    selector: 'edge[type = "shares-keyword"]',
    style: {
      "line-color": LINK_COLORS["shares-keyword"],
    },
  },
  {
    selector: 'edge[type = "same-venue"]',
    style: {
      "line-color": LINK_COLORS["same-venue"],
    },
  },
  {
    selector: 'edge[type = "authored"]',
    style: {
      "line-color": LINK_COLORS.authored,
      "line-style": "dotted",
    },
  },
  {
    selector: 'edge[type = "has-keyword"]',
    style: {
      "line-color": LINK_COLORS["has-keyword"],
      "line-style": "dashed",
    },
  },
  {
    selector: 'edge[type = "published-in"]',
    style: {
      "line-color": LINK_COLORS["published-in"],
      "line-style": "dotted",
    },
  },
  {
    selector: 'edge[type = "manual"]',
    style: {
      "line-color": LINK_COLORS.manual,
      "line-style": "dashed",
    },
  },
  {
    selector: ".faded",
    style: {
      opacity: 0.12,
      "text-opacity": 0.04,
    },
  },
  {
    selector: ".highlight",
    style: {
      opacity: 1,
      "text-opacity": 1,
    },
  },
  {
    selector: "node.highlight",
    style: {
      "border-color": "#f3f4f6",
      "border-width": 2.8,
    },
  },
  {
    selector: "edge.highlight",
    style: {
      width: 3.5,
      opacity: 0.95,
    },
  },
];

export const ARTICLE_GRAPH_LAYOUT = {
  name: "cose-bilkent",
  quality: "proof",
  nodeRepulsion: 22000,
  idealEdgeLength: 200,
  edgeElasticity: 0.2,
  nestingFactor: 0.9,
  gravity: 0.2,
  tile: true,
  randomize: true,
  fit: true,
  animate: true,
  animationDuration: 550,
  padding: 140,
};
