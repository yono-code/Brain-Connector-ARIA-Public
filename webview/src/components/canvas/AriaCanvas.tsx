import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Panel, MarkerType } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection, Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAriaStore } from '../../store/aria-store';
import type { DiagramSurfaceRef } from '../../store/aria-store';
import { C4ContainerNode } from './nodes/C4ContainerNode';
import { MindmapNode } from './nodes/MindmapNode';
import { BreadcrumbNav } from './BreadcrumbNav';
import { handleMindmapShortcut } from './mindmap-keyboard';
import { EdgeLabelEditor } from '../mindmap/EdgeLabelEditor';
import { SnapGuides } from '../mindmap/SnapGuides';
import type { SnapGuide } from '../mindmap/SnapGuides';
import { BoundaryLayer } from '../mindmap/BoundaryLayer';
import { useContextMenu } from '../context-menu/ContextMenu';
import { C4EdgeEditor } from '../c4/C4EdgeEditor';
import { C4ReadableEdge } from '../c4/C4ReadableEdge';
import { buildC4FlowEdges } from '../c4/build-c4-flow-edges';

const nodeTypes = {
  'c4-container': C4ContainerNode,
  'c4-component': C4ContainerNode,
  'c4-person': C4ContainerNode,
  'c4-database': C4ContainerNode,
  'c4-module': C4ContainerNode,
  mindmap: MindmapNode,
};

const edgeTypes = {
  c4Readable: C4ReadableEdge,
};

interface AriaCanvasProps {
  canvasType: 'c4' | 'mindmap';
}

const SNAP_THRESHOLD = 8;
const REPARENT_DISTANCE_THRESHOLD = 72;
const REPARENT_HITBOX_PADDING = 24;

function isMindmapFlowNode(node: FlowNode): boolean {
  return node.type === 'mindmap';
}

function isInputLikeTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) {
    return false;
  }
  const tag = el.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  return el.isContentEditable;
}

function toBaseEdgeId(flowEdgeId: string): string {
  const [baseId] = flowEdgeId.split('::');
  return baseId;
}

function resolveBaseEdgeId(edge: FlowEdge): string {
  const base = (edge.data as { baseEdgeId?: string } | undefined)?.baseEdgeId;
  return typeof base === 'string' ? base : toBaseEdgeId(edge.id);
}

