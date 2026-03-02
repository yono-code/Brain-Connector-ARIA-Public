import { describe, expect, it } from 'vitest';
import type { AriaState } from '../../shared/types';
import { hasLayoutDelta, resolveLayoutRisk, summarizeMindmapLayoutDelta } from '../layout-delta';

function makeState(): AriaState {
  return {
    nodes: [],
    edges: [],
    tasks: {},
    adrs: {},
    containerCanvases: {},
    mindmapBoundaries: {},
    mindmapSettings: { snapEnabled: true },
    version: '1.0.0',
    lastModified: '2026-02-28T00:00:00.000Z',
  };
}

describe('layout-delta', () => {
  it('detects moved nodes and hierarchy changes', () => {
    const current = makeState();
    current.nodes = [
      { id: 'n1', type: 'mindmap', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'n2', type: 'mindmap', position: { x: 100, y: 0 }, data: { label: 'B' } },
      { id: 'n3', type: 'mindmap', position: { x: 200, y: 0 }, data: { label: 'C' } },
    ];
    current.edges = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n1', target: 'n3' },
    ];

    const incoming = makeState();
    incoming.nodes = [
      { id: 'n1', type: 'mindmap', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'n2', type: 'mindmap', position: { x: 180, y: 40 }, data: { label: 'B' } },
      { id: 'n3', type: 'mindmap', position: { x: 200, y: 0 }, data: { label: 'C' } },
    ];
    incoming.edges = [
      { id: 'e3', source: 'n2', target: 'n3' },
      { id: 'e4', source: 'n1', target: 'n2' },
    ];

    const delta = summarizeMindmapLayoutDelta(incoming, current);
    expect(delta.movedNodeCount).toBe(1);
    expect(delta.edgeChangedCount).toBeGreaterThan(0);
    expect(delta.hasHierarchyChange).toBe(true);
    expect(hasLayoutDelta(delta)).toBe(true);
    expect(resolveLayoutRisk(delta, false)).toBe('medium');
  });

  it('returns low risk when no meaningful layout delta exists', () => {
    const current = makeState();
    current.nodes = [
      { id: 'n1', type: 'mindmap', position: { x: 0, y: 0 }, data: { label: 'A' } },
    ];
    const incoming = makeState();
    incoming.nodes = [
      { id: 'n1', type: 'mindmap', position: { x: 0, y: 0 }, data: { label: 'A' } },
    ];

    const delta = summarizeMindmapLayoutDelta(incoming, current);
    expect(hasLayoutDelta(delta)).toBe(false);
    expect(resolveLayoutRisk(delta, false)).toBe('low');
    expect(resolveLayoutRisk(delta, true)).toBe('high');
  });
});
