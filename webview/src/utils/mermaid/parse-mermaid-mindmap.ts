export interface ParsedMindmapNode {
  key: string;
  label: string;
  parentKey?: string;
}

export interface ParsedMindmapGraph {
  nodes: ParsedMindmapNode[];
  coreKey: string;
}

export type MermaidMindmapParseResult =
  | { ok: true; graph: ParsedMindmapGraph }
  | { ok: false; error: string };

interface GraphEdge {
  source: string;
  target: string;
}

const INDENT_SIZE = 2;
const GRAPH_EDGE_PATTERN = /^\s*("[^"]+"|[A-Za-z0-9_:\-\.]+)\s*-->\s*(?:\|[^|]*\|\s*)?("[^"]+"|[A-Za-z0-9_:\-\.]+)\s*$/;

export function parseMermaidMindmap(source: string): MermaidMindmapParseResult {
  const cleaned = source.replace(/\uFEFF/g, '');
  if (!cleaned.trim()) {
    return { ok: false, error: 'Mermaid input is empty.' };
  }

  const lines = cleaned
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('%%'));

  const hasMindmapHeader = lines.some((line) => /^\s*mindmap\b/i.test(line));
  if (hasMindmapHeader) {
    return parseMindmapSyntax(lines);
  }

  const hasGraphHeader = lines.some((line) => /^\s*graph\b/i.test(line));
  if (hasGraphHeader) {
    return parseGraphSyntax(lines);
  }

  return {
    ok: false,
    error: 'Unsupported Mermaid syntax. Use "mindmap" or simple "graph TD" with "-->" edges.',
  };
}

function parseMindmapSyntax(lines: string[]): MermaidMindmapParseResult {
  const headerIndex = lines.findIndex((line) => /^\s*mindmap\b/i.test(line));
  const bodyLines = lines.slice(headerIndex + 1);

  const nodes: ParsedMindmapNode[] = [];
  const stack: string[] = [];
  let seq = 0;
  let baseIndent: number | null = null;

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    if (!line.trim()) continue;

    const indentLength = measureIndent(line);
    if (baseIndent == null) {
      // Mermaid mindmap examples often indent the first root under `mindmap`.
      // Normalize by treating the first visible node indent as depth 0.
      baseIndent = indentLength;
    }
    const relativeIndent = Math.max(0, indentLength - baseIndent);
    const level = Math.floor(relativeIndent / INDENT_SIZE);
    const rawToken = line.trim();
    const label = normalizeLabel(rawToken);
    if (!label) {
      continue;
    }

    const key = `mm-${seq++}`;
    const parentKey = level > 0 ? stack[level - 1] : undefined;
    if (level > 0 && !parentKey) {
      return {
        ok: false,
        error: `Invalid indentation near line ${headerIndex + i + 2}.`,
      };
    }

    nodes.push({
      key,
      label,
      parentKey,
    });

    stack[level] = key;
    stack.length = level + 1;
  }

  if (nodes.length === 0) {
    return { ok: false, error: 'No mindmap nodes found in Mermaid input.' };
  }

  return {
    ok: true,
    graph: {
      nodes,
      coreKey: nodes[0].key,
    },
  };
}

function parseGraphSyntax(lines: string[]): MermaidMindmapParseResult {
  const headerIndex = lines.findIndex((line) => /^\s*graph\b/i.test(line));
  const bodyLines = lines.slice(headerIndex + 1);
  const edges: GraphEdge[] = [];
  const tokenOrder: string[] = [];
  const tokenSeen = new Set<string>();

  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = GRAPH_EDGE_PATTERN.exec(trimmed);
    if (!match) continue;

    const source = normalizeToken(match[1]);
    const target = normalizeToken(match[2]);
    if (!source || !target) continue;

    edges.push({ source, target });
    if (!tokenSeen.has(source)) {
      tokenSeen.add(source);
      tokenOrder.push(source);
    }
    if (!tokenSeen.has(target)) {
      tokenSeen.add(target);
      tokenOrder.push(target);
    }
  }

  if (edges.length === 0) {
    return { ok: false, error: 'No supported "-->" edges found in graph syntax.' };
  }

  const parentByNode = new Map<string, string>();
  for (const edge of edges) {
    if (!parentByNode.has(edge.target)) {
      parentByNode.set(edge.target, edge.source);
    }
  }

  const nodes: ParsedMindmapNode[] = tokenOrder.map((token) => ({
    key: token,
    label: normalizeLabel(token),
    parentKey: parentByNode.get(token),
  }));

  const roots = nodes.filter((node) => !node.parentKey);
  const core = roots[0]?.key ?? nodes[0].key;

  return {
    ok: true,
    graph: {
      nodes,
      coreKey: core,
    },
  };
}

function measureIndent(line: string): number {
  let count = 0;
  for (const char of line) {
    if (char === ' ') {
      count++;
      continue;
    }
    if (char === '\t') {
      count += INDENT_SIZE;
      continue;
    }
    break;
  }
  return count;
}

function normalizeToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeLabel(value: string): string {
  let text = normalizeToken(value);
  text = text.split(':::')[0].trim();

  const wrappers: Array<[string, string]> = [
    ['((', '))'],
    ['[[', ']]'],
    ['{{', '}}'],
    ['([', '])'],
    ['[(', ')]'],
    ['[', ']'],
    ['(', ')'],
    ['{', '}'],
  ];

  for (const [left, right] of wrappers) {
    if (text.startsWith(left) && text.endsWith(right) && text.length > left.length + right.length) {
      text = text.slice(left.length, text.length - right.length).trim();
      break;
    }
  }

  const withNodeId = /^([A-Za-z0-9_:\-\.]+)\s*(?:\[(.+)\]|\((.+)\)|\{\{(.+)\}\})$/.exec(text);
  if (withNodeId) {
    text = (withNodeId[2] ?? withNodeId[3] ?? withNodeId[4] ?? withNodeId[1]).trim();
  }

  return text || 'Untitled';
}
