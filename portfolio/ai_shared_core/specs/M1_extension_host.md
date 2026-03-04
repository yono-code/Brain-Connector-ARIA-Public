# [M1] Extension Host 基盤 — スペックキット

## 概要

- **目的**: Extension Host（Node.js/CJS環境）の全基盤モジュールを実装する
- **ゴール**: ファイル読み書き・Webview通信・永続化・Watcher の各モジュールが単体で動作する
- **前提条件**: M0 完了
- **推定工数**: 1.5週間
- **並行可能**: M2（Webview）と並行実施可能

---

## タスク一覧（チェックリスト形式）

- [ ] M1-1: Webview パネル作成・管理
- [ ] M1-2: postMessage 通信型定義【設計ギャップ解消・最初に行う】
- [ ] M1-3: ファイル書き込みモジュール
- [ ] M1-4: FileSystemWatcher セットアップ
- [ ] M1-5: データ永続化モジュール
- [ ] M1-6: ワークスペースルート解決ユーティリティ

---

## 技術仕様・実装ガイド

### M1-2: postMessage 通信型定義【最初に行う】

これは M1 の中で最初に完成させるべきファイル。Extension Host と Webview の「契約」となる。

**`src/shared/types.ts`**:

```typescript
// =============================================================================
// コアデータ型
// =============================================================================

export type TaskStatus = 'Todo' | 'In Progress' | 'Done' | 'Inbox';

export interface KanbanTask {
  id: string;           // 形式: "task-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" (UUIDベース)
  status: TaskStatus;
  title: string;
  linkedNodeIds: string[];
  createdAt: string;    // ISO 8601 形式
  updatedAt: string;
}

export interface ADR {
  id: string;           // 形式: "adr-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  linkedNodeId: string;
  title: string;
  decision: string;
  rejectedOptions: string[];
  createdAt: string;
}

export interface AriaNode {
  id: string;
  type: 'c4-container' | 'c4-component' | 'mindmap';
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    technology?: string;
  };
}

export interface AriaEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface AriaState {
  nodes: AriaNode[];
  edges: AriaEdge[];
  tasks: Record<string, KanbanTask>;  // key: task.id
  adrs: Record<string, ADR>;          // key: adr.id
  version: string;                    // スキーマバージョン (例: "1.0.0")
  lastModified: string;               // ISO 8601 形式
}

// =============================================================================
// postMessage 通信型（Extension Host ↔ Webview）
// =============================================================================

// Extension Host → Webview
export type ExtensionToWebviewMessage =
  | { type: 'INIT_STATE'; payload: AriaState }
  | { type: 'STATE_UPDATED'; payload: AriaState }
  | { type: 'ERROR'; payload: { message: string; code?: string } };

// Webview → Extension Host
export type WebviewToExtensionMessage =
  | { type: 'READY' }
  | { type: 'STATE_CHANGED'; payload: AriaState };
```

---

### M1-1: Webview パネル作成・管理

**`src/extension/aria-panel.ts`**:

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
  AriaState,
} from '../shared/types';

