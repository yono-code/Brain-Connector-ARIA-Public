import { beforeEach, describe, expect, it, vi } from 'vitest';

const vscodeMock = vi.hoisted(() => ({
  workspace: {
    workspaceFolders: undefined as Array<{ uri: { fsPath: string } }> | undefined,
  },
  window: {
    showErrorMessage: vi.fn(),
  },
}));

vi.mock('vscode', () => vscodeMock);

import { getWorkspacePath, requireWorkspace } from '../utils/workspace';

describe('workspace utility', () => {
  beforeEach(() => {
    vscodeMock.workspace.workspaceFolders = undefined;
    vi.clearAllMocks();
  });

  it('getWorkspacePath returns null when workspace is not opened', () => {
    expect(getWorkspacePath()).toBeNull();
  });

  it('getWorkspacePath returns first workspace path in multi-root mode', () => {
    vscodeMock.workspace.workspaceFolders = [
      { uri: { fsPath: 'C:\\workspace-a' } },
      { uri: { fsPath: 'C:\\workspace-b' } },
    ];

    expect(getWorkspacePath()).toBe('C:\\workspace-a');
  });

  it('requireWorkspace shows error and returns null when workspace is missing', () => {
    const result = requireWorkspace();

    expect(result).toBeNull();
    expect(vscodeMock.window.showErrorMessage).toHaveBeenCalledTimes(1);
  });

  it('requireWorkspace returns path without showing error when workspace exists', () => {
    vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'C:\\workspace' } }];

    const result = requireWorkspace();

    expect(result).toBe('C:\\workspace');
    expect(vscodeMock.window.showErrorMessage).not.toHaveBeenCalled();
  });
});

