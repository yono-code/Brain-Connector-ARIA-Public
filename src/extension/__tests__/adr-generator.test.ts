import { beforeEach, describe, expect, it, vi } from 'vitest';

const vscodeFsMocks = vi.hoisted(() => ({
  readDirectory: vi.fn(),
  delete: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('vscode', () => ({
  FileType: {
    File: 1,
    Directory: 2,
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
  },
  workspace: {
    fs: {
      readDirectory: vscodeFsMocks.readDirectory,
      delete: vscodeFsMocks.delete,
      writeFile: vscodeFsMocks.writeFile,
    },
  },
}));

import * as path from 'path';
import type { ADR, AriaState } from '../../shared/types';
import {
  buildAdrFilename,
  generateAdrFiles,
  getStaleAdrFilenames,
} from '../generators/adr-generator';

function makeAdr(overrides: Partial<ADR> = {}): ADR {
  return {
    id: 'adr-12345678',
    linkedNodeId: 'node-12345678',
    title: 'Auth Strategy',
    decision: 'Use JWT',
    rejectedOptions: [],
    createdAt: '2026-02-26T00:00:00.000Z',
    ...overrides,
  };
}

function makeGenerationState(
  overrides: Partial<Pick<AriaState, 'adrs' | 'nodes' | 'containerCanvases'>> = {}
): Pick<AriaState, 'adrs' | 'nodes' | 'containerCanvases'> {
  return {
    adrs: {},
    nodes: [],
    containerCanvases: {},
    ...overrides,
  };
}

describe('adr-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vscodeFsMocks.readDirectory.mockResolvedValue([]);
    vscodeFsMocks.delete.mockResolvedValue(undefined);
    vscodeFsMocks.writeFile.mockResolvedValue(undefined);
  });

  it('buildAdrFilename uses ADR ID-based stable naming', () => {
    expect(buildAdrFilename(makeAdr())).toBe('ADR-12345678-auth-strategy.md');
    expect(buildAdrFilename(makeAdr({ title: '###' }))).toBe('ADR-12345678-untitled.md');
  });

  it('getStaleAdrFilenames only targets managed ADR files', () => {
    const stale = getStaleAdrFilenames(
      [
        'ADR-0001-old-name.md',
        'ADR-12345678-auth-strategy.md',
        'notes.md',
        'README.txt',
      ],
      ['ADR-12345678-auth-strategy.md']
    );

    expect(stale).toEqual(['ADR-0001-old-name.md']);
  });

  it('generateAdrFiles deletes stale managed ADR files and writes current files', async () => {
    const adr = makeAdr({ title: 'New Title' });
    const expectedFilename = 'ADR-12345678-new-title.md';

    vscodeFsMocks.readDirectory.mockResolvedValue([
      ['ADR-0001-old-title.md', 1],
      ['notes.md', 1],
      ['nested', 2],
    ]);

    await generateAdrFiles(
      'C:\\workspace\\.ai-context',
      makeGenerationState({
        adrs: { [adr.id]: adr },
        nodes: [
          {
            id: 'node-12345678',
            type: 'c4-container',
            position: { x: 0, y: 0 },
            data: { label: 'Root' },
          },
        ],
      })
    );

    expect(vscodeFsMocks.delete).toHaveBeenCalledTimes(1);
    expect(vscodeFsMocks.delete.mock.calls[0][0].fsPath).toBe(
      path.join('C:\\workspace\\.ai-context', 'adr', 'ADR-0001-old-title.md')
    );

    expect(vscodeFsMocks.writeFile).toHaveBeenCalledTimes(1);
    expect(vscodeFsMocks.writeFile.mock.calls[0][0].fsPath).toBe(
      path.join('C:\\workspace\\.ai-context', 'adr', expectedFilename)
    );
  });

  it('writes container-layer metadata for ADR linked to container canvas node', async () => {
    const adr = makeAdr({
      id: 'adr-87654321',
      linkedNodeId: 'node-inner',
      title: 'Inner Decision',
    });

    await generateAdrFiles(
      'C:\\workspace\\.ai-context',
      makeGenerationState({
        adrs: { [adr.id]: adr },
        nodes: [
          {
            id: 'node-root',
            type: 'c4-container',
            position: { x: 0, y: 0 },
            data: { label: 'Core Platform' },
          },
        ],
        containerCanvases: {
          'node-root': {
            nodeId: 'node-root',
            nodes: [
              {
                id: 'node-inner',
                type: 'c4-component',
                position: { x: 0, y: 0 },
                data: { label: 'API' },
              },
            ],
            edges: [],
          },
        },
      })
    );

    const encoded = vscodeFsMocks.writeFile.mock.calls[0][1] as Uint8Array;
    const content = new TextDecoder().decode(encoded);

    expect(content).toContain('**レイヤー**: コンテナ（親コンテナ: Core Platform / node-root）');
  });

  it('does not add layer metadata for context-layer ADR', async () => {
    const adr = makeAdr({ linkedNodeId: 'node-context' });
    await generateAdrFiles(
      'C:\\workspace\\.ai-context',
      makeGenerationState({
        adrs: { [adr.id]: adr },
        nodes: [
          {
            id: 'node-context',
            type: 'c4-container',
            position: { x: 0, y: 0 },
            data: { label: 'Context Node' },
          },
        ],
      })
    );

    const encoded = vscodeFsMocks.writeFile.mock.calls[0][1] as Uint8Array;
    const content = new TextDecoder().decode(encoded);

    expect(content).not.toContain('**レイヤー**: コンテナ');
  });

  it('skips ADR generation for non-C4 linked nodes', async () => {
    const adr = makeAdr({ linkedNodeId: 'node-mindmap' });
    await generateAdrFiles(
      'C:\\workspace\\.ai-context',
      makeGenerationState({
        adrs: { [adr.id]: adr },
        nodes: [
          {
            id: 'node-mindmap',
            type: 'mindmap',
            position: { x: 0, y: 0 },
            data: { label: 'Idea Node' },
          },
        ],
      })
    );

    expect(vscodeFsMocks.writeFile).not.toHaveBeenCalled();
  });
});