export function AriaCanvas({ canvasType }: AriaCanvasProps) {
  const currentLayer = useAriaStore((s) => s.currentLayer);
  const activeContainerId = useAriaStore((s) => s.activeContainerId);
  const exitContainerLayer = useAriaStore((s) => s.exitContainerLayer);
  const storeNodes = useAriaStore((s) => s.nodes);
  const storeEdges = useAriaStore((s) => s.edges);
  const storeContainerCanvases = useAriaStore((s) => s.containerCanvases);
  const getSurfaceNodes = useAriaStore((s) => s.getSurfaceNodes);
  const getSurfaceEdges = useAriaStore((s) => s.getSurfaceEdges);
  const applyNodeChangesToSurface = useAriaStore((s) => s.applyNodeChangesToSurface);
  const applyEdgeChangesToSurface = useAriaStore((s) => s.applyEdgeChangesToSurface);
  const connectOnSurface = useAriaStore((s) => s.connectOnSurface);
  const alignSurface = useAriaStore((s) => s.alignSurface);
  const updateEdge = useAriaStore((s) => s.updateEdge);
  const deleteEdge = useAriaStore((s) => s.deleteEdge);
  const addMindmapSibling = useAriaStore((s) => s.addMindmapSibling);
  const addMindmapChild = useAriaStore((s) => s.addMindmapChild);
  const deleteMindmapNode = useAriaStore((s) => s.deleteMindmapNode);
  const undoMindmap = useAriaStore((s) => s.undoMindmap);
  const redoMindmap = useAriaStore((s) => s.redoMindmap);
  const updateEdgeLabel = useAriaStore((s) => s.updateEdgeLabel);
  const reparentMindmapNode = useAriaStore((s) => s.reparentMindmapNode);
  const captureMindmapHistory = useAriaStore((s) => s.captureMindmapHistory);
  const mindmapSettings = useAriaStore((s) => s.mindmapSettings);
  const mindmapBoundaries = useAriaStore((s) => s.mindmapBoundaries);
  const selectMindmapNode = useAriaStore((s) => s.selectMindmapNode);
  const { openContextMenu } = useContextMenu();

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  const c4Surface: DiagramSurfaceRef = useMemo(() => (
    currentLayer === 'container' && activeContainerId
      ? { kind: 'c4-container', containerId: activeContainerId }
      : { kind: 'c4-context' }
  ), [activeContainerId, currentLayer]);

  const surface: DiagramSurfaceRef = useMemo(() => (
    canvasType === 'c4'
      ? c4Surface
      : { kind: 'mindmap-root' }
  ), [canvasType, c4Surface]);

  const nodes = useMemo(
    () => getSurfaceNodes(surface),
    [getSurfaceNodes, surface, storeNodes, storeEdges, storeContainerCanvases],
  );
  const edges = useMemo(
    () => getSurfaceEdges(surface),
    [getSurfaceEdges, surface, storeNodes, storeEdges, storeContainerCanvases],
  );
  const renderEdges = useMemo(
    () => (canvasType === 'c4' ? buildC4FlowEdges(edges) : edges as FlowEdge[]),
    [canvasType, edges],
  );

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  const handleNodesChange = (changes: NodeChange[]) => {
    applyNodeChangesToSurface(surface, changes);
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    const normalized = changes.map((change) => (
      'id' in change
        ? {
            ...change,
            id: toBaseEdgeId(change.id),
          }
        : change
    ));
    const deduped = normalized.filter((change, index, arr) => {
      if (!('id' in change)) {
        return true;
      }
      return arr.findIndex((entry) => (
        'id' in entry &&
        entry.id === change.id &&
        entry.type === change.type
      )) === index;
    });
    applyEdgeChangesToSurface(surface, deduped);
  };

  const handleConnect = (connection: Connection) => {
    connectOnSurface(surface, connection);
  };

  const handleNodeDragStart = (_event: ReactMouseEvent, node: FlowNode) => {
    if (canvasType !== 'mindmap' || !isMindmapFlowNode(node)) {
      return;
    }
    captureMindmapHistory();
  };

  const handleNodeDrag = (_event: ReactMouseEvent, node: FlowNode) => {
    if (canvasType !== 'mindmap' || !isMindmapFlowNode(node) || !mindmapSettings.snapEnabled) {
      return;
    }

    let snappedX = node.position.x;
    let snappedY = node.position.y;
    let closestX = SNAP_THRESHOLD + 1;
    let closestY = SNAP_THRESHOLD + 1;
    const nextGuides: SnapGuide[] = [];

    for (const other of nodes) {
      if (other.id === node.id) continue;
      const dx = Math.abs(other.position.x - node.position.x);
      const dy = Math.abs(other.position.y - node.position.y);

      if (dx < closestX && dx <= SNAP_THRESHOLD) {
        closestX = dx;
        snappedX = other.position.x;
      }
      if (dy < closestY && dy <= SNAP_THRESHOLD) {
        closestY = dy;
        snappedY = other.position.y;
      }
    }

    if (closestX <= SNAP_THRESHOLD) {
      nextGuides.push({ axis: 'x', value: snappedX });
    }
    if (closestY <= SNAP_THRESHOLD) {
      nextGuides.push({ axis: 'y', value: snappedY });
    }
    setSnapGuides(nextGuides);

    if (snappedX !== node.position.x || snappedY !== node.position.y) {
      applyNodeChangesToSurface(surface, [{
        id: node.id,
        type: 'position',
        position: { x: snappedX, y: snappedY },
        dragging: true,
      } as NodeChange]);
    }
  };

  const handleNodeDragStop = (_event: ReactMouseEvent, node: FlowNode) => {
    if (canvasType !== 'mindmap' || !isMindmapFlowNode(node)) {
      setSnapGuides([]);
      return;
    }

    setSnapGuides([]);

    const nodeCenterX = node.position.x + (node.width ?? 160) / 2;
    const nodeCenterY = node.position.y + (node.height ?? 56) / 2;

    const candidates = nodes
      .filter((n) => n.id !== node.id)
      .map((n) => {
        const width = 160;
        const height = 56;
        const centerX = n.position.x + width / 2;
        const centerY = n.position.y + height / 2;
        const dx = centerX - nodeCenterX;
        const dy = centerY - nodeCenterY;
        const insideHitbox =
          nodeCenterX >= n.position.x - REPARENT_HITBOX_PADDING &&
          nodeCenterX <= n.position.x + width + REPARENT_HITBOX_PADDING &&
          nodeCenterY >= n.position.y - REPARENT_HITBOX_PADDING &&
          nodeCenterY <= n.position.y + height + REPARENT_HITBOX_PADDING;
        return {
          id: n.id,
          distance: Math.sqrt(dx * dx + dy * dy),
          insideHitbox,
        };
      })
      .filter((entry) =>
        entry.distance <= REPARENT_DISTANCE_THRESHOLD &&
        entry.insideHitbox,
      )
      .sort((a, b) => a.distance - b.distance);

    if (candidates.length === 0) {
      return;
    }

    reparentMindmapNode(node.id, candidates[0].id);
  };

  const handleEdgeContextMenu = (event: ReactMouseEvent, edge: FlowEdge) => {
    event.preventDefault();
    event.stopPropagation();
    const baseEdgeId = resolveBaseEdgeId(edge);
    setSelectedEdgeId(baseEdgeId);
    openContextMenu(event.clientX, event.clientY, [
      {
        icon: '✏️',
        label: canvasType === 'c4' ? 'ラインを編集' : 'ラベルを編集',
        onClick: () => setSelectedEdgeId(baseEdgeId),
      },
      { separator: true, label: '', onClick: () => {} },
      {
        icon: '🗑',
        label: 'ラインを削除',
        danger: true,
        onClick: () => {
          deleteEdge(baseEdgeId);
          setSelectedEdgeId(null);
        },
      },
    ]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputLikeTarget(e.target)) {
        return;
      }

      const normalizedKey = e.key.toLowerCase();
      const withModifier = e.ctrlKey || e.metaKey;

      if (withModifier && e.shiftKey && normalizedKey === 'l') {
        e.preventDefault();
        e.stopPropagation();
        alignSurface(surface);
        return;
      }

      if (selectedEdgeId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        e.stopPropagation();
        deleteEdge(selectedEdgeId);
        setSelectedEdgeId(null);
        return;
      }

      if (canvasType !== 'mindmap') {
        return;
      }

      handleMindmapShortcut({
        canvasType,
        nodes,
        event: {
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          targetTagName: (e.target as Element | null)?.tagName,
          preventDefault: () => e.preventDefault(),
          stopPropagation: () => e.stopPropagation(),
        },
        addMindmapChild,
        addMindmapSibling: (nodeId) => addMindmapSibling(nodeId),
        focusMindmapNode: (nodeId) => selectMindmapNode(nodeId),
        deleteMindmapNode,
        undoMindmap,
        redoMindmap,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canvasType,
    nodes,
    addMindmapChild,
    addMindmapSibling,
    alignSurface,
    deleteEdge,
    deleteMindmapNode,
    undoMindmap,
    redoMindmap,
    selectedEdgeId,
    surface,
  ]);

  const defaultEdgeOptions = useMemo(() => (
    canvasType === 'mindmap'
      ? {
          style: {
            stroke: 'var(--aria-edge-color)',
            strokeWidth: 3,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'var(--aria-edge-color)',
            width: 18,
            height: 18,
          },
        }
      : {
          style: {
            stroke: 'var(--aria-edge-color)',
            strokeWidth: 3,
          },
        }
  ), [canvasType]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={renderEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        colorMode="dark"
        onPaneContextMenu={(e) => e.preventDefault()}
        onPaneClick={() => setSelectedEdgeId(null)}
        onEdgeClick={(_event, edge) => setSelectedEdgeId(resolveBaseEdgeId(edge))}
        onEdgeContextMenu={handleEdgeContextMenu}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
      >
        {canvasType === 'c4' && currentLayer === 'container' && (
          <Panel position="top-left">
            <button
              onClick={exitContainerLayer}
              style={{
                background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                color: 'var(--vscode-button-secondaryForeground, #cccccc)',
                border: '1px solid var(--vscode-panel-border, #454545)',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              ← 戻る
            </button>
          </Panel>
        )}
        {canvasType === 'c4' && <BreadcrumbNav />}
        {canvasType === 'mindmap' && (
          <>
            <BoundaryLayer nodes={nodes} boundaries={mindmapBoundaries} />
            <SnapGuides guides={snapGuides} />
            <EdgeLabelEditor
              edge={selectedEdge}
              nodes={nodes}
              onClose={() => setSelectedEdgeId(null)}
              onCommit={(value) => {
                if (selectedEdge) {
                  updateEdgeLabel(selectedEdge.id, value);
                }
                setSelectedEdgeId(null);
              }}
            />
          </>
        )}
        {canvasType === 'c4' && (
          <C4EdgeEditor
            edge={selectedEdge}
            nodes={nodes}
            onClose={() => setSelectedEdgeId(null)}
            onDelete={() => {
              if (!selectedEdge) {
                return;
              }
              deleteEdge(selectedEdge.id);
              setSelectedEdgeId(null);
            }}
            onCommit={(patch) => {
              if (!selectedEdge) {
                return;
              }
              updateEdge(selectedEdge.id, patch);
              setSelectedEdgeId(null);
            }}
          />
        )}
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
