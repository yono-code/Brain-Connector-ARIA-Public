import { describe, expect, it } from 'vitest';
import { parseMermaidMindmap } from '../parse-mermaid-mindmap';

describe('parseMermaidMindmap', () => {
  it('parses mindmap syntax with parent-child structure', () => {
    const source = `mindmap
  Core
    Planning
      Tasks
    Delivery`;

    const result = parseMermaidMindmap(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.graph.nodes).toHaveLength(4);
    const core = result.graph.nodes.find((node) => node.label === 'Core');
    const planning = result.graph.nodes.find((node) => node.label === 'Planning');
    const tasks = result.graph.nodes.find((node) => node.label === 'Tasks');
    const delivery = result.graph.nodes.find((node) => node.label === 'Delivery');

    expect(core).toBeDefined();
    expect(planning?.parentKey).toBe(core?.key);
    expect(tasks?.parentKey).toBe(planning?.key);
    expect(delivery?.parentKey).toBe(core?.key);
    expect(result.graph.coreKey).toBe(core?.key);
  });

  it('parses simple graph TD edges as tree input', () => {
    const source = `graph TD
    A --> B
    A --> C
    C --> D`;

    const result = parseMermaidMindmap(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const nodeA = result.graph.nodes.find((node) => node.label === 'A');
    const nodeB = result.graph.nodes.find((node) => node.label === 'B');
    const nodeC = result.graph.nodes.find((node) => node.label === 'C');
    const nodeD = result.graph.nodes.find((node) => node.label === 'D');

    expect(nodeA?.parentKey).toBeUndefined();
    expect(nodeB?.parentKey).toBe(nodeA?.key);
    expect(nodeC?.parentKey).toBe(nodeA?.key);
    expect(nodeD?.parentKey).toBe(nodeC?.key);
  });

  it('returns error for unsupported syntax', () => {
    const source = `sequenceDiagram
    Alice->>Bob: Hi`;

    const result = parseMermaidMindmap(source);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Unsupported Mermaid syntax');
  });
});

