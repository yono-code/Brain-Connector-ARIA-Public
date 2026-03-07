import { describe, expect, it } from 'vitest';
import { parseAriaState } from '../parse-aria-state';

describe('parseAriaState edge sanitize (M17)', () => {
  it('fills default variant and sanitizes invalid variant to single-forward', () => {
    const result = parseAriaState(JSON.stringify({
      nodes: [],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'b', variant: 'unknown' },
      ],
      tasks: {},
      adrs: {},
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.edges).toHaveLength(2);
    expect(result.state.edges[0].variant).toBe('single-forward');
    expect(result.state.edges[1].variant).toBe('single-forward');
  });

  it('keeps allowed variants and normalizes empty source/target labels', () => {
    const result = parseAriaState(JSON.stringify({
      nodes: [],
      edges: [
        {
          id: 'e3',
          source: 'a',
          target: 'b',
          variant: 'double-parallel',
          sourceLabel: '   ',
          targetLabel: 'response',
        },
      ],
      tasks: {},
      adrs: {},
      containerCanvases: {
        c1: {
          nodeId: 'c1',
          nodes: [],
          edges: [
            {
              id: 'inner-e1',
              source: 'x',
              target: 'y',
              variant: 'double-headed',
              label: 'sync',
            },
          ],
        },
      },
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.edges[0].id).toBe('e3');
    expect(result.state.edges[0].variant).toBe('double-parallel');
    expect(result.state.edges[0].sourceLabel).toBeUndefined();
    expect(result.state.edges[0].targetLabel).toBe('response');
    expect(result.state.containerCanvases.c1.edges[0]).toMatchObject({
      id: 'inner-e1',
      variant: 'double-headed',
      label: 'sync',
    });
  });
});
