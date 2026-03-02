import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Panel } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection, Node as FlowNode } from '@xyflow/react';
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

const nodeTypes = {
  'c4-container': C4ContainerNode,
  'c4-component': C4ContainerNode,
  mindmap: MindmapNode,
};

interface AriaCanvasProps {
  canvasType: 'c4' | 'mindmap';
}

const SNAP_THRESHOLD = 8;
const REPARENT_DISTANCE_THRESHOLD = 140;

function isMindmapFlowNode(node: FlowNode): boolean {
  return node.type === 'mindmap';
}

export function AriaCanvas({ canvasType }: AriaCanvasProps) {
  const currentLayer = useAriaStore((s) => s.currentLayer);
  const activeContainerId = useAriaStore((s) => s.activeContainerId);
  const exitContainerLayer = useAriaStore((s) => s.exitContainerLayer);
  const getSurfaceNodes = useAriaStore((s) => s.getSurfaceNodes);
  const getSurfaceEdges = useAriaStore((s) => s.getSurfaceEdges);
  const applyNodeChangesToSurface = useAriaStore((s) => s.applyNodeChangesToSurface);
  const applyEdgeChangesToSurface = useAriaStore((s) => s.applyEdgeChangesToSurface);
  const connectOnSurface = useAriaStore((s) => s.connectOnSurface);
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

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  const c4Surface: DiagramSurfaceRef =
    currentLayer === 'container' && activeContainerId
      ? { kind: 'c4-container', containerId: activeContainerId }
      : { kind: 'c4-context' };

  const surface: DiagramSurfaceRef =
    canvasType === 'c4'
      ? c4Surface
      : { kind: 'mindmap-root' };

  const nodes = getSurfaceNodes(surface);
  const edges = getSurfaceEdges(surface);

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  const handleNodesChange = (changes: NodeChange[]) => {
    applyNodeChangesToSurface(surface, changes);
  };

  const handleEdgesChange = (changes: EdgeChange[]) => {
    applyEdgeChangesToSurface(surface, changes);
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

    const candidates = nodes
      .filter((n) => n.id !== node.id)
      .map((n) => {
        const dx = n.position.x - node.position.x;
        const dy = n.position.y - node.position.y;
        return {
          id: n.id,
          distance: Math.sqrt(dx * dx + dy * dy),
        };
      })
      .filter((entry) => entry.distance <= REPARENT_DISTANCE_THRESHOLD)
      .sort((a, b) => a.distance - b.distance);

    if (candidates.length === 0) {
      return;
    }

    reparentMindmapNode(node.id, candidates[0].id);
  };

  useEffect(() => {
    if (canvasType !== 'mindmap') return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
        addMindmapSibling: (nodeId) => { addMindmapSibling(nodeId); },
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
    deleteMindmapNode,
    undoMindmap,
    redoMindmap,
  ]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        fitView
        colorMode="dark"
        onPaneContextMenu={(e) => e.preventDefault()}
        onPaneClick={() => setSelectedEdgeId(null)}
        onEdgeClick={(_event, edge) => setSelectedEdgeId(edge.id)}
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
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
