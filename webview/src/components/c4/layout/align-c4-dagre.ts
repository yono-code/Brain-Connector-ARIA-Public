import * as dagre from 'dagre';
import type { AriaEdge, AriaNode } from '../../../../../src/shared/types';

interface DagrePosition {
  x: number;
  y: number;
}

export interface C4DagreLayoutOptions {
  rankdir?: 'LR' | 'TB';
  nodeWidth?: number;
  nodeHeight?: number;
  nodesep?: number;
  ranksep?: number;
  marginx?: number;
  marginy?: number;
}

const DEFAULT_OPTIONS: Required<C4DagreLayoutOptions> = {
  rankdir: 'TB',
  nodeWidth: 180,
  nodeHeight: 72,
  nodesep: 50,
  ranksep: 90,
  marginx: 20,
  marginy: 20,
};

export function layoutC4NodesWithDagre(
  nodes: AriaNode[],
  edges: AriaEdge[],
  options: C4DagreLayoutOptions = {},
): Record<string, DagrePosition> {
  if (nodes.length === 0) {
    return {};
  }

  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: resolved.rankdir,
    nodesep: resolved.nodesep,
    ranksep: resolved.ranksep,
    marginx: resolved.marginx,
    marginy: resolved.marginy,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const nodeIds = new Set(nodes.map((node) => node.id));
  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: resolved.nodeWidth,
      height: resolved.nodeHeight,
    });
  });

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      return;
    }

    if (edge.variant === 'single-reverse') {
      graph.setEdge(edge.target, edge.source);
      return;
    }

    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  const positioned: Record<string, DagrePosition> = {};
  nodes.forEach((node) => {
    const next = graph.node(node.id) as DagrePosition | undefined;
    if (!next) {
      positioned[node.id] = node.position;
      return;
    }
    positioned[node.id] = {
      x: next.x - resolved.nodeWidth / 2,
      y: next.y - resolved.nodeHeight / 2,
    };
  });

  return positioned;
}
