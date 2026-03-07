import { describe, expect, it } from 'vitest';
import type { AriaEdge, AriaNode } from '../../../../../../src/shared/types';
import { layoutMindmapAsTree } from '../align-mindmap';

function mmNode(id: string, x: number, y: number, selected = false): AriaNode {
  return {
    id,
    type: 'mindmap',
    position: { x, y },
    data: { label: id },
    selected,
  };
}

describe('layoutMindmapAsTree', () => {
  it('anchors the top-most root and lays out sibling generations as vertical columns', () => {
    const nodes: AriaNode[] = [
      mmNode('root', 400, 200),
      mmNode('child-a', 100, 100, true),
      mmNode('child-b', 120, 220),
      mmNode('grand', 50, 50),
    ];
    const edges: AriaEdge[] = [
      { id: 'e1', source: 'root', target: 'child-a' },
      { id: 'e2', source: 'root', target: 'child-b' },
      { id: 'e3', source: 'child-a', target: 'grand' },
    ];

    const result = layoutMindmapAsTree(nodes, edges, { coreNodeId: 'grand' });

    expect(result.root).toEqual({ x: 400, y: 200 });
    expect(result['child-a'].x).toBeGreaterThan(result.root.x);
    expect(result['child-b'].x).toBe(result['child-a'].x);
    expect(result['child-a'].y).toBeLessThan(result['child-b'].y);
    expect(result.grand.x).toBeGreaterThan(result['child-a'].x);
  });

  it('creates positions even when no edges are present', () => {
    const nodes: AriaNode[] = [
      mmNode('n1', 20, 20),
      mmNode('n2', 40, 120),
    ];
    const result = layoutMindmapAsTree(nodes, []);

    expect(result.n1).toBeDefined();
    expect(result.n2).toBeDefined();
    expect(result.n1.x).toBe(nodes[0].position.x);
  });
});
