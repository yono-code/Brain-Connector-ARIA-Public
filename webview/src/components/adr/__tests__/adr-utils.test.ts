import { describe, expect, it } from 'vitest';
import type { AriaNode, ContainerCanvas } from '../../../../../src/shared/types';
import { resolveAdrLinkedElementInfo, resolveAdrNodeLabel } from '../adr-utils';

function makeRootNode(id: string, label: string): AriaNode {
  return {
    id,
    type: 'c4-container',
    position: { x: 0, y: 0 },
    data: { label },
  };
}

describe('adr-utils', () => {
  it('returns root node label when linked node exists on context layer', () => {
    const rootNodes = [makeRootNode('node-root', 'Core')];
    const label = resolveAdrNodeLabel('node-root', rootNodes, {});
    expect(label).toBe('Core');
  });

  it('returns inner node label with parent container for container layer nodes', () => {
    const rootNodes = [makeRootNode('node-parent', 'Platform')];
    const containerCanvases: Record<string, ContainerCanvas> = {
      'node-parent': {
        nodeId: 'node-parent',
        nodes: [
          {
            id: 'node-inner',
            type: 'c4-component',
            position: { x: 0, y: 0 },
            data: { label: 'Auth Service' },
          },
        ],
        edges: [],
      },
    };

    const label = resolveAdrNodeLabel('node-inner', rootNodes, containerCanvases);
    expect(label).toBe('Auth Service (Platform 内)');
  });

  it('falls back to node id when unknown', () => {
    const label = resolveAdrNodeLabel('node-missing', [], {});
    expect(label).toBe('node-missing');
  });

  it('marks non-C4 root nodes as not ADR-linkable', () => {
    const rootNodes: AriaNode[] = [
      {
        id: 'node-mm',
        type: 'mindmap',
        position: { x: 0, y: 0 },
        data: { label: 'Idea' },
      },
    ];

    const info = resolveAdrLinkedElementInfo('node-mm', rootNodes, {});
    expect(info.isC4Linked).toBe(false);
    expect(info.elementName).toBe('Idea');
  });
});
