import * as vscode from 'vscode';
import * as path from 'path';
import { ADR, AriaState } from '../../shared/types';

const encoder = new TextEncoder();
const MANAGED_ADR_FILE_PATTERN = /^ADR-[^.]+\.md$/i;

type AdrGenerationState = Pick<AriaState, 'adrs' | 'nodes' | 'containerCanvases'>;

interface NodeLayerInfo {
  layer: 'context' | 'container';
  parentContainerId?: string;
  parentContainerLabel?: string;
}

function isC4NodeType(type: string): boolean {
  return type === 'c4-container' || type === 'c4-component';
}

// ADR ファイルを adr/ ディレクトリに生成する
export async function generateAdrFiles(
  aiContextPath: string,
  state: AdrGenerationState
): Promise<void> {
  const { adrs } = state;
  const adrDirPath = path.join(aiContextPath, 'adr');
  const adrList = Object.values(adrs).sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return a.id.localeCompare(b.id);
  });

  const expectedFiles = new Map<string, string>();
  for (const adr of adrList) {
    const layerInfo = resolveNodeLayerInfo(adr.linkedNodeId, state);
    if (!layerInfo) {
      continue;
    }

    expectedFiles.set(
      buildAdrFilename(adr),
      renderAdr(adr, layerInfo),
    );
  }

  await cleanupStaleAdrFiles(adrDirPath, [...expectedFiles.keys()]);

  await Promise.all(
    [...expectedFiles.entries()].map(([filename, content]) =>
      vscode.workspace.fs.writeFile(
        vscode.Uri.file(path.join(adrDirPath, filename)),
        encoder.encode(content)
      )
    )
  );
}

export function buildAdrFilename(adr: ADR): string {
  const slug = adr.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const shortId = adr.id.replace(/^adr-/, '');
  return `ADR-${shortId}-${slug || 'untitled'}.md`;
}

export function getStaleAdrFilenames(
  existingFilenames: string[],
  expectedFilenames: string[]
): string[] {
  const expected = new Set(expectedFilenames);
  return existingFilenames.filter((name) =>
    MANAGED_ADR_FILE_PATTERN.test(name) && !expected.has(name)
  );
}

async function cleanupStaleAdrFiles(
  adrDirPath: string,
  expectedFilenames: string[]
): Promise<void> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(adrDirPath));
    const existingManagedFiles = entries
      .filter(([, type]) => type === vscode.FileType.File)
      .map(([name]) => name);

    const staleFiles = getStaleAdrFilenames(existingManagedFiles, expectedFilenames);
    await Promise.all(
      staleFiles.map((name) =>
        vscode.workspace.fs.delete(vscode.Uri.file(path.join(adrDirPath, name)))
      )
    );
  } catch {
    // 生成前に呼ばれる ensureDirectory() があるため通常は発生しない。
    // 失敗しても本体の書き出しを優先する。
  }
}

function resolveNodeLayerInfo(
  nodeId: string,
  state: AdrGenerationState,
): NodeLayerInfo | null {
  if (!nodeId) {
    return null;
  }

  const rootNode = state.nodes.find((node) => node.id === nodeId);
  if (rootNode) {
    return isC4NodeType(rootNode.type)
      ? { layer: 'context' }
      : null;
  }

  const containerCanvases = state.containerCanvases ?? {};
  for (const [containerId, canvas] of Object.entries(containerCanvases)) {
    const innerNode = canvas.nodes.find((node) => node.id === nodeId);
    if (innerNode) {
      if (!isC4NodeType(innerNode.type)) {
        return null;
      }
      const parentNode = state.nodes.find((node) => node.id === containerId);
      return {
        layer: 'container',
        parentContainerId: containerId,
        parentContainerLabel: parentNode?.data.label ?? containerId,
      };
    }
  }

  return null;
}

function renderAdr(adr: ADR, layerInfo: NodeLayerInfo): string {
  const rejected = adr.rejectedOptions.length > 0
    ? adr.rejectedOptions.map((o) => `- ${o}`).join('\n')
    : '_（なし）_';
  const layerMetadataLine = layerInfo.layer === 'container'
    ? `**レイヤー**: コンテナ（親コンテナ: ${layerInfo.parentContainerLabel ?? layerInfo.parentContainerId} / ${layerInfo.parentContainerId}）\n`
    : '';

  return `# ${adr.title}

**ID**: ${adr.id}
**作成日**: ${adr.createdAt}
**関連ノード**: ${adr.linkedNodeId || '_（未設定）_'}
${layerMetadataLine}

## 決定事項

${adr.decision || '_（未記入）_'}

## 却下した選択肢

${rejected}
`;
}
