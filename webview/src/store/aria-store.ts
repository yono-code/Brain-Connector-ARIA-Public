import { create } from 'zustand/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type {
  ADR,
  AriaEdge,
  AriaNode,
  AriaState,
  ContainerCanvas,
  KanbanTask,
  MindmapBoundary,
  MindmapSettings,
  MindmapStyleRole,
  TaskStatus,
} from '../../../src/shared/types';
import {
  generateTaskId,
  generateNodeId,
  generateEdgeId,
  generateAdrId,
} from '../utils/id-generator';
import { postToExtension } from '../hooks/use-vscode-bridge';

const C4_NODE_TYPES = new Set<AriaNode['type']>(['c4-container', 'c4-component']);
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const MINDMAP_HISTORY_LIMIT = 100;
const DEFAULT_MINDMAP_SETTINGS: MindmapSettings = {
  snapEnabled: true,
};

export type DiagramSurfaceRef =
  | { kind: 'c4-context' }
  | { kind: 'c4-container'; containerId: string }
  | { kind: 'mindmap-root' };

interface BreadcrumbItem {
  id: string;
  label: string;
}

interface MindmapSnapshot {
  nodes: AriaNode[];
  edges: AriaEdge[];
  mindmapBoundaries: Record<string, MindmapBoundary>;
  mindmapSettings: MindmapSettings;
}

interface AriaStoreState extends AriaState {
  // ナビゲーション（セッション状態 / 非永続）
  currentLayer: 'context' | 'container';
  activeContainerId: string | null;
  breadcrumb: BreadcrumbItem[];
  mindmapBoundaries: Record<string, MindmapBoundary>;
  mindmapSettings: MindmapSettings;

  // M13: mindmap 編集設定/履歴（非永続）
  mindmapUndoStack: MindmapSnapshot[];
  mindmapRedoStack: MindmapSnapshot[];
  canUndoMindmap: boolean;
  canRedoMindmap: boolean;

  // React Flow アクション
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // surface-aware API（M9）
  getSurfaceNodes: (surface: DiagramSurfaceRef) => AriaNode[];
  getSurfaceEdges: (surface: DiagramSurfaceRef) => AriaEdge[];
  applyNodeChangesToSurface: (surface: DiagramSurfaceRef, changes: NodeChange[]) => void;
  applyEdgeChangesToSurface: (surface: DiagramSurfaceRef, changes: EdgeChange[]) => void;
  connectOnSurface: (surface: DiagramSurfaceRef, connection: Connection) => void;

  // C4 ドリルダウン
  enterContainerLayer: (nodeId: string) => void;
  exitContainerLayer: () => void;

  // ノード CRUD
  addNode: (type: AriaNode['type'], position: { x: number; y: number }, label: string, parentId?: string) => AriaNode;
  addContainerNode: (
    parentContainerId: string,
    type: AriaNode['type'],
    position: { x: number; y: number },
    label: string,
  ) => AriaNode;
  addMindmapSibling: (nodeId: string) => AriaNode | null;
  addMindmapChild: (nodeId: string) => AriaNode;
  deleteNode: (nodeId: string) => void;
  deleteContainerNode: (parentContainerId: string, nodeId: string) => void;
  deleteMindmapNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<AriaNode['data']>) => void;

  // M13: mindmap 操作
  captureMindmapHistory: () => void;
  undoMindmap: () => void;
  redoMindmap: () => void;
  toggleMindmapCollapsed: (nodeId: string) => void;
  setMindmapDescendantsCollapsed: (nodeId: string, collapsed: boolean) => void;
  updateMindmapNote: (nodeId: string, note: string) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;
  reparentMindmapNode: (nodeId: string, newParentId: string) => boolean;
  setMindmapCheckboxEnabled: (nodeId: string, enabled: boolean) => void;
  setMindmapSubtreeCheckboxEnabled: (nodeId: string, enabled: boolean) => void;
  toggleMindmapChecked: (nodeId: string, applySubtree?: boolean) => void;
  toggleMindmapBoundary: (nodeId: string) => void;
  toggleMindmapBoundaryVisibility: (boundaryId: string) => void;
  setMindmapNodeColor: (nodeId: string, color: string | undefined) => void;
  setMindmapNodeStyleRole: (nodeId: string, role: MindmapStyleRole) => void;
  setMindmapSnapEnabled: (enabled: boolean) => void;

  // タスク CRUD
  addTask: (title: string) => KanbanTask;
  updateTask: (taskId: string, patch: Partial<Pick<KanbanTask, 'title' | 'status' | 'startDate' | 'dueDate'>>) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskTitle: (taskId: string, title: string) => void;
  deleteTask: (taskId: string) => void;
  linkTaskToNode: (taskId: string, nodeId: string) => void;

  // 創発的タスク（AI が生成したタスクを Inbox に追加する）
  addEmergentTaskFromAI: (title: string) => KanbanTask;

  // ADR CRUD
  addADR: (linkedNodeId: string, title: string) => ADR | null;
  updateADR: (adrId: string, patch: Partial<Pick<ADR, 'decision' | 'rejectedOptions' | 'title'>>) => void;
  deleteADR: (adrId: string) => void;

  // 状態の一括更新（逆同期時のみ使用 — Extension Host への通知は行わない）
  setState: (newState: AriaState) => void;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isC4Node(node: AriaNode): boolean {
  return C4_NODE_TYPES.has(node.type);
}

function isC4NodeType(type: AriaNode['type']): boolean {
  return C4_NODE_TYPES.has(type);
}

function isMindmapNode(node: AriaNode): boolean {
  return node.type === 'mindmap';
}

function isValidStyleRole(role: unknown): role is MindmapStyleRole {
  return role === 'standard' || role === 'top' || role === 'helper';
}

