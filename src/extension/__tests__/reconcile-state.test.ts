import { describe, it, expect } from 'vitest';
import { reconcileState } from '../reconcile-state';
import type { AriaState } from '../../shared/types';

function baseState(): AriaState {
  return {
    nodes: [],
    edges: [],
    tasks: {},
    adrs: {},
    containerCanvases: {},
    version: '1.0.0',
    lastModified: '2026-02-26T00:00:00.000Z',
  };
}

describe('reconcileState (M9 containerCanvases)', () => {
  it('keeps root node positions from current but prefers incoming containerCanvases', () => {
    const incoming: AriaState = {
      ...baseState(),
      nodes: [
        {
          id: 'node-root',
          type: 'c4-container',
          position: { x: 999, y: 999 },
          data: { label: 'Incoming Root' },
        },
      ],
      containerCanvases: {
        'node-root': {
          nodeId: 'node-root',
          nodes: [
            {
              id: 'node-inner',
              type: 'c4-component',
              position: { x: 1, y: 2 },
              data: { label: 'Incoming Inner' },
            },
          ],
          edges: [],
        },
      },
    };

    const current: AriaState = {
      ...baseState(),
      nodes: [
        {
          id: 'node-root',
          type: 'c4-container',
          position: { x: 100, y: 200 },
          data: { label: 'Current Root' },
        },
      ],
      containerCanvases: {
        'node-root': {
          nodeId: 'node-root',
          nodes: [],
          edges: [],
        },
      },
    };

    const reconciled = reconcileState(incoming, current);

    expect(reconciled.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(reconciled.nodes[0].data.label).toBe('Incoming Root');
    expect(reconciled.containerCanvases['node-root'].nodes).toHaveLength(1);
    expect(reconciled.containerCanvases['node-root'].nodes[0].data.label).toBe('Incoming Inner');
  });

  it('applies incoming mindmap positions when preserveMindmapLayout is false', () => {
    const incoming: AriaState = {
      ...baseState(),
      nodes: [
        {
          id: 'mind-1',
          type: 'mindmap',
          position: { x: 300, y: 400 },
          data: { label: 'Incoming Mindmap' },
        },
      ],
    };

    const current: AriaState = {
      ...baseState(),
      nodes: [
        {
          id: 'mind-1',
          type: 'mindmap',
          position: { x: 10, y: 20 },
          data: { label: 'Current Mindmap' },
        },
      ],
    };

    const reconciled = reconcileState(incoming, current, {
      preserveNodePositions: true,
      preserveMindmapLayout: false,
    });

    expect(reconciled.nodes[0].position).toEqual({ x: 300, y: 400 });
    expect(reconciled.nodes[0].data.label).toBe('Incoming Mindmap');
  });
});
