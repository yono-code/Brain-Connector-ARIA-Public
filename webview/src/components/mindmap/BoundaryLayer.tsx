import { useMemo } from 'react';
import { useViewport } from '@xyflow/react';
import type { AriaNode, MindmapBoundary } from '../../../../src/shared/types';

interface BoundaryLayerProps {
  nodes: AriaNode[];
  boundaries: Record<string, MindmapBoundary>;
}

interface Rect {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_HALF_WIDTH = 92;
const NODE_HALF_HEIGHT = 28;
const BOUNDARY_PADDING = 28;

export function BoundaryLayer({ nodes, boundaries }: BoundaryLayerProps) {
  const viewport = useViewport();

  const rects = useMemo<Rect[]>(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const computed: Rect[] = [];

    for (const boundary of Object.values(boundaries)) {
      if (!boundary.visible || boundary.nodeIds.length === 0) {
        continue;
      }

      const boundaryNodes = boundary.nodeIds
        .map((nodeId) => nodeById.get(nodeId))
        .filter((node): node is AriaNode => !!node);

      if (boundaryNodes.length === 0) {
        continue;
      }

      const minX = Math.min(...boundaryNodes.map((node) => node.position.x - NODE_HALF_WIDTH));
      const maxX = Math.max(...boundaryNodes.map((node) => node.position.x + NODE_HALF_WIDTH));
      const minY = Math.min(...boundaryNodes.map((node) => node.position.y - NODE_HALF_HEIGHT));
      const maxY = Math.max(...boundaryNodes.map((node) => node.position.y + NODE_HALF_HEIGHT));

      computed.push({
        id: boundary.id,
        label: boundary.label,
        x: minX - BOUNDARY_PADDING,
        y: minY - BOUNDARY_PADDING,
        width: (maxX - minX) + BOUNDARY_PADDING * 2,
        height: (maxY - minY) + BOUNDARY_PADDING * 2,
      });
    }

    return computed;
  }, [boundaries, nodes]);

  if (rects.length === 0) {
    return null;
  }

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
      }}
    >
      {rects.map((rect) => {
        const x = rect.x * viewport.zoom + viewport.x;
        const y = rect.y * viewport.zoom + viewport.y;
        const width = rect.width * viewport.zoom;
        const height = rect.height * viewport.zoom;
        const radius = 24 * viewport.zoom;

        return (
          <g key={rect.id}>
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={radius}
              ry={radius}
              fill="rgba(74, 158, 255, 0.08)"
              stroke="rgba(74, 158, 255, 0.45)"
              strokeDasharray="8 6"
              strokeWidth={1.2}
            />
            <text
              x={x + 10}
              y={y - 8}
              fill="var(--vscode-descriptionForeground, #9d9d9d)"
              fontSize={11}
            >
              {rect.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