function normalizeMindmapNode(node: AriaNode): AriaNode {
  if (node.type !== 'mindmap') {
    return node;
  }

  const nextData = {
    ...node.data,
    collapsed: typeof node.data.collapsed === 'boolean' ? node.data.collapsed : false,
    checkboxEnabled: typeof node.data.checkboxEnabled === 'boolean' ? node.data.checkboxEnabled : false,
    checked: typeof node.data.checked === 'boolean' ? node.data.checked : false,
    styleRole: isValidStyleRole(node.data.styleRole) ? node.data.styleRole : 'standard',
  };

  if (typeof nextData.color === 'string' && !HEX_COLOR_PATTERN.test(nextData.color)) {
    delete nextData.color;
  }

  if (typeof nextData.note === 'string' && !nextData.note.trim()) {
    delete nextData.note;
  }

  return {
    ...node,
    data: nextData,
  };
}

function normalizeMindmapSettings(settings: MindmapSettings | undefined): MindmapSettings {
  return {
    snapEnabled:
      typeof settings?.snapEnabled === 'boolean'
        ? settings.snapEnabled
        : DEFAULT_MINDMAP_SETTINGS.snapEnabled,
  };
}

function normalizeMindmapBoundaries(
  boundaries: Record<string, MindmapBoundary> | undefined,
): Record<string, MindmapBoundary> {
  if (!boundaries) {
    return {};
  }
  const entries = Object.entries(boundaries).map(([id, boundary]) => {
    const safeBoundary: MindmapBoundary = {
      id,
      label: boundary.label?.trim() ? boundary.label : 'Boundary',
      nodeIds: Array.isArray(boundary.nodeIds)
        ? boundary.nodeIds.filter((nodeId): nodeId is string => typeof nodeId === 'string')
        : [],
      visible: typeof boundary.visible === 'boolean' ? boundary.visible : true,
    };
    return [id, safeBoundary] as const;
  });
  return Object.fromEntries(entries);
}

function normalizeAriaState(newState: AriaState): AriaState {
  return {
    ...newState,
    nodes: newState.nodes.map(normalizeMindmapNode),
    containerCanvases: Object.fromEntries(
      Object.entries(newState.containerCanvases ?? {}).map(([id, canvas]) => [
        id,
        {
          ...canvas,
          nodes: canvas.nodes.map(normalizeMindmapNode),
        },
      ]),
    ),
    mindmapBoundaries: normalizeMindmapBoundaries(newState.mindmapBoundaries),
    mindmapSettings: normalizeMindmapSettings(newState.mindmapSettings),
  };
}

function hasC4LinkedNode(
  linkedNodeId: string,
  nodes: AriaNode[],
  containerCanvases: Record<string, ContainerCanvas>,
): boolean {
  const rootNode = nodes.find((node) => node.id === linkedNodeId);
  if (rootNode) {
    return isC4Node(rootNode);
  }

  for (const canvas of Object.values(containerCanvases)) {
    const innerNode = canvas.nodes.find((node) => node.id === linkedNodeId);
    if (innerNode) {
      return isC4Node(innerNode);
    }
  }

  return false;
}

function ensureContainerCanvas(
  containerCanvases: Record<string, ContainerCanvas>,
  containerId: string,
): ContainerCanvas {
  return containerCanvases[containerId] ?? {
    nodeId: containerId,
    nodes: [],
    edges: [],
  };
}

function withUpdatedContainerCanvas(
  containerCanvases: Record<string, ContainerCanvas>,
  containerId: string,
  updater: (canvas: ContainerCanvas) => ContainerCanvas,
): Record<string, ContainerCanvas> {
  const currentCanvas = ensureContainerCanvas(containerCanvases, containerId);
  return {
    ...containerCanvases,
    [containerId]: updater(currentCanvas),
  };
}

function collectDescendantNodeIds(edges: AriaEdge[], rootId: string): string[] {
  const collected: string[] = [];
  const visit = (id: string): void => {
    const childIds = edges
      .filter((e) => e.source === id)
      .map((e) => e.target);
    childIds.forEach((childId) => {
      if (collected.includes(childId)) {
        return;
      }
      collected.push(childId);
      visit(childId);
    });
  };
  visit(rootId);
  return collected;
}

function removeTaskLinksForDeletedNodes(
  tasks: Record<string, KanbanTask>,
  deletedNodeIds: Set<string>,
): Record<string, KanbanTask> {
  return Object.fromEntries(
    Object.entries(tasks).map(([id, task]) => [
      id,
      {
        ...task,
        linkedNodeIds: task.linkedNodeIds.filter((nodeId) => !deletedNodeIds.has(nodeId)),
      },
    ]),
  ) as Record<string, KanbanTask>;
}

function removeContainerCanvasEntries(
  containerCanvases: Record<string, ContainerCanvas>,
  deletedNodeIds: Set<string>,
): Record<string, ContainerCanvas> {
  return Object.fromEntries(
    Object.entries(containerCanvases).filter(([id]) => !deletedNodeIds.has(id)),
  ) as Record<string, ContainerCanvas>;
}

function collectNestedContainerNodeIds(
  containerCanvases: Record<string, ContainerCanvas>,
  initialNodeIds: Iterable<string>,
): Set<string> {
  const collected = new Set<string>(initialNodeIds);
  const stack = Array.from(collected);

  while (stack.length > 0) {
    const containerId = stack.pop();
    if (!containerId) continue;

    const canvas = containerCanvases[containerId];
    if (!canvas) continue;

    for (const node of canvas.nodes) {
      if (collected.has(node.id)) continue;
      collected.add(node.id);
      stack.push(node.id);
    }
  }

  return collected;
}

function patchNodeSubset(
  allNodes: AriaNode[],
  predicate: (node: AriaNode) => boolean,
  updater: (subset: AriaNode[]) => AriaNode[],
): AriaNode[] {
  const subset = allNodes.filter(predicate);
  const updatedSubset = updater(subset);
  const updatedById = new Map(updatedSubset.map((node) => [node.id, node]));

  return allNodes.flatMap((node) => {
    if (!predicate(node)) return [node];
    const updated = updatedById.get(node.id);
    return updated ? [updated] : [];
  });
}

