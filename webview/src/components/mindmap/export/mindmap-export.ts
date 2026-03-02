import type { AriaEdge, AriaNode, AriaState } from '../../../../../src/shared/types';

function getMindmapNodes(nodes: AriaNode[]): AriaNode[] {
  return nodes.filter((node) => node.type === 'mindmap');
}

function getMindmapEdges(nodes: AriaNode[], edges: AriaEdge[]): AriaEdge[] {
  const nodeIds = new Set(getMindmapNodes(nodes).map((node) => node.id));
  return edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
}

function buildMindmapGraph(state: AriaState) {
  const nodes = getMindmapNodes(state.nodes);
  const edges = getMindmapEdges(state.nodes, state.edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, string[]>();
  const incoming = new Map<string, number>();

  for (const node of nodes) {
    incoming.set(node.id, 0);
  }

  for (const edge of edges) {
    const list = childrenByParent.get(edge.source) ?? [];
    list.push(edge.target);
    childrenByParent.set(edge.source, list);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  const roots = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);

  return { nodes, edges, nodeById, childrenByParent, roots };
}

function collectVisibleNodeIds(state: AriaState): Set<string> {
  const { nodeById, childrenByParent, roots, nodes } = buildMindmapGraph(state);
  const visible = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeById.get(nodeId);
    if (!node) return;

    visible.add(nodeId);
    if (node.data.collapsed) return;

    const children = childrenByParent.get(nodeId) ?? [];
    children.forEach(visit);
  };

  if (roots.length === 0 && nodes.length > 0) {
    visit(nodes[0].id);
    return visible;
  }

  roots.forEach((root) => visit(root.id));
  return visible;
}

export function exportMindmapMarkdown(state: AriaState): string {
  const { nodeById, childrenByParent, roots, edges } = buildMindmapGraph(state);
  const visible = collectVisibleNodeIds(state);
  const lines: string[] = [];

  const visit = (nodeId: string, depth: number): void => {
    if (!visible.has(nodeId)) return;
    const node = nodeById.get(nodeId);
    if (!node) return;
    const indent = '  '.repeat(depth);
    const checkbox = node.data.checkboxEnabled ? (node.data.checked ? '[x] ' : '[ ] ') : '';
    lines.push(`${indent}- ${checkbox}${node.data.label}`);
    if (node.data.note) {
      node.data.note.split('\n').forEach((noteLine) => {
        lines.push(`${indent}  > ${noteLine}`);
      });
    }
    if (node.data.collapsed) return;
    const children = childrenByParent.get(nodeId) ?? [];
    children.forEach((childId) => visit(childId, depth + 1));
  };

  roots.forEach((root) => visit(root.id, 0));

  const relationLines = edges
    .filter((edge) => edge.label)
    .map((edge) => {
      const source = nodeById.get(edge.source)?.data.label ?? edge.source;
      const target = nodeById.get(edge.target)?.data.label ?? edge.target;
      return `- ${source} --[${edge.label}]--> ${target}`;
    });

  if (relationLines.length > 0) {
    lines.push('');
    lines.push('## リレーション');
    lines.push(...relationLines);
  }

  return lines.join('\n');
}

function escapeXml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case '\'': return '&apos;';
      default: return char;
    }
  });
}

export function exportMindmapSvg(state: AriaState): string {
  const { nodes, edges, nodeById } = buildMindmapGraph(state);
  const visible = collectVisibleNodeIds(state);
  const visibleNodes = nodes.filter((node) => visible.has(node.id));
  const visibleEdges = edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target));

  if (visibleNodes.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160"><text x="16" y="32">No mindmap nodes</text></svg>';
  }

  const minX = Math.min(...visibleNodes.map((node) => node.position.x - 96));
  const maxX = Math.max(...visibleNodes.map((node) => node.position.x + 96));
  const minY = Math.min(...visibleNodes.map((node) => node.position.y - 30));
  const maxY = Math.max(...visibleNodes.map((node) => node.position.y + 30));
  const width = Math.max(320, Math.ceil(maxX - minX + 64));
  const height = Math.max(200, Math.ceil(maxY - minY + 64));
  const offsetX = 32 - minX;
  const offsetY = 32 - minY;

  const edgeSvg = visibleEdges.map((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return '';

    const x1 = source.position.x + offsetX;
    const y1 = source.position.y + offsetY;
    const x2 = target.position.x + offsetX;
    const y2 = target.position.y + offsetY;
    const label = edge.label?.trim();
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - 8;

    return [
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#6b7280" stroke-width="1.4" />`,
      label ? `<text x="${mx}" y="${my}" font-size="11" fill="#4b5563" text-anchor="middle">${escapeXml(label)}</text>` : '',
    ].join('');
  }).join('');

  const nodeSvg = visibleNodes.map((node) => {
    const x = node.position.x + offsetX - 92;
    const y = node.position.y + offsetY - 24;
    const color = node.data.color ?? '#1F6FEB';
    const opacity = node.data.checked ? '0.56' : '1';
    const role = node.data.styleRole ?? 'standard';
    const radius = role === 'top' ? 24 : role === 'helper' ? 8 : 14;
    const strokeWidth = role === 'helper' ? 1 : 2;
    const label = `${node.data.checkboxEnabled ? (node.data.checked ? '[x] ' : '[ ] ') : ''}${node.data.label}`;

    return [
      `<rect x="${x}" y="${y}" width="184" height="48" rx="${radius}" ry="${radius}" fill="${color}" fill-opacity="${opacity}" stroke="#ffffff" stroke-opacity="0.3" stroke-width="${strokeWidth}" />`,
      `<text x="${x + 92}" y="${y + 28}" font-size="13" fill="#ffffff" text-anchor="middle">${escapeXml(label)}</text>`,
      node.data.note
        ? `<text x="${x + 92}" y="${y + 44}" font-size="10" fill="#e5e7eb" text-anchor="middle">${escapeXml(node.data.note.slice(0, 28))}</text>`
        : '',
    ].join('');
  }).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#ffffff" />',
    edgeSvg,
    nodeSvg,
    '</svg>',
  ].join('');
}

export async function svgToPngDataUrl(svg: string): Promise<string> {
  const encoded = encodeURIComponent(svg);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVGの画像変換に失敗しました'));
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvasコンテキストを取得できませんでした');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function createMindmapStateHash(state: AriaState): Promise<string> {
  const nodes = getMindmapNodes(state.nodes)
    .map((node) => ({
      id: node.id,
      position: node.position,
      data: node.data,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const edges = getMindmapEdges(state.nodes, state.edges)
    .map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label ?? '' }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const boundaries = Object.values(state.mindmapBoundaries ?? {})
    .map((boundary) => ({ ...boundary, nodeIds: [...boundary.nodeIds].sort() }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const payload = JSON.stringify({
    nodes,
    edges,
    boundaries,
    settings: state.mindmapSettings ?? {},
  });
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
}
