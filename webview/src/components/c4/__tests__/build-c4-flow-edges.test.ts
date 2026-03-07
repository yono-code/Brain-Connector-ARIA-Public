import { describe, expect, it } from 'vitest';
import type { AriaEdge } from '../../../../../src/shared/types';
import { buildC4FlowEdges } from '../build-c4-flow-edges';

function makeBaseEdge(overrides: Partial<AriaEdge> = {}): AriaEdge {
  return {
    id: 'edge-1',
    source: 'node-a',
    target: 'node-b',
    variant: 'single-forward',
    ...overrides,
  };
}

describe('buildC4FlowEdges', () => {
  it('keeps double-parallel lanes on the same source/target pair', () => {
    const flowEdges = buildC4FlowEdges([
      makeBaseEdge({
        variant: 'double-parallel',
        sourceLabel: 'req',
        targetLabel: 'res',
      }),
    ]);

    expect(flowEdges).toHaveLength(2);

    const laneForward = flowEdges[0];
    const laneReverse = flowEdges[1];

    expect(laneForward.id).toBe('edge-1');
    expect(laneReverse.id).toBe('edge-1::reverse');
    expect(laneForward.source).toBe('node-a');
    expect(laneForward.target).toBe('node-b');
    expect(laneReverse.source).toBe('node-a');
    expect(laneReverse.target).toBe('node-b');
    expect(laneForward.sourceHandle).toBe('c4-out-left');
    expect(laneForward.targetHandle).toBe('c4-in-left');
    expect(laneReverse.sourceHandle).toBe('c4-out-right');
    expect(laneReverse.targetHandle).toBe('c4-in-right');

    expect(laneForward.markerStart).toBeUndefined();
    expect(laneForward.markerEnd).toBeDefined();
    expect(laneReverse.markerStart).toBeDefined();
    expect(laneReverse.markerEnd).toBeUndefined();

    expect(laneForward.label).toBe('req');
    expect(laneReverse.label).toBe('res');

    const laneForwardData = laneForward.data as {
      pathOffset: number;
      routeOffset: number;
      labelOffset: number;
      labelAlongOffset: number;
      bendYOffset: number;
    };
    const laneReverseData = laneReverse.data as {
      pathOffset: number;
      routeOffset: number;
      labelOffset: number;
      labelAlongOffset: number;
      bendYOffset: number;
    };

    expect(laneForwardData.pathOffset).toBe(0);
    expect(laneReverseData.pathOffset).toBe(0);
    expect(laneForwardData.routeOffset).toBe(28);
    expect(laneReverseData.routeOffset).toBe(28);
    expect(laneForwardData.labelOffset).toBeGreaterThan(0);
    expect(laneForwardData.labelAlongOffset).toBeLessThan(0);
    expect(laneForwardData.bendYOffset).toBeLessThan(0);
    expect(laneReverseData.labelOffset).toBeLessThan(0);
    expect(laneReverseData.labelAlongOffset).toBeGreaterThan(0);
    expect(laneReverseData.bendYOffset).toBeGreaterThan(0);
  });

  it('uses base label fallback for double-parallel labels', () => {
    const flowEdges = buildC4FlowEdges([
      makeBaseEdge({
        variant: 'double-parallel',
        label: 'shared',
      }),
    ]);

    expect(flowEdges).toHaveLength(2);
    expect(flowEdges[0].label).toBe('shared');
    expect(flowEdges[1].label).toBe('shared');
  });

  it('maps non-parallel variants to expected arrow sides', () => {
    const singleForward = buildC4FlowEdges([makeBaseEdge({ variant: 'single-forward' })])[0];
    const singleReverse = buildC4FlowEdges([makeBaseEdge({ variant: 'single-reverse' })])[0];
    const doubleHeaded = buildC4FlowEdges([makeBaseEdge({ variant: 'double-headed' })])[0];

    expect(singleForward.sourceHandle).toBe('c4-out-center');
    expect(singleForward.targetHandle).toBe('c4-in-center');
    expect(singleForward.markerStart).toBeUndefined();
    expect(singleForward.markerEnd).toBeDefined();
    expect(singleReverse.markerStart).toBeDefined();
    expect(singleReverse.markerEnd).toBeUndefined();
    expect(doubleHeaded.markerStart).toBeDefined();
    expect(doubleHeaded.markerEnd).toBeDefined();
  });
});