function patchEdgeSubset(
  allEdges: AriaEdge[],
  predicate: (edge: AriaEdge) => boolean,
  updater: (subset: AriaEdge[]) => AriaEdge[],
): AriaEdge[] {
  const subset = allEdges.filter(predicate);
  const updatedSubset = updater(subset);
  const updatedById = new Map(updatedSubset.map((edge) => [edge.id, edge]));

  return allEdges.flatMap((edge) => {
    if (!predicate(edge)) return [edge];
    const updated = updatedById.get(edge.id);
    return updated ? [updated] : [];
  });
}

function getMindmapNodeIds(nodes: AriaNode[]): Set<string> {
  return new Set(nodes.filter(isMindmapNode).map((node) => node.id));
}

function getMindmapEdges(nodes: AriaNode[], edges: AriaEdge[]): AriaEdge[] {
  const mindmapNodeIds = getMindmapNodeIds(nodes);
  return edges.filter((edge) => mindmapNodeIds.has(edge.source) && mindmapNodeIds.has(edge.target));
}

function isMindmapEdge(nodes: AriaNode[], edge: AriaEdge): boolean {
  const mindmapNodeIds = getMindmapNodeIds(nodes);
  return mindmapNodeIds.has(edge.source) && mindmapNodeIds.has(edge.target);
}

function collectVisibleMindmapNodeIds(nodes: AriaNode[], edges: AriaEdge[]): Set<string> {
  const mindmapNodes = nodes.filter(isMindmapNode);
  const mindmapNodeIds = new Set(mindmapNodes.map((node) => node.id));
  const childByParent = new Map<string, string[]>();
  const incomingCounts = new Map<string, number>();

  for (const node of mindmapNodes) {
    incomingCounts.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!mindmapNodeIds.has(edge.source) || !mindmapNodeIds.has(edge.target)) continue;
    const list = childByParent.get(edge.source) ?? [];
    list.push(edge.target);
    childByParent.set(edge.source, list);
    incomingCounts.set(edge.target, (incomingCounts.get(edge.target) ?? 0) + 1);
  }

  const roots = mindmapNodes.filter((node) => (incomingCounts.get(node.id) ?? 0) === 0);
  const visible = new Set<string>();
  const nodeById = new Map(mindmapNodes.map((node) => [node.id, node]));
  const visited = new Set<string>();

  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    visible.add(nodeId);

    const node = nodeById.get(nodeId);
    if (!node || node.data.collapsed) {
      return;
    }
    const children = childByParent.get(nodeId) ?? [];
    children.forEach(visit);
  };

  if (roots.length === 0 && mindmapNodes.length > 0) {
    visit(mindmapNodes[0].id);
    return visible;
  }

  roots.forEach((root) => visit(root.id));
  return visible;
}

function filterEdgesToVisibleNodes(nodes: AriaNode[], edges: AriaEdge[]): AriaEdge[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  return edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
}

function selectMindmapNode(
  nodes: AriaNode[],
  selectedId: string,
): AriaNode[] {
  return nodes.map((node) => {
    if (node.type !== 'mindmap') return node;
    return {
      ...node,
      selected: node.id === selectedId,
    };
  });
}

function createMindmapSnapshot(
  state: Pick<AriaStoreState, 'nodes' | 'edges' | 'mindmapBoundaries' | 'mindmapSettings'>,
): MindmapSnapshot {
  const mindmapNodes = state.nodes.filter(isMindmapNode);
  const mindmapEdges = getMindmapEdges(state.nodes, state.edges);
  return {
    nodes: deepClone(mindmapNodes),
    edges: deepClone(mindmapEdges),
    mindmapBoundaries: deepClone(state.mindmapBoundaries),
    mindmapSettings: deepClone(normalizeMindmapSettings(state.mindmapSettings)),
  };
}

function buildHistoryState(
  undo: MindmapSnapshot[],
  redo: MindmapSnapshot[],
): Pick<AriaStoreState, 'mindmapUndoStack' | 'mindmapRedoStack' | 'canUndoMindmap' | 'canRedoMindmap'> {
  return {
    mindmapUndoStack: undo,
    mindmapRedoStack: redo,
    canUndoMindmap: undo.length > 0,
    canRedoMindmap: redo.length > 0,
  };
}

function pushMindmapHistoryState(
  state: AriaStoreState,
): Pick<AriaStoreState, 'mindmapUndoStack' | 'mindmapRedoStack' | 'canUndoMindmap' | 'canRedoMindmap'> {
  const snapshot = createMindmapSnapshot(state);
  const undo = [...state.mindmapUndoStack, snapshot];
  while (undo.length > MINDMAP_HISTORY_LIMIT) {
    undo.shift();
  }
  return buildHistoryState(undo, []);
}

function applyMindmapSnapshot(
  state: AriaStoreState,
  snapshot: MindmapSnapshot,
): Pick<AriaStoreState, 'nodes' | 'edges' | 'mindmapBoundaries' | 'mindmapSettings'> {
  const nonMindmapNodes = state.nodes.filter((node) => node.type !== 'mindmap');
  const mindmapNodeIds = new Set(snapshot.nodes.map((node) => node.id));
  const nonMindmapEdges = state.edges.filter(
    (edge) => !mindmapNodeIds.has(edge.source) || !mindmapNodeIds.has(edge.target),
  );

  return {
    nodes: [...nonMindmapNodes, ...deepClone(snapshot.nodes)],
    edges: [...nonMindmapEdges, ...deepClone(snapshot.edges)],
    mindmapBoundaries: deepClone(snapshot.mindmapBoundaries),
    mindmapSettings: normalizeMindmapSettings(snapshot.mindmapSettings),
  };
}

function collectMindmapSubtreeNodeIds(state: AriaStoreState, rootId: string): string[] {
  const descendants = collectDescendantNodeIds(getMindmapEdges(state.nodes, state.edges), rootId);
  return [rootId, ...descendants];
}

