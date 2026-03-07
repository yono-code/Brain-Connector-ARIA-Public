import type { Edge as FlowEdge } from '@xyflow/react';
import type { AriaEdge } from '../../../../src/shared/types';

interface C4ReadableEdgeData {
  baseEdgeId: string;
  pathOffset: number;
  routeOffset: number;
  labelOffset: number;
  labelAlongOffset: number;
  bendYOffset: number;
}

const C4_IN_LEFT = 'c4-in-left';
const C4_IN_CENTER = 'c4-in-center';
const C4_IN_RIGHT = 'c4-in-right';
const C4_OUT_LEFT = 'c4-out-left';
const C4_OUT_CENTER = 'c4-out-center';
const C4_OUT_RIGHT = 'c4-out-right';

const baseStyle = {
  stroke: 'var(--aria-edge-color)',
  strokeWidth: 2.8,
};

const arrowMarker = {
  type: 'arrowclosed',
  color: 'var(--aria-edge-color)',
  width: 14,
  height: 14,
} as const;

export function buildC4FlowEdges(edges: AriaEdge[]): FlowEdge[] {
  const result: FlowEdge[] = [];

  for (const edge of edges) {
    const variant = edge.variant ?? 'single-forward';
    const common = {
      data: {
        baseEdgeId: edge.id,
        pathOffset: 0,
        routeOffset: 26,
        labelOffset: 0,
        labelAlongOffset: 0,
        bendYOffset: 0,
      } satisfies C4ReadableEdgeData,
      style: baseStyle,
      type: 'c4Readable',
    } as const;

    if (variant === 'double-parallel') {
      result.push({
        ...edge,
        ...common,
        sourceHandle: C4_OUT_LEFT,
        targetHandle: C4_IN_LEFT,
        label: edge.sourceLabel ?? edge.label,
        markerEnd: arrowMarker,
        data: {
          ...common.data,
          pathOffset: 0,
          routeOffset: 28,
          labelOffset: 20,
          labelAlongOffset: -16,
          bendYOffset: -18,
        },
      } as FlowEdge);

      result.push({
        ...edge,
        ...common,
        id: `${edge.id}::reverse`,
        sourceHandle: C4_OUT_RIGHT,
        targetHandle: C4_IN_RIGHT,
        label: edge.targetLabel ?? edge.label,
        markerStart: arrowMarker,
        data: {
          ...common.data,
          pathOffset: 0,
          routeOffset: 28,
          labelOffset: -20,
          labelAlongOffset: 16,
          bendYOffset: 18,
        },
      } as FlowEdge);

      continue;
    }

    result.push({
      ...edge,
      ...common,
      sourceHandle: C4_OUT_CENTER,
      targetHandle: C4_IN_CENTER,
      markerStart: variant === 'single-reverse' || variant === 'double-headed'
        ? arrowMarker
        : undefined,
      markerEnd: variant === 'single-forward' || variant === 'double-headed'
        ? arrowMarker
        : undefined,
    } as FlowEdge);
  }

  return result;
}
