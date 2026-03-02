import type { AriaEdge, AriaNode, AriaState, RiskLevel } from '../shared/types';
import type { LayoutDeltaSummary } from './audit-log';

function getMindmapNodes(nodes: AriaNode[]): AriaNode[] {
  return nodes.filter((node) => node.type === 'mindmap');
}

function getMindmapEdges(nodes: AriaNode[], edges: AriaEdge[]): AriaEdge[] {
  const nodeIds = new Set(getMindmapNodes(nodes).map((node) => node.id));
  return edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
}

function buildParentMap(edges: AriaEdge[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const edge of edges) {
    if (!map.has(edge.target)) {
      map.set(edge.target, edge.source);
    }
  }
  return map;
}

export function summarizeMindmapLayoutDelta(
  incoming: AriaState,
  current: AriaState,
): LayoutDeltaSummary {
  const incomingNodes = getMindmapNodes(incoming.nodes);
  const currentNodes = getMindmapNodes(current.nodes);
  const incomingEdges = getMindmapEdges(incoming.nodes, incoming.edges);
  const currentEdges = getMindmapEdges(current.nodes, current.edges);

  const incomingNodeById = new Map(incomingNodes.map((node) => [node.id, node]));
  const currentNodeById = new Map(currentNodes.map((node) => [node.id, node]));

  const addedNodeCount = incomingNodes.filter((node) => !currentNodeById.has(node.id)).length;
  const removedNodeCount = currentNodes.filter((node) => !incomingNodeById.has(node.id)).length;

  let movedNodeCount = 0;
  for (const incomingNode of incomingNodes) {
    const currentNode = currentNodeById.get(incomingNode.id);
    if (!currentNode) continue;
    const moved =
      Math.abs(incomingNode.position.x - currentNode.position.x) > 0.5 ||
      Math.abs(incomingNode.position.y - currentNode.position.y) > 0.5;
    if (moved) movedNodeCount += 1;
  }

  const incomingEdgeSet = new Set(incomingEdges.map((edge) => `${edge.source}->${edge.target}:${edge.label ?? ''}`));
  const currentEdgeSet = new Set(currentEdges.map((edge) => `${edge.source}->${edge.target}:${edge.label ?? ''}`));
  let edgeChangedCount = 0;
  for (const key of incomingEdgeSet) {
    if (!currentEdgeSet.has(key)) edgeChangedCount += 1;
  }
  for (const key of currentEdgeSet) {
    if (!incomingEdgeSet.has(key)) edgeChangedCount += 1;
  }

  const incomingParentMap = buildParentMap(incomingEdges);
  const currentParentMap = buildParentMap(currentEdges);
  let hasHierarchyChange = false;
  for (const [nodeId, incomingParent] of incomingParentMap.entries()) {
    if (currentParentMap.get(nodeId) !== incomingParent) {
      hasHierarchyChange = true;
      break;
    }
  }
  if (!hasHierarchyChange) {
    for (const [nodeId] of currentParentMap.entries()) {
      if (!incomingParentMap.has(nodeId)) {
        hasHierarchyChange = true;
        break;
      }
    }
  }

  return {
    movedNodeCount,
    addedNodeCount,
    removedNodeCount,
    edgeChangedCount,
    hasHierarchyChange,
  };
}

export function hasLayoutDelta(delta: LayoutDeltaSummary): boolean {
  return (
    delta.movedNodeCount > 0 ||
    delta.addedNodeCount > 0 ||
    delta.removedNodeCount > 0 ||
    delta.edgeChangedCount > 0 ||
    delta.hasHierarchyChange
  );
}

export function resolveLayoutRisk(
  delta: LayoutDeltaSummary,
  guardHighRisk: boolean,
): RiskLevel {
  if (guardHighRisk) {
    return 'high';
  }
  if (delta.movedNodeCount >= 20 || delta.hasHierarchyChange) {
    return 'medium';
  }
  return 'low';
}
