import type { AriaEdge, AriaNode } from '../../../../../src/shared/types';

export const TREE_X_SPACING = 260;
export const TREE_Y_SPACING = 110;
const ROOT_GAP_ROWS = 1;

interface LayoutOptions {
  coreNodeId?: string;
  xSpacing?: number;
  ySpacing?: number;
}

interface PositionedNode {
  x: number;
  y: number;
}

export function layoutMindmapAsTree(
  nodes: AriaNode[],
  edges: AriaEdge[],
  options: LayoutOptions = {},
): Record<string, PositionedNode> {
  const xSpacing = options.xSpacing ?? TREE_X_SPACING;
  const ySpacing = options.ySpacing ?? TREE_Y_SPACING;
  const mindmapNodes = nodes.filter((node) => node.type === 'mindmap');
  if (mindmapNodes.length === 0) {
    return {};
  }

  const nodeById = new Map(mindmapNodes.map((node) => [node.id, node]));
  const validEdges = edges.filter(
    (edge) => nodeById.has(edge.source) && nodeById.has(edge.target),
  );

  // Build a tree by selecting the first parent for each node to avoid multi-parent ambiguity.
  const parentByChild = new Map<string, string>();
  for (const edge of validEdges) {
    if (!parentByChild.has(edge.target) && edge.source !== edge.target) {
      parentByChild.set(edge.target, edge.source);
    }
  }

  const childrenByParent = new Map<string, string[]>();
  for (const node of mindmapNodes) {
    childrenByParent.set(node.id, []);
  }
  for (const [child, parent] of parentByChild.entries()) {
    const children = childrenByParent.get(parent);
    if (!children) continue;
    children.push(child);
  }

  for (const [parent, children] of childrenByParent.entries()) {
    children.sort((a, b) => {
      const nodeA = nodeById.get(a);
      const nodeB = nodeById.get(b);
      if (!nodeA || !nodeB) return 0;
      if (nodeA.position.y !== nodeB.position.y) {
        return nodeA.position.y - nodeB.position.y;
      }
      return nodeA.position.x - nodeB.position.x;
    });
    childrenByParent.set(parent, children);
  }

  const roots = mindmapNodes
    .filter((node) => !parentByChild.has(node.id))
    .map((node) => node.id);

  const selectedCore = options.coreNodeId && nodeById.has(options.coreNodeId)
    ? options.coreNodeId
    : undefined;
  const fallbackCore = roots[0] ?? mindmapNodes[0].id;
  const coreNodeId = selectedCore ?? fallbackCore;
  const anchorRootId = resolveRootNodeId(coreNodeId, parentByChild, fallbackCore);

  const orderedRoots = orderRoots(anchorRootId, roots, nodeById, mindmapNodes.map((node) => node.id));
  const subtreeSizeMemo = new Map<string, number>();
  const result: Record<string, PositionedNode> = {};
  const placed = new Set<string>();

  const computeSubtreeRows = (nodeId: string, stack: Set<string>): number => {
    const cached = subtreeSizeMemo.get(nodeId);
    if (cached) return cached;

    if (stack.has(nodeId)) {
      return 1;
    }
    stack.add(nodeId);

    const children = childrenByParent.get(nodeId) ?? [];
    let rows = 0;
    for (const child of children) {
      rows += computeSubtreeRows(child, stack);
    }
    if (rows === 0) rows = 1;
    stack.delete(nodeId);
    subtreeSizeMemo.set(nodeId, rows);
    return rows;
  };

  const place = (
    nodeId: string,
    depth: number,
    rowStart: number,
    activePath: Set<string>,
  ): { rowsUsed: number; centerY: number } => {
    if (activePath.has(nodeId)) {
      const y = rowStart * ySpacing;
      result[nodeId] = { x: depth * xSpacing, y };
      placed.add(nodeId);
      return { rowsUsed: 1, centerY: y };
    }

    activePath.add(nodeId);
    const children = childrenByParent.get(nodeId) ?? [];
    const unresolvedChildren = children.filter((child) => !placed.has(child));

    if (unresolvedChildren.length === 0) {
      const y = rowStart * ySpacing;
      result[nodeId] = { x: depth * xSpacing, y };
      placed.add(nodeId);
      activePath.delete(nodeId);
      return { rowsUsed: 1, centerY: y };
    }

    let cursor = rowStart;
    const childCenters: number[] = [];
    let used = 0;

    for (const childId of unresolvedChildren) {
      const childRows = computeSubtreeRows(childId, new Set());
      const placement = place(childId, depth + 1, cursor, activePath);
      childCenters.push(placement.centerY);
      cursor += Math.max(placement.rowsUsed, childRows);
      used += Math.max(placement.rowsUsed, childRows);
    }

    const centerY = childCenters.length > 0
      ? (childCenters[0] + childCenters[childCenters.length - 1]) / 2
      : rowStart * ySpacing;
    result[nodeId] = { x: depth * xSpacing, y: centerY };
    placed.add(nodeId);
    activePath.delete(nodeId);
    return { rowsUsed: Math.max(used, 1), centerY };
  };

  let cursorRow = 0;
  for (const rootId of orderedRoots) {
    if (placed.has(rootId)) continue;
    const rootRows = computeSubtreeRows(rootId, new Set());
    const placement = place(rootId, 0, cursorRow, new Set());
    cursorRow += Math.max(placement.rowsUsed, rootRows) + ROOT_GAP_ROWS;
  }

  for (const node of mindmapNodes) {
    if (placed.has(node.id)) continue;
    const placement = place(node.id, 0, cursorRow, new Set());
    cursorRow += placement.rowsUsed + ROOT_GAP_ROWS;
  }

  const anchorCurrent = nodeById.get(anchorRootId);
  const anchorNext = result[anchorRootId];
  if (anchorCurrent && anchorNext) {
    const dx = anchorCurrent.position.x - anchorNext.x;
    const dy = anchorCurrent.position.y - anchorNext.y;
    for (const [id, pos] of Object.entries(result)) {
      result[id] = {
        x: pos.x + dx,
        y: pos.y + dy,
      };
    }
  }

  return result;
}

function resolveRootNodeId(
  nodeId: string,
  parentByChild: Map<string, string>,
  fallbackId: string,
): string {
  const visited = new Set<string>();
  let current = nodeId;
  while (true) {
    const parent = parentByChild.get(current);
    if (!parent) {
      return current;
    }
    if (visited.has(current)) {
      return fallbackId;
    }
    visited.add(current);
    current = parent;
  }
}

function compareByCurrentPosition(
  a: string,
  b: string,
  nodeById: Map<string, AriaNode>,
): number {
  const nodeA = nodeById.get(a);
  const nodeB = nodeById.get(b);
  if (!nodeA || !nodeB) return a.localeCompare(b);
  if (nodeA.position.y !== nodeB.position.y) {
    return nodeA.position.y - nodeB.position.y;
  }
  if (nodeA.position.x !== nodeB.position.x) {
    return nodeA.position.x - nodeB.position.x;
  }
  return nodeA.id.localeCompare(nodeB.id);
}

function orderRoots(
  anchorRootId: string,
  rootIds: string[],
  nodeById: Map<string, AriaNode>,
  allIds: string[],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const sortedRoots = [...rootIds].sort((a, b) => compareByCurrentPosition(a, b, nodeById));
  const sortedAllIds = [...allIds].sort((a, b) => compareByCurrentPosition(a, b, nodeById));

  const push = (id: string | undefined) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ordered.push(id);
  };

  push(anchorRootId);
  sortedRoots.forEach(push);
  sortedAllIds.forEach(push);
  return ordered;
}