function refreshMindmapBoundaries(
  boundaries: Record<string, MindmapBoundary>,
  nodes: AriaNode[],
  edges: AriaEdge[],
): Record<string, MindmapBoundary> {
  const mindmapNodeIds = getMindmapNodeIds(nodes);
  const mindmapEdges = getMindmapEdges(nodes, edges);
  const result: Record<string, MindmapBoundary> = {};

  for (const [boundaryId, boundary] of Object.entries(boundaries)) {
    const rootId = boundary.nodeIds[0];
    if (!rootId || !mindmapNodeIds.has(rootId)) {
      continue;
    }
    const subtree = [rootId, ...collectDescendantNodeIds(mindmapEdges, rootId)]
      .filter((nodeId, index, arr) => arr.indexOf(nodeId) === index)
      .filter((nodeId) => mindmapNodeIds.has(nodeId));
    if (subtree.length === 0) {
      continue;
    }
    result[boundaryId] = {
      ...boundary,
      nodeIds: subtree,
    };
  }

  return result;
}

function getSurfaceNodesFromState(
  state: Pick<AriaStoreState, 'nodes' | 'edges' | 'containerCanvases'>,
  surface: DiagramSurfaceRef,
): AriaNode[] {
  switch (surface.kind) {
    case 'c4-context':
      return state.nodes.filter(isC4Node);
    case 'mindmap-root': {
      const visibleNodeIds = collectVisibleMindmapNodeIds(state.nodes, state.edges);
      return state.nodes
        .filter(isMindmapNode)
        .filter((node) => visibleNodeIds.has(node.id));
    }
    case 'c4-container':
      return ensureContainerCanvas(state.containerCanvases, surface.containerId).nodes;
  }
}

function getSurfaceEdgesFromState(
  state: Pick<AriaStoreState, 'nodes' | 'edges' | 'containerCanvases'>,
  surface: DiagramSurfaceRef,
): AriaEdge[] {
  switch (surface.kind) {
    case 'c4-container':
      return ensureContainerCanvas(state.containerCanvases, surface.containerId).edges;
    case 'c4-context':
      return filterEdgesToVisibleNodes(getSurfaceNodesFromState(state, surface), state.edges);
    case 'mindmap-root': {
      const visibleNodeIds = new Set(getSurfaceNodesFromState(state, surface).map((node) => node.id));
      return getMindmapEdges(state.nodes, state.edges).filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      );
    }
  }
}

