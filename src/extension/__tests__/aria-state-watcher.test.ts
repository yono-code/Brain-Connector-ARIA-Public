import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const watcherState = vi.hoisted(() => {
  const state: Record<string, {
    onChange?: () => void;
    onCreate?: () => void;
  }> = {};
  return state;
});

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
}));

vi.mock('vscode', () => ({
  RelativePattern: class RelativePattern {
    constructor(
      public readonly base: string,
      public readonly pattern: string,
    ) {}
  },
  workspace: {
    createFileSystemWatcher: vi.fn((pattern: { pattern?: string }) => {
      const key = pattern.pattern ?? 'unknown';
      watcherState[key] ??= {};
      return {
        onDidChange: (handler: () => void) => { watcherState[key].onChange = handler; },
        onDidCreate: (handler: () => void) => { watcherState[key].onCreate = handler; },
        dispose: vi.fn(),
      };
    }),
  },
}));

vi.mock('fs/promises', () => ({
  readFile: fsMocks.readFile,
}));

import { AriaStateWatcher } from '../aria-state-watcher';

const ARIA_STATE_PATTERN = '.ai-context/aria-state.json';
const STATUS_MD_PATTERN = '.ai-context/status.md';

describe('AriaStateWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    for (const key of Object.keys(watcherState)) {
      delete watcherState[key];
    }
    fsMocks.readFile.mockResolvedValue('{"nodes":[]}');
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('debounces change events and invokes external change callback once', async () => {
    const onExternalChange = vi.fn().mockResolvedValue(undefined);
    const watcher = new AriaStateWatcher('C:\\workspace', onExternalChange);
    watcher.start();

    watcherState[ARIA_STATE_PATTERN]?.onChange?.();
    watcherState[ARIA_STATE_PATTERN]?.onChange?.();
    watcherState[ARIA_STATE_PATTERN]?.onChange?.();

    expect(onExternalChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(fsMocks.readFile).toHaveBeenCalledTimes(1);
    expect(onExternalChange).toHaveBeenCalledTimes(1);
    expect(onExternalChange).toHaveBeenCalledWith('{"nodes":[]}');

    watcher.dispose();
  });

  it('ignores self-write events during cooldown, then accepts later events', async () => {
    const onExternalChange = vi.fn().mockResolvedValue(undefined);
    const watcher = new AriaStateWatcher('C:\\workspace', onExternalChange);
    watcher.start();

    watcher.markWriteStart();
    watcherState[ARIA_STATE_PATTERN]?.onChange?.();
    await vi.advanceTimersByTimeAsync(400);

    expect(onExternalChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250); // cooldown(600ms) 経過
    watcherState[ARIA_STATE_PATTERN]?.onChange?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(onExternalChange).toHaveBeenCalledTimes(1);
    watcher.dispose();
  });

  it('handles create events as external changes', async () => {
    const onExternalChange = vi.fn().mockResolvedValue(undefined);
    const watcher = new AriaStateWatcher('C:\\workspace', onExternalChange);
    watcher.start();

    watcherState[ARIA_STATE_PATTERN]?.onCreate?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(onExternalChange).toHaveBeenCalledTimes(1);
    watcher.dispose();
  });

  it('handles status.md changes with dedicated callback when provided', async () => {
    fsMocks.readFile.mockImplementation(async (targetPath: string) => {
      if (targetPath.includes('status.md')) {
        return '# ARIA — Status';
      }
      return '{"nodes":[]}';
    });

    const onAriaStateChange = vi.fn().mockResolvedValue(undefined);
    const onStatusMdChange = vi.fn().mockResolvedValue(undefined);
    const watcher = new AriaStateWatcher(
      'C:\\workspace',
      onAriaStateChange,
      onStatusMdChange,
    );
    watcher.start();

    watcherState[STATUS_MD_PATTERN]?.onChange?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(onStatusMdChange).toHaveBeenCalledTimes(1);
    expect(onStatusMdChange).toHaveBeenCalledWith('# ARIA — Status');
    expect(onAriaStateChange).not.toHaveBeenCalled();
    watcher.dispose();
  });
});
