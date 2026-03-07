import { describe, it, expect } from 'vitest';
import { generateArchitectureMermaid } from '../generators/architecture-generator';

describe('architecture-generator (M9 containerCanvases)', () => {
  it('includes container layer subgraphs when containerCanvases are present', () => {
    const output = generateArchitectureMermaid(
      [
        {
          id: 'node-root',
          type: 'c4-container',
          position: { x: 0, y: 0 },
          data: { label: 'Main System' },
        },
      ],
      [],
      {
        'node-root': {
          nodeId: 'node-root',
          nodes: [
            {
              id: 'node-api',
              type: 'c4-component',
              position: { x: 0, y: 0 },
              data: { label: 'API Server', description: 'Node.js "BFF"' },
            },
            {
              id: 'node-db',
              type: 'c4-component',
              position: { x: 0, y: 0 },
              data: { label: 'Database' },
            },
          ],
          edges: [
            { id: 'edge-1', source: 'node-api', target: 'node-db', label: 'reads' },
          ],
        },
      }
    );

    expect(output).toContain('graph TD');
    expect(output).toContain('subgraph context_layer["Context Layer"]');
    expect(output).toContain('subgraph container_node_root["Container Layer: Main System (node-root)"]');
    expect(output).toContain('node-api["API Server\\nNode.js \'BFF\'"]');
    expect(output).toContain('node-api --> |reads| node-db');
    expect(output).toContain('classDef c4Container');
    expect(output).toContain('classDef c4Component');
    expect(output).toContain('class node-root c4Container;');
    expect(output).toContain('class node-api,node-db c4Component;');
  });

  it('emits empty-container comment for empty container canvas', () => {
    const output = generateArchitectureMermaid([], [], {
      orphan: {
        nodeId: 'orphan',
        nodes: [],
        edges: [],
      },
    });

    expect(output).toContain('%% ノードがありません');
    expect(output).toContain('subgraph context_layer["Context Layer"]');
    expect(output).toContain('subgraph container_orphan["Container Layer: orphan (orphan)"]');
    expect(output).toContain('%% コンテナ内ノードがありません');
  });

  it('excludes mindmap nodes and edges from architecture output', () => {
    const output = generateArchitectureMermaid(
      [
        {
          id: 'node-c4',
          type: 'c4-container',
          position: { x: 0, y: 0 },
          data: { label: 'C4 Root' },
        },
        {
          id: 'node-mm',
          type: 'mindmap',
          position: { x: 0, y: 0 },
          data: { label: 'Mindmap Node' },
        },
      ],
      [
        { id: 'edge-c4', source: 'node-c4', target: 'node-c4' },
        { id: 'edge-mm', source: 'node-mm', target: 'node-mm' },
      ],
      {
        'node-c4': {
          nodeId: 'node-c4',
          nodes: [
            {
              id: 'node-inner-c4',
              type: 'c4-component',
              position: { x: 0, y: 0 },
              data: { label: 'Inner C4' },
            },
            {
              id: 'node-inner-mm',
              type: 'mindmap',
              position: { x: 0, y: 0 },
              data: { label: 'Inner Mindmap' },
            },
          ],
          edges: [
            { id: 'edge-inner-c4', source: 'node-inner-c4', target: 'node-inner-c4' },
            { id: 'edge-inner-mm', source: 'node-inner-mm', target: 'node-inner-mm' },
          ],
        },
      },
    );

    expect(output).toContain('node-c4["C4 Root"]');
    expect(output).toContain('node-c4 --> node-c4');
    expect(output).toContain('node-inner-c4["Inner C4"]');
    expect(output).toContain('class node-c4 c4Container;');
    expect(output).toContain('class node-inner-c4 c4Component;');
    expect(output).not.toContain('Mindmap Node');
    expect(output).not.toContain('edge-mm');
    expect(output).not.toContain('Inner Mindmap');
    expect(output).not.toContain('edge-inner-mm');
  });

  it('renders C4 edge variants with labels', () => {
    const output = generateArchitectureMermaid(
      [
        {
          id: 'a',
          type: 'c4-container',
          position: { x: 0, y: 0 },
          data: { label: 'A' },
        },
        {
          id: 'b',
          type: 'c4-component',
          position: { x: 10, y: 0 },
          data: { label: 'B' },
        },
      ],
      [
        { id: 'e1', source: 'a', target: 'b', variant: 'single-forward', label: 'forward' },
        { id: 'e2', source: 'a', target: 'b', variant: 'single-reverse', label: 'reverse' },
        { id: 'e3', source: 'a', target: 'b', variant: 'double-headed', label: 'duplex' },
        {
          id: 'e4',
          source: 'a',
          target: 'b',
          variant: 'double-parallel',
          sourceLabel: 'req',
          targetLabel: 'res',
        },
      ],
    );

    expect(output).toContain('a --> |forward| b');
    expect(output).toContain('a <-- |reverse| b');
    expect(output).toContain('a <--> |duplex| b');
    expect(output).toContain('a --> |req| b');
    expect(output).toContain('b --> |res| a');
  });
});