export const useAriaStore = create<AriaStoreState>((set, get) => ({
  // --- 初期状態 ---
  nodes: [],
  edges: [],
  tasks: {},
  adrs: {},
  containerCanvases: {},
  mindmapBoundaries: {},
  mindmapSettings: { ...DEFAULT_MINDMAP_SETTINGS },
  version: '1.0.0',
  lastModified: new Date().toISOString(),
  currentLayer: 'context',
  activeContainerId: null,
  breadcrumb: [],
  mindmapUndoStack: [],
  mindmapRedoStack: [],
  canUndoMindmap: false,
  canRedoMindmap: false,

  // --- React Flow アクション ---

  onNodesChange: (changes) => {
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes) as AriaNode[],
    }));
    _notifyExtension(get());
  },

  onEdgesChange: (changes) => {
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges) as AriaEdge[],
    }));
    _notifyExtension(get());
  },

  onConnect: (connection) => {
    set((s) => ({
      edges: addEdge(
        { ...connection, id: generateEdgeId() },
        s.edges,
      ) as AriaEdge[],
    }));
    _notifyExtension(get());
  },

  getSurfaceNodes: (surface) => getSurfaceNodesFromState(get(), surface),

  getSurfaceEdges: (surface) => getSurfaceEdgesFromState(get(), surface),

  applyNodeChangesToSurface: (surface, changes) => {
    set((s) => {
      if (surface.kind === 'c4-container') {
        return {
          containerCanvases: withUpdatedContainerCanvas(
            s.containerCanvases,
            surface.containerId,
            (canvas) => ({
              ...canvas,
              nodes: applyNodeChanges(changes, canvas.nodes) as AriaNode[],
            }),
          ),
        };
      }

      if (surface.kind === 'c4-context') {
        return {
          nodes: patchNodeSubset(
            s.nodes,
            isC4Node,
            (subset) => applyNodeChanges(changes, subset) as AriaNode[],
          ),
        };
      }

      const nextNodes = patchNodeSubset(
        s.nodes,
        isMindmapNode,
        (subset) => applyNodeChanges(changes, subset) as AriaNode[],
      );

      return {
        nodes: nextNodes,
        mindmapBoundaries: refreshMindmapBoundaries(
          s.mindmapBoundaries,
          nextNodes,
          s.edges,
        ),
      };
    });
    _notifyExtension(get());
  },

  applyEdgeChangesToSurface: (surface, changes) => {
    set((s) => {
      if (surface.kind === 'c4-container') {
        return {
          containerCanvases: withUpdatedContainerCanvas(
            s.containerCanvases,
            surface.containerId,
            (canvas) => ({
              ...canvas,
              edges: applyEdgeChanges(changes, canvas.edges) as AriaEdge[],
            }),
          ),
        };
      }

      if (surface.kind === 'c4-context') {
        const c4NodeIds = new Set(s.nodes.filter(isC4Node).map((node) => node.id));
        return {
          edges: patchEdgeSubset(
            s.edges,
            (edge) => c4NodeIds.has(edge.source) && c4NodeIds.has(edge.target),
            (subset) => applyEdgeChanges(changes, subset) as AriaEdge[],
          ),
        };
      }

      const mindmapNodeIds = getMindmapNodeIds(s.nodes);
      const nextEdges = patchEdgeSubset(
        s.edges,
        (edge) => mindmapNodeIds.has(edge.source) && mindmapNodeIds.has(edge.target),
        (subset) => applyEdgeChanges(changes, subset) as AriaEdge[],
      );

      return {
        edges: nextEdges,
        mindmapBoundaries: refreshMindmapBoundaries(
          s.mindmapBoundaries,
          s.nodes,
          nextEdges,
        ),
      };
    });
    _notifyExtension(get());
  },

  connectOnSurface: (surface, connection) => {
    set((s) => {
      if (surface.kind === 'c4-container') {
        return {
          containerCanvases: withUpdatedContainerCanvas(
            s.containerCanvases,
            surface.containerId,
            (canvas) => ({
              ...canvas,
              edges: addEdge({ ...connection, id: generateEdgeId() }, canvas.edges) as AriaEdge[],
            }),
          ),
        };
      }

      return {
        edges: addEdge({ ...connection, id: generateEdgeId() }, s.edges) as AriaEdge[],
      };
    });
    _notifyExtension(get());
  },

  enterContainerLayer: (nodeId) => {
    set((s) => {
      const targetNode = s.nodes.find((n) => n.id === nodeId);
      const breadcrumbItem: BreadcrumbItem = {
        id: nodeId,
        label: targetNode?.data.label ?? nodeId,
      };
      const lastBreadcrumb = s.breadcrumb[s.breadcrumb.length - 1];
      const breadcrumb = lastBreadcrumb?.id === nodeId
        ? s.breadcrumb
        : [...s.breadcrumb, breadcrumbItem];

      return {
        currentLayer: 'container',
        activeContainerId: nodeId,
        breadcrumb,
      };
    });
  },

  exitContainerLayer: () => {
    set({
      currentLayer: 'context',
      activeContainerId: null,
      breadcrumb: [],
    });
  },

  // --- ノード CRUD ---

  addNode: (type, position, label, parentId) => {
    const nodeData: AriaNode['data'] = type === 'mindmap'
      ? {
          label,
          collapsed: false,
          checkboxEnabled: false,
          checked: false,
          styleRole: parentId ? 'standard' : 'top',
        }
      : { label };

    const node: AriaNode = {
      id: generateNodeId(),
      type,
      position,
      data: nodeData,
    };

    const shouldCreateAdr = isC4NodeType(type);
    const adr: ADR | null = shouldCreateAdr
      ? {
          id: generateAdrId(),
          linkedNodeId: node.id,
          title: `${label} の設計決定`,
          decision: '',
          rejectedOptions: [],
          createdAt: new Date().toISOString(),
        }
      : null;

    const edge: AriaEdge | null = parentId ? {
      id: generateEdgeId(),
      source: parentId,
      target: node.id,
    } : null;

    set((s) => {
      const nextNodes = type === 'mindmap' && parentId
        ? s.nodes.map((n) => (n.id === parentId
          ? { ...n, data: { ...n.data, collapsed: false } }
          : n))
        : s.nodes;

      return {
        ...(type === 'mindmap' ? pushMindmapHistoryState(s) : {}),
        nodes: [...nextNodes, node],
        edges: edge ? [...s.edges, edge] : s.edges,
        adrs: adr ? { ...s.adrs, [adr.id]: adr } : s.adrs,
      };
    });
    _notifyExtension(get());
    return node;
  },

  addContainerNode: (parentContainerId, type, position, label) => {
    const node: AriaNode = {
      id: generateNodeId(),
      type,
      position,
      data: { label },
    };
    const shouldCreateAdr = isC4NodeType(type);
    const adr: ADR | null = shouldCreateAdr
      ? {
          id: generateAdrId(),
          linkedNodeId: node.id,
          title: `${label} の設計決定`,
          decision: '',
          rejectedOptions: [],
          createdAt: new Date().toISOString(),
        }
      : null;

    set((s) => ({
      containerCanvases: withUpdatedContainerCanvas(
        s.containerCanvases,
        parentContainerId,
        (canvas) => ({
          ...canvas,
          nodes: [...canvas.nodes, node],
        }),
      ),
      adrs: adr ? { ...s.adrs, [adr.id]: adr } : s.adrs,
    }));
    _notifyExtension(get());
    return node;
  },

  updateNodeData: (nodeId, data) => {
    set((s) => {
      const targetNode = s.nodes.find((n) => n.id === nodeId);
      const trackHistory = targetNode?.type === 'mindmap';
      const nextNodes = s.nodes.map((n) =>
        n.id === nodeId ? normalizeMindmapNode({ ...n, data: { ...n.data, ...data } }) : n,
      );
      const nextContainerCanvases = Object.fromEntries(
        Object.entries(s.containerCanvases).map(([containerId, canvas]) => [
          containerId,
          {
            ...canvas,
            nodes: canvas.nodes.map((n) =>
              n.id === nodeId ? normalizeMindmapNode({ ...n, data: { ...n.data, ...data } }) : n,
            ),
          },
        ]),
      ) as Record<string, ContainerCanvas>;

      const breadcrumb = s.breadcrumb.map((item) =>
        item.id === nodeId && typeof data.label === 'string'
          ? { ...item, label: data.label }
          : item,
      );

      return {
        ...(trackHistory ? pushMindmapHistoryState(s) : {}),
        nodes: nextNodes,
        containerCanvases: nextContainerCanvases,
        breadcrumb,
      };
    });
    _notifyExtension(get());
  },

  deleteNode: (nodeId) => {
    set((s) => {
      const targetNode = s.nodes.find((node) => node.id === nodeId);
      const deletedNodeIds = collectNestedContainerNodeIds(
        s.containerCanvases,
        [nodeId],
      );
      const shouldExit = s.activeContainerId === nodeId;

      const nextNodes = s.nodes.filter((n) => n.id !== nodeId);
      const nextEdges = s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

      return {
        ...(targetNode?.type === 'mindmap' ? pushMindmapHistoryState(s) : {}),
        nodes: nextNodes,
        edges: nextEdges,
        containerCanvases: removeContainerCanvasEntries(s.containerCanvases, deletedNodeIds),
        tasks: removeTaskLinksForDeletedNodes(s.tasks, deletedNodeIds),
        mindmapBoundaries: refreshMindmapBoundaries(
          s.mindmapBoundaries,
          nextNodes,
          nextEdges,
        ),
        ...(shouldExit
          ? {
              currentLayer: 'context' as const,
              activeContainerId: null,
              breadcrumb: [],
            }
          : {}),
      };
    });
    _notifyExtension(get());
  },

  deleteContainerNode: (parentContainerId, nodeId) => {
    set((s) => {
      const canvas = ensureContainerCanvas(s.containerCanvases, parentContainerId);
      const descendants = collectDescendantNodeIds(canvas.edges, nodeId);
      const deletedIds = collectNestedContainerNodeIds(
        s.containerCanvases,
        [nodeId, ...descendants],
      );

      return {
        containerCanvases: withUpdatedContainerCanvas(
          removeContainerCanvasEntries(s.containerCanvases, deletedIds),
          parentContainerId,
          (currentCanvas) => ({
            ...currentCanvas,
            nodes: currentCanvas.nodes.filter((n) => !deletedIds.has(n.id)),
            edges: currentCanvas.edges.filter(
              (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target),
            ),
          }),
        ),
        tasks: removeTaskLinksForDeletedNodes(s.tasks, deletedIds),
      };
    });
    _notifyExtension(get());
  },

  addMindmapSibling: (nodeId) => {
    const s = get();
    const parentEdge = getMindmapEdges(s.nodes, s.edges).find((e) => e.target === nodeId);
    if (!parentEdge) return null;

    const targetNode = s.nodes.find((n) => n.id === nodeId);
    const pos = targetNode ? { x: targetNode.position.x, y: targetNode.position.y + 100 } : { x: 0, y: 0 };
    const created = get().addNode('mindmap', pos, '新規ノード', parentEdge.source);
    set((state) => ({ nodes: selectMindmapNode(state.nodes, created.id) }));
    _notifyExtension(get());
    return created;
  },

  addMindmapChild: (nodeId) => {
    const s = get();
    const parentNode = s.nodes.find((n) => n.id === nodeId);
    const childrenCount = getMindmapEdges(s.nodes, s.edges).filter((e) => e.source === nodeId).length;

    const posX = parentNode ? parentNode.position.x + 250 : 250;
    const posY = parentNode ? parentNode.position.y + (childrenCount * 60) : 0;

    const created = get().addNode('mindmap', { x: posX, y: posY }, '新規ノード', nodeId);
    set((state) => ({ nodes: selectMindmapNode(state.nodes, created.id) }));
    _notifyExtension(get());
    return created;
  },

  deleteMindmapNode: (nodeId) => {
    const s = get();
    const toDelete = collectMindmapSubtreeNodeIds(s, nodeId);
    const toDeleteSet = new Set(toDelete);

    set((state) => {
      const nextNodes = state.nodes.filter((node) => !toDeleteSet.has(node.id));
      const nextEdges = state.edges.filter((edge) => !toDeleteSet.has(edge.source) && !toDeleteSet.has(edge.target));
      return {
        ...pushMindmapHistoryState(state),
        nodes: nextNodes,
        edges: nextEdges,
        tasks: removeTaskLinksForDeletedNodes(state.tasks, toDeleteSet),
        mindmapBoundaries: refreshMindmapBoundaries(
          state.mindmapBoundaries,
          nextNodes,
          nextEdges,
        ),
      };
    });
    _notifyExtension(get());
  },

  // --- M13: mindmap 操作 ---

  captureMindmapHistory: () => {
    set((s) => pushMindmapHistoryState(s));
  },

  undoMindmap: () => {
    set((s) => {
      if (s.mindmapUndoStack.length === 0) {
        return s;
      }
      const prev = s.mindmapUndoStack[s.mindmapUndoStack.length - 1];
      const current = createMindmapSnapshot(s);
      const nextUndo = s.mindmapUndoStack.slice(0, -1);
      const nextRedo = [...s.mindmapRedoStack, current];
      while (nextRedo.length > MINDMAP_HISTORY_LIMIT) {
        nextRedo.shift();
      }

      return {
        ...applyMindmapSnapshot(s, prev),
        ...buildHistoryState(nextUndo, nextRedo),
      };
    });
    _notifyExtension(get());
  },

  redoMindmap: () => {
    set((s) => {
      if (s.mindmapRedoStack.length === 0) {
        return s;
      }
      const next = s.mindmapRedoStack[s.mindmapRedoStack.length - 1];
      const current = createMindmapSnapshot(s);
      const nextRedo = s.mindmapRedoStack.slice(0, -1);
      const nextUndo = [...s.mindmapUndoStack, current];
      while (nextUndo.length > MINDMAP_HISTORY_LIMIT) {
        nextUndo.shift();
      }

      return {
        ...applyMindmapSnapshot(s, next),
        ...buildHistoryState(nextUndo, nextRedo),
      };
    });
    _notifyExtension(get());
  },

  toggleMindmapCollapsed: (nodeId) => {
    set((s) => ({
      ...pushMindmapHistoryState(s),
      nodes: s.nodes.map((node) => {
        if (node.type !== 'mindmap' || node.id !== nodeId) return node;
        return {
          ...node,
          data: {
            ...node.data,
            collapsed: !node.data.collapsed,
          },
        };
      }),
    }));
    _notifyExtension(get());
  },

  setMindmapDescendantsCollapsed: (nodeId, collapsed) => {
    set((s) => {
      const descendants = new Set(collectMindmapSubtreeNodeIds(s, nodeId).slice(1));
      return {
        ...pushMindmapHistoryState(s),
        nodes: s.nodes.map((node) => {
          if (node.type !== 'mindmap' || !descendants.has(node.id)) return node;
          return {
            ...node,
            data: {
              ...node.data,
              collapsed,
            },
          };
        }),
      };
    });
    _notifyExtension(get());
  },

  updateMindmapNote: (nodeId, note) => {
    set((s) => {
      const normalized = note.trim();
      return {
        ...pushMindmapHistoryState(s),
        nodes: s.nodes.map((node) => {
          if (node.type !== 'mindmap' || node.id !== nodeId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              note: normalized ? note : undefined,
            },
          };
        }),
      };
    });
    _notifyExtension(get());
  },

  updateEdgeLabel: (edgeId, label) => {
    set((s) => {
      const target = s.edges.find((edge) => edge.id === edgeId);
      const shouldTrackHistory = !!target && isMindmapEdge(s.nodes, target);
      const normalized = label.trim();

      return {
        ...(shouldTrackHistory ? pushMindmapHistoryState(s) : {}),
        edges: s.edges.map((edge) => (
          edge.id !== edgeId
            ? edge
            : {
                ...edge,
                label: normalized ? normalized : undefined,
              }
        )),
      };
    });
    _notifyExtension(get());
  },

  reparentMindmapNode: (nodeId, newParentId) => {
    let changed = false;
    set((s) => {
      if (nodeId === newParentId) {
        return s;
      }
      const node = s.nodes.find((n) => n.id === nodeId && n.type === 'mindmap');
      const newParent = s.nodes.find((n) => n.id === newParentId && n.type === 'mindmap');
      if (!node || !newParent) {
        return s;
      }

      const mindmapEdges = getMindmapEdges(s.nodes, s.edges);
      const descendants = new Set(collectDescendantNodeIds(mindmapEdges, nodeId));
      if (descendants.has(newParentId)) {
        return s;
      }

      const currentParentEdge = mindmapEdges.find((edge) => edge.target === nodeId);
      if (currentParentEdge?.source === newParentId) {
        return s;
      }

      const mindmapNodeIds = getMindmapNodeIds(s.nodes);
      const nonMindmapEdges = s.edges.filter(
        (edge) => !mindmapNodeIds.has(edge.source) || !mindmapNodeIds.has(edge.target),
      );
      const nextMindmapEdges = mindmapEdges.filter((edge) => edge.target !== nodeId);
      nextMindmapEdges.push({
        id: generateEdgeId(),
        source: newParentId,
        target: nodeId,
      });
      const nextEdges = [...nonMindmapEdges, ...nextMindmapEdges];
      const nextNodes = s.nodes.map((n) => {
        if (n.id !== newParentId) return n;
        return {
          ...n,
          data: {
            ...n.data,
            collapsed: false,
          },
        };
      });
      changed = true;

      return {
        ...pushMindmapHistoryState(s),
        nodes: nextNodes,
        edges: nextEdges,
        mindmapBoundaries: refreshMindmapBoundaries(
          s.mindmapBoundaries,
          nextNodes,
          nextEdges,
        ),
      };
    });

    if (changed) {
      _notifyExtension(get());
    }
    return changed;
  },

  setMindmapCheckboxEnabled: (nodeId, enabled) => {
    set((s) => ({
      ...pushMindmapHistoryState(s),
      nodes: s.nodes.map((node) => {
        if (node.type !== 'mindmap' || node.id !== nodeId) return node;
        return {
          ...node,
          data: {
            ...node.data,
            checkboxEnabled: enabled,
            checked: enabled ? !!node.data.checked : false,
          },
        };
      }),
    }));
    _notifyExtension(get());
  },

  setMindmapSubtreeCheckboxEnabled: (nodeId, enabled) => {
    set((s) => {
      const targetIds = new Set(collectMindmapSubtreeNodeIds(s, nodeId));
      return {
        ...pushMindmapHistoryState(s),
        nodes: s.nodes.map((node) => {
          if (node.type !== 'mindmap' || !targetIds.has(node.id)) return node;
          return {
            ...node,
            data: {
              ...node.data,
              checkboxEnabled: enabled,
              checked: enabled ? !!node.data.checked : false,
            },
          };
        }),
      };
    });
    _notifyExtension(get());
  },

  toggleMindmapChecked: (nodeId, applySubtree = false) => {
    set((s) => {
      const target = s.nodes.find((node) => node.type === 'mindmap' && node.id === nodeId);
      if (!target || !target.data.checkboxEnabled) {
        return s;
      }

      const nextChecked = !target.data.checked;
      const targetIds = applySubtree
        ? new Set(collectMindmapSubtreeNodeIds(s, nodeId))
        : new Set([nodeId]);

      return {
        ...pushMindmapHistoryState(s),
        nodes: s.nodes.map((node) => {
          if (node.type !== 'mindmap' || !targetIds.has(node.id)) return node;
          if (!node.data.checkboxEnabled) return node;
          return {
            ...node,
            data: {
              ...node.data,
              checked: nextChecked,
            },
          };
        }),
      };
    });
    _notifyExtension(get());
  },

  toggleMindmapBoundary: (nodeId) => {
    set((s) => {
      const node = s.nodes.find((n) => n.id === nodeId && n.type === 'mindmap');
      if (!node) {
        return s;
      }
      const boundaryId = `boundary-${nodeId}`;
      const existing = s.mindmapBoundaries[boundaryId];
      const nextBoundaries = { ...s.mindmapBoundaries };
      if (existing) {
        nextBoundaries[boundaryId] = {
          ...existing,
          visible: !existing.visible,
        };
      } else {
        nextBoundaries[boundaryId] = {
          id: boundaryId,
          label: `${node.data.label} Boundary`,
          nodeIds: collectMindmapSubtreeNodeIds(s, nodeId),
          visible: true,
        };
      }
      const nextNodes = s.nodes.map((n) => {
        if (n.id !== nodeId || n.type !== 'mindmap') return n;
        return {
          ...n,
          data: {
            ...n.data,
            boundaryId,
          },
        };
      });

      return {
        ...pushMindmapHistoryState(s),
        nodes: nextNodes,
        mindmapBoundaries: refreshMindmapBoundaries(
          nextBoundaries,
          nextNodes,
          s.edges,
        ),
      };
    });
    _notifyExtension(get());
  },

  toggleMindmapBoundaryVisibility: (boundaryId) => {
    set((s) => {
      const target = s.mindmapBoundaries[boundaryId];
      if (!target) return s;
      return {
        ...pushMindmapHistoryState(s),
        mindmapBoundaries: {
          ...s.mindmapBoundaries,
          [boundaryId]: {
            ...target,
            visible: !target.visible,
          },
        },
      };
    });
    _notifyExtension(get());
  },

  setMindmapNodeColor: (nodeId, color) => {
    set((s) => {
      if (typeof color === 'string' && !HEX_COLOR_PATTERN.test(color)) {
        return s;
      }
      return {
        ...pushMindmapHistoryState(s),
        nodes: s.nodes.map((node) => {
          if (node.type !== 'mindmap' || node.id !== nodeId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              color,
            },
          };
        }),
      };
    });
    _notifyExtension(get());
  },

  setMindmapNodeStyleRole: (nodeId, role) => {
    set((s) => ({
      ...pushMindmapHistoryState(s),
      nodes: s.nodes.map((node) => {
        if (node.type !== 'mindmap' || node.id !== nodeId) return node;
        return {
          ...node,
          data: {
            ...node.data,
            styleRole: role,
          },
        };
      }),
    }));
    _notifyExtension(get());
  },

  setMindmapSnapEnabled: (enabled) => {
    set((s) => ({
      mindmapSettings: {
        ...s.mindmapSettings,
        snapEnabled: enabled,
      },
    }));
    _notifyExtension(get());
  },

  // --- タスク CRUD ---

  addTask: (title) => {
    const now = new Date().toISOString();
    const task: KanbanTask = {
      id: generateTaskId(),
      status: 'Todo',
      title,
      linkedNodeIds: [],
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ tasks: { ...s.tasks, [task.id]: task } }));
    _notifyExtension(get());
    return task;
  },

  updateTask: (taskId, patch) => {
    set((s) => {
      const task = s.tasks[taskId];
      if (!task) return s;
      return {
        tasks: {
          ...s.tasks,
          [taskId]: {
            ...task,
            ...patch,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
    _notifyExtension(get());
  },

  updateTaskStatus: (taskId, status) => {
    set((s) => {
      const task = s.tasks[taskId];
      if (!task) return s;
      return {
        tasks: {
          ...s.tasks,
          [taskId]: { ...task, status, updatedAt: new Date().toISOString() },
        },
      };
    });
    _notifyExtension(get());
  },

  updateTaskTitle: (taskId, title) => {
    set((s) => {
      const task = s.tasks[taskId];
      if (!task) return s;
      return {
        tasks: {
          ...s.tasks,
          [taskId]: { ...task, title, updatedAt: new Date().toISOString() },
        },
      };
    });
    _notifyExtension(get());
  },

  deleteTask: (taskId) => {
    set((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [taskId]: _removed, ...remaining } = s.tasks;
      return { tasks: remaining };
    });
    _notifyExtension(get());
  },

  linkTaskToNode: (taskId, nodeId) => {
    set((s) => {
      const task = s.tasks[taskId];
      if (!task || task.linkedNodeIds.includes(nodeId)) return s;
      return {
        tasks: {
          ...s.tasks,
          [taskId]: {
            ...task,
            linkedNodeIds: [...task.linkedNodeIds, nodeId],
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
    _notifyExtension(get());
  },

  // --- 創発的タスク ---

  addEmergentTaskFromAI: (title) => {
    const now = new Date().toISOString();
    const task: KanbanTask = {
      id: generateTaskId(),
      status: 'Inbox',
      title,
      linkedNodeIds: [],
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ tasks: { ...s.tasks, [task.id]: task } }));
    _notifyExtension(get());
    return task;
  },

  // --- ADR CRUD ---

  addADR: (linkedNodeId, title) => {
    const s = get();
    if (!hasC4LinkedNode(linkedNodeId, s.nodes, s.containerCanvases)) {
      return null;
    }

    const adr: ADR = {
      id: generateAdrId(),
      linkedNodeId,
      title,
      decision: '',
      rejectedOptions: [],
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ adrs: { ...state.adrs, [adr.id]: adr } }));
    _notifyExtension(get());
    return adr;
  },

  updateADR: (adrId, patch) => {
    set((s) => {
      const adr = s.adrs[adrId];
      if (!adr) return s;
      return {
        adrs: { ...s.adrs, [adrId]: { ...adr, ...patch } },
      };
    });
    _notifyExtension(get());
  },

  deleteADR: (adrId) => {
    set((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [adrId]: _removed, ...remaining } = s.adrs;
      return { adrs: remaining };
    });
    _notifyExtension(get());
  },

  // --- 状態一括更新（逆同期専用） ---
  setState: (newState) => {
    const normalizedState = normalizeAriaState(newState);
    set({
      ...normalizedState,
      containerCanvases: normalizedState.containerCanvases ?? {},
      mindmapBoundaries: normalizedState.mindmapBoundaries ?? {},
      mindmapSettings: normalizeMindmapSettings(normalizedState.mindmapSettings),
      mindmapUndoStack: [],
      mindmapRedoStack: [],
      canUndoMindmap: false,
      canRedoMindmap: false,
      lastModified: new Date().toISOString(),
    });
    // 逆同期では Extension Host への通知は行わない（無限ループ防止）
  },
}));

let _debounceTimer: ReturnType<typeof setTimeout> | undefined;

function _notifyExtension(state: AriaStoreState): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    const {
      nodes,
      edges,
      tasks,
      adrs,
      containerCanvases,
      mindmapBoundaries,
      mindmapSettings,
      version,
      lastModified,
    } = state;
    const payload: AriaState = {
      nodes,
      edges,
      tasks,
      adrs,
      containerCanvases,
      mindmapBoundaries,
      mindmapSettings,
      version,
      lastModified,
    };
    postToExtension({ type: 'STATE_CHANGED', payload });
  }, 300);
}
