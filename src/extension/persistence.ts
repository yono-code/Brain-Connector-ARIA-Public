import * as fs from 'fs/promises';
import * as path from 'path';
import { AriaState } from '../shared/types';
import { parseAriaState } from './parse-aria-state';

const ARIA_STATE_FILENAME = 'aria-state.json';
export const CURRENT_SCHEMA_VERSION = '1.0.0';

// 初期状態
export const DEFAULT_ARIA_STATE: AriaState = {
  nodes: [],
  edges: [],
  tasks: {},
  adrs: {},
  containerCanvases: {},
  mindmapBoundaries: {},
  mindmapSettings: {
    snapEnabled: true,
  },
  version: CURRENT_SCHEMA_VERSION,
  lastModified: new Date().toISOString(),
};

export interface LoadAriaStateResult {
  state: AriaState;
  warning?: string;
}

function createDefaultAriaState(): AriaState {
  return {
    nodes: [],
    edges: [],
    tasks: {},
    adrs: {},
    containerCanvases: {},
    mindmapBoundaries: {},
    mindmapSettings: {
      snapEnabled: true,
    },
    version: CURRENT_SCHEMA_VERSION,
    lastModified: new Date().toISOString(),
  };
}

// aria-state.json を読み込む（初回起動・破損時は初期状態を返す）
export async function loadAriaState(
  workspacePath: string
): Promise<LoadAriaStateResult> {
  const filePath = path.join(workspacePath, '.ai-context', ARIA_STATE_FILENAME);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = parseAriaState(raw);

    if (!parsed.ok) {
      console.warn(
        `ARIA: 起動時に aria-state.json を読み込めませんでした（${parsed.error}）。初期状態を使用します。`
      );
      return {
        state: createDefaultAriaState(),
        warning: `ARIA: aria-state.json の読み込みに失敗したため、初期状態で起動しました（${parsed.error}）`,
      };
    }

    if (parsed.quarantinedCount > 0) {
      return {
        state: parsed.state,
        warning:
          `ARIA: 起動時に ${parsed.quarantinedCount} 件の不正タスクを Inbox に隔離しました。` +
          'カンバンボードで確認してください。',
      };
    }

    return { state: parsed.state };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      // ファイルが存在しない（初回起動）→ 初期状態を返す
      return { state: createDefaultAriaState() };
    }

    console.warn('ARIA: aria-state.json 読み込み中にエラーが発生しました。初期状態を使用します。', err);
    return {
      state: createDefaultAriaState(),
      warning: `ARIA: aria-state.json の読み込み中にエラーが発生したため、初期状態で起動しました（${code ?? 'UNKNOWN'}）`,
    };
  }
}
