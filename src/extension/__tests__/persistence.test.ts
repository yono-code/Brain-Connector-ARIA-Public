import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

import * as fs from 'fs/promises';
import { loadAriaState } from '../persistence';

const readFileMock = vi.mocked(fs.readFile);

describe('persistence.loadAriaState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sanitized state without warning for valid file', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        nodes: [],
        edges: [],
        tasks: {
          'task-12345678': {
            id: 'task-12345678',
            status: 'Todo',
            title: 'Loaded Task',
            linkedNodeIds: [],
            createdAt: '2026-02-26T00:00:00.000Z',
            updatedAt: '2026-02-26T00:00:00.000Z',
          },
        },
        adrs: {},
        containerCanvases: {
          'node-aaaaaaaa': {
            nodeId: 'node-aaaaaaaa',
            nodes: [],
            edges: [],
          },
        },
        version: '1.0.0',
      })
    );

    const result = await loadAriaState('C:\\workspace');

    expect(result.warning).toBeUndefined();
    expect(result.state.tasks['task-12345678']?.title).toBe('Loaded Task');
    expect(result.state.containerCanvases['node-aaaaaaaa']).toBeDefined();
    expect(result.state.version).toBe('1.0.0');
  });

  it('returns default state with warning when JSON is invalid', async () => {
    readFileMock.mockResolvedValue('{ invalid json');

    const result = await loadAriaState('C:\\workspace');

    expect(result.warning).toContain('aria-state.json の読み込みに失敗');
    expect(result.state.nodes).toEqual([]);
    expect(result.state.edges).toEqual([]);
    expect(result.state.tasks).toEqual({});
    expect(result.state.adrs).toEqual({});
  });

  it('returns default state without warning when file is missing (first launch)', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    readFileMock.mockRejectedValue(err);

    const result = await loadAriaState('C:\\workspace');

    expect(result.warning).toBeUndefined();
    expect(result.state.tasks).toEqual({});
  });

  it('returns sanitized state with warning when invalid tasks are quarantined on startup', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        nodes: [],
        edges: [],
        tasks: {
          bad_task_id: {
            id: 'bad_task_id',
            status: 'Todo',
            title: 'Broken',
            linkedNodeIds: [],
            createdAt: '2026-02-26T00:00:00.000Z',
            updatedAt: '2026-02-26T00:00:00.000Z',
          },
        },
        adrs: {},
      })
    );

    const result = await loadAriaState('C:\\workspace');

    expect(result.warning).toContain('隔離');
    const tasks = Object.values(result.state.tasks);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('Inbox');
  });

  it('backfills missing containerCanvases for backward compatibility', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        nodes: [],
        edges: [],
        tasks: {},
        adrs: {},
        version: '1.0.0',
      })
    );

    const result = await loadAriaState('C:\\workspace');

    expect(result.warning).toBeUndefined();
    expect(result.state.containerCanvases).toEqual({});
  });

  it('sanitizes invalid containerCanvases field to empty object', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        nodes: [],
        edges: [],
        tasks: {},
        adrs: {},
        containerCanvases: 'broken',
      })
    );

    const result = await loadAriaState('C:\\workspace');

    expect(result.state.containerCanvases).toEqual({});
  });
});