export class AriaPanel {
  public static currentPanel: AriaPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  // シングルトンパターン：既存パネルを再利用する
  public static createOrShow(
    extensionUri: vscode.Uri,
    onMessage: (message: WebviewToExtensionMessage) => void
  ): AriaPanel {
    const column = vscode.ViewColumn.One;

    if (AriaPanel.currentPanel) {
      AriaPanel.currentPanel._panel.reveal(column);
      return AriaPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'ariaPanel',
      'ARIA',
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
        ],
        retainContextWhenHidden: true,
      }
    );

    AriaPanel.currentPanel = new AriaPanel(panel, extensionUri, onMessage);
    return AriaPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly _onMessage: (msg: WebviewToExtensionMessage) => void
  ) {
    this._panel = panel;
    this._panel.webview.html = this._getHtml(extensionUri);

    // Webview からのメッセージを受信
    this._panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        this._onMessage(message);
      },
      null,
      this._disposables
    );

    // パネルが閉じられたときの後処理
    this._panel.onDidDispose(
      () => this.dispose(),
      null,
      this._disposables
    );
  }

  // Webview にメッセージを送信
  public postMessage(message: ExtensionToWebviewMessage): void {
    this._panel.webview.postMessage(message);
  }

  private _getHtml(extensionUri: vscode.Uri): string {
    const webviewPath = vscode.Uri.joinPath(
      extensionUri, 'dist', 'webview', 'index.html'
    );
    let html = fs.readFileSync(webviewPath.fsPath, 'utf-8');

    const baseUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'webview')
    );

    // 相対パスを VS Code Webview URI に書き換える
    html = html
      .replace(/src="\.\/main\.js"/, `src="${baseUri}/main.js"`)
      .replace(/href="\.\/assets\//g, `href="${baseUri}/assets/`);

    return html;
  }

  public dispose(): void {
    AriaPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }
}
```

---

### M1-3: ファイル書き込みモジュール

**`src/extension/file-writer.ts`**:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { AriaState } from '../shared/types';
import { generateStatusMd } from './generators/status-md-generator';
import { generateArchitectureMermaid } from './generators/architecture-generator';
import { generateAdrFiles } from './generators/adr-generator';

const encoder = new TextEncoder();

// .ai-context/ 以下の全ファイルを書き出す
export async function writeAllAiContextFiles(
  workspacePath: string,
  state: AriaState,
  markWriteStart: () => void
): Promise<void> {
  const aiContextPath = path.join(workspacePath, '.ai-context');

  // ディレクトリを自動作成
  await ensureDirectory(aiContextPath);
  await ensureDirectory(path.join(aiContextPath, 'adr'));

  // 書き込み開始をマーク（FileSystemWatcher の誤検知防止）
  markWriteStart();

  // 各ファイルを並行して書き出す
  await Promise.all([
    writeFile(path.join(aiContextPath, 'aria-state.json'),
      JSON.stringify(state, null, 2)),
    writeFile(path.join(aiContextPath, 'status.md'),
      generateStatusMd(state.tasks)),
    writeFile(path.join(aiContextPath, 'architecture.mermaid'),
      generateArchitectureMermaid(state.nodes, state.edges)),
  ]);

  // ADR は個別ファイルのため別処理
  await generateAdrFiles(aiContextPath, state.adrs);
}

async function writeFile(filePath: string, content: string): Promise<void> {
  const uri = vscode.Uri.file(filePath);
  await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
}

async function ensureDirectory(dirPath: string): Promise<void> {
  const uri = vscode.Uri.file(dirPath);
  try {
    await vscode.workspace.fs.createDirectory(uri);
  } catch {
    // 既に存在する場合は無視
  }
}
```

---

### M1-4: FileSystemWatcher セットアップ

**`src/extension/aria-state-watcher.ts`**:

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AriaState } from '../shared/types';

// 自己書き込みループ防止：書き込み後 600ms は Watcher のイベントを無視
const WRITE_COOLDOWN_MS = 600;

export class AriaStateWatcher {
  private _watcher: vscode.FileSystemWatcher | undefined;
  private _isWriting = false;
  private _cooldownTimer: ReturnType<typeof setTimeout> | undefined;
  private _debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly _workspacePath: string,
    private readonly _onExternalChange: (rawJson: string) => Promise<void>
  ) {}

  public start(): void {
    const pattern = new vscode.RelativePattern(
      this._workspacePath,
      '.ai-context/aria-state.json'
    );

    this._watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const handleChange = async () => {
      // 自分自身の書き込みによる変更は無視
      if (this._isWriting) {
        return;
      }
      // 連続イベントをデバウンス（300ms）
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(async () => {
        const filePath = path.join(
          this._workspacePath, '.ai-context', 'aria-state.json'
        );
        try {
          const raw = await fs.readFile(filePath, 'utf-8');
          await this._onExternalChange(raw);
        } catch (err) {
          // ファイルが存在しない場合等は無視
        }
      }, 300);
    };

    this._watcher.onDidChange(handleChange);
    this._watcher.onDidCreate(handleChange);
  }

  // ファイル書き込み前に必ず呼ぶ
  public markWriteStart(): void {
    this._isWriting = true;
    if (this._cooldownTimer) clearTimeout(this._cooldownTimer);
    this._cooldownTimer = setTimeout(() => {
      this._isWriting = false;
    }, WRITE_COOLDOWN_MS);
  }

  public dispose(): void {
    this._watcher?.dispose();
    if (this._cooldownTimer) clearTimeout(this._cooldownTimer);
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  }
}
```

---

### M1-5: データ永続化モジュール

**`src/extension/persistence.ts`**:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { AriaState } from '../shared/types';

const ARIA_STATE_FILENAME = 'aria-state.json';
const CURRENT_SCHEMA_VERSION = '1.0.0';

// 初期状態
export const DEFAULT_ARIA_STATE: AriaState = {
  nodes: [],
  edges: [],
  tasks: {},
  adrs: {},
  version: CURRENT_SCHEMA_VERSION,
  lastModified: new Date().toISOString(),
};

// aria-state.json を読み込む
export async function loadAriaState(
  workspacePath: string
): Promise<AriaState> {
  const filePath = path.join(workspacePath, '.ai-context', ARIA_STATE_FILENAME);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;

    if (!isAriaState(parsed)) {
      console.warn('ARIA: aria-state.json のスキーマが無効です。初期状態を使用します。');
      return { ...DEFAULT_ARIA_STATE };
    }

    return parsed;
  } catch {
    // ファイルが存在しない（初回起動）→ 初期状態を返す
    return { ...DEFAULT_ARIA_STATE };
  }
}

// 型ガード
function isAriaState(value: unknown): value is AriaState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    'edges' in value &&
    'tasks' in value &&
    'adrs' in value
  );
}
```

---

### M1-6: ワークスペースルート解決ユーティリティ

**`src/extension/utils/workspace.ts`**:

```typescript
import * as vscode from 'vscode';

// 現在のワークスペースルートパスを取得する
// ワークスペースが開かれていない場合は null を返す
export function getWorkspacePath(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }
  // マルチルートワークスペースの場合は最初のフォルダを使用
  return folders[0].uri.fsPath;
}

// ワークスペースが開かれていない場合にエラーメッセージを表示する
export function requireWorkspace(): string | null {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    vscode.window.showErrorMessage(
      'ARIA: フォルダまたはワークスペースを開いてから使用してください。'
    );
    return null;
  }
  return workspacePath;
}
```

---

## ハマりどころ

### ハマり1: Extension Host は CJS 環境

- `require()` が使える
- ESM のみ対応のパッケージ（nanoid v5 等）はそのままでは使えない
- `crypto.randomUUID()` は Node.js 14.17+ で標準利用可能（使用推奨）

### ハマり2: `vscode.workspace.fs` と `fs` の使い分け

- `vscode.workspace.fs` は VS Code の権限チェックが入り、より安全
- `fs/promises` でも動作するが、Webview から直接使えない点に注意
- Extension Host 内では `fs/promises` も使用可（特に `readFile` 等）

### ハマり3: FileSystemWatcher のイベント多重発火

- 一つのファイル保存で `onDidChange` が複数回呼ばれることがある
- 300ms デバウンスで対処する（上記実装に含まれている）

---

## 完了条件（Acceptance Criteria）

1. `AriaPanel.createOrShow()` を呼び出すと Webview パネルが開く
2. 同じコマンドを再度実行すると、新しいパネルではなく既存パネルにフォーカスが当たる
3. `writeAllAiContextFiles()` を呼び出すと `.ai-context/` フォルダが自動作成される
4. `.ai-context/aria-state.json` を手動で変更すると `onExternalChange` コールバックが呼ばれる
5. `writeAllAiContextFiles()` の直後に `.ai-context/aria-state.json` を変更しても `onExternalChange` は呼ばれない（自己ループ防止が機能している）
6. ワークスペースを開いていない状態で `requireWorkspace()` を呼ぶとエラーメッセージが表示される

---

## 参照ファイル

- `ai_shared/specs/M0_environment_setup.md` — 環境構築（前提）
- `ai_shared/plans/phase1_mvp_plan.md` — リスク1（自己書き込みループ）対策

---

*最終更新: 2026-02-23 | バージョン: 1.0.0*
