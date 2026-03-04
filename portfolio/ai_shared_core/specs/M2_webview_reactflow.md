# [M2] Webview 基盤 + React Flow 統合 — スペックキット

## 概要

- **目的**: Webview 内に React Flow キャンバス・カンバンボード・ADRパネルの骨格を実装する
- **ゴール**: GUIの全エリアが表示され、モックデータで基本的なインタラクションが動作する
- **前提条件**: M0 完了
- **推定工数**: 2週間
- **並行可能**: M1（Extension Host）と並行実施可能。ただし M3（Zustand Store）開始には M2-1 完了が必要

---

## タスク一覧（チェックリスト形式）

- [ ] M2-1: VS Code API ブリッジ実装
- [ ] M2-2: React Flow 基本表示確認
- [ ] M2-3: カスタムノードタイプ実装（3種）
- [ ] M2-4: カンバンボード UI
- [ ] M2-5: ADR 入力パネル UI
- [ ] M2-6: アプリ全体レイアウト
- [ ] M2-7: VS Code テーマ連携

---

## 技術仕様・実装ガイド

### M2-1: VS Code API ブリッジ

Webview 内で `acquireVsCodeApi()` を使い、Extension Host との通信を抽象化する。

**`webview/src/hooks/use-vscode-bridge.ts`**:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../../../src/shared/types';

// VS Code API のシングルトンを取得
// Webview 内でのみ動作する（開発時のモックが必要）
function getVsCodeApi() {
  if (typeof window !== 'undefined' && 'acquireVsCodeApi' in window) {
    return (window as unknown as { acquireVsCodeApi: () => { postMessage: (msg: unknown) => void } })
      .acquireVsCodeApi();
  }
  // 開発環境（Vite dev server）では console.log にフォールバック
  return {
    postMessage: (msg: unknown) => {
      console.log('[DEV] postMessage:', msg);
    },
  };
}

const vscode = getVsCodeApi();

// Extension Host へメッセージを送信する
export function postToExtension(message: WebviewToExtensionMessage): void {
  vscode.postMessage(message);
}

// Extension Host からのメッセージを受信するフック
export function useExtensionMessages(
  onMessage: (message: ExtensionToWebviewMessage) => void
): void {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as ExtensionToWebviewMessage;
      onMessageRef.current(message);
    };
    window.addEventListener('message', handler);

    // 準備完了を Extension Host に通知
    postToExtension({ type: 'READY' });

    return () => window.removeEventListener('message', handler);
  }, []);
}
```

---

### M2-2: React Flow 基本表示確認

**`webview/src/components/canvas/AriaCanvas.tsx`**:

```typescript
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAriaStore } from '../../store/aria-store';
import { C4ContainerNode } from './nodes/C4ContainerNode';
import { MindmapNode } from './nodes/MindmapNode';

// カスタムノードタイプの登録（コンポーネント外で定義して再生成を防ぐ）
const nodeTypes = {
  'c4-container': C4ContainerNode,
  'c4-component': C4ContainerNode,  // MVP では同じコンポーネントを流用
  'mindmap': MindmapNode,
};

export function AriaCanvas() {
  const nodes = useAriaStore((s) => s.nodes);
  const edges = useAriaStore((s) => s.edges);
  const onNodesChange = useAriaStore((s) => s.onNodesChange);
  const onEdgesChange = useAriaStore((s) => s.onEdgesChange);
  const onConnect = useAriaStore((s) => s.onConnect);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

> **注意**: `@xyflow/react` v12 では `nodeTypes` の型や `onNodesChange` の型が変わっている可能性がある。
> 必ず公式ドキュメント（https://reactflow.dev）の最新版を確認してから実装すること。

---

### M2-3: カスタムノードタイプ実装

**`webview/src/components/canvas/nodes/C4ContainerNode.tsx`**:

```typescript
import { NodeProps, Handle, Position } from '@xyflow/react';
import { Badge } from '../../ui/badge';  // shadcn/ui

interface C4ContainerData {
  label: string;
  description?: string;
  technology?: string;
}

export function C4ContainerNode({ data, selected }: NodeProps<{ data: C4ContainerData }>) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: `2px solid ${selected
          ? 'var(--vscode-focusBorder)'
          : 'var(--vscode-panel-border)'}`,
        background: 'var(--vscode-editor-background)',
        minWidth: 160,
        maxWidth: 240,
      }}
    >
      <Handle type="target" position={Position.Top} />

      <div style={{ fontWeight: 'bold', color: 'var(--vscode-editor-foreground)' }}>
        {data.label}
      </div>

      {data.technology && (
        <Badge variant="outline" style={{ marginTop: 4, fontSize: 10 }}>
          {data.technology}
        </Badge>
      )}

      {data.description && (
        <div style={{
          marginTop: 4,
          fontSize: 11,
          color: 'var(--vscode-descriptionForeground)',
        }}>
          {data.description}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

---

### M2-4: カンバンボード UI

**`webview/src/components/kanban/KanbanBoard.tsx`**:

```typescript
import { useAriaStore } from '../../store/aria-store';
import { KanbanCard } from './KanbanCard';
import { TaskStatus } from '../../../../src/shared/types';

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'Inbox',       label: '📥 Inbox',       color: '#d97706' },
  { id: 'Todo',        label: '⬜ Todo',         color: '#6b7280' },
  { id: 'In Progress', label: '🔵 In Progress',  color: '#2563eb' },
  { id: 'Done',        label: '✅ Done',          color: '#16a34a' },
];

export function KanbanBoard() {
  const tasks = useAriaStore((s) => Object.values(s.tasks));

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: 12,
      overflowX: 'auto',
      height: '100%',
      background: 'var(--vscode-sideBar-background)',
    }}>
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        return (
          <div key={col.id} style={{
            minWidth: 200,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {/* カラムヘッダー */}
            <div style={{
              fontWeight: 'bold',
              fontSize: 12,
              color: col.color,
              paddingBottom: 8,
              borderBottom: `2px solid ${col.color}`,
            }}>
              {col.label} ({colTasks.length})
            </div>

            {/* タスクカード */}
            {colTasks.map((task) => (
              <KanbanCard key={task.id} task={task} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

---

### M2-6: アプリ全体レイアウト

**`webview/src/App.tsx`**:

```typescript
import { useEffect } from 'react';
import { AriaCanvas } from './components/canvas/AriaCanvas';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { useExtensionMessages, postToExtension } from './hooks/use-vscode-bridge';
import { useAriaStore } from './store/aria-store';
import { ExtensionToWebviewMessage } from '../../src/shared/types';

export function App() {
  const setState = useAriaStore((s) => s.setState);

  // Extension Host からのメッセージを処理
  useExtensionMessages((message: ExtensionToWebviewMessage) => {
    switch (message.type) {
      case 'INIT_STATE':
      case 'STATE_UPDATED':
        setState(message.payload);
        break;
      case 'ERROR':
        console.error('ARIA Extension Error:', message.payload.message);
        break;
    }
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--vscode-editor-background)',
      color: 'var(--vscode-editor-foreground)',
    }}>
      {/* ツールバー */}
      <div style={{
        height: 40,
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-sideBar-background)',
      }}>
        <span style={{ fontWeight: 'bold' }}>ARIA</span>
      </div>

      {/* メインコンテンツ: キャンバス（上） + カンバン（下） */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* React Flow キャンバス */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <AriaCanvas />
        </div>

        {/* カンバンボード（固定高さ） */}
        <div style={{
          height: 280,
          borderTop: '1px solid var(--vscode-panel-border)',
          overflow: 'hidden',
        }}>
          <KanbanBoard />
        </div>
      </div>
    </div>
  );
}
```

---

### M2-7: VS Code テーマ連携

VS Code は Webview に対して CSS 変数を自動注入する。これを shadcn/ui と合わせて使う。

**`webview/src/styles/theme.css`**:

```css
/* VS Code テーマ変数をそのまま活用する */
/* shadcn/ui のデフォルト変数を VS Code 変数で上書き */
:root {
  --background: var(--vscode-editor-background);
  --foreground: var(--vscode-editor-foreground);
  --border: var(--vscode-panel-border);
  --ring: var(--vscode-focusBorder);
}

/* React Flow のデフォルトスタイルをテーマに合わせる */
.react-flow__background {
  background: var(--vscode-editor-background) !important;
}

.react-flow__controls {
  background: var(--vscode-sideBar-background) !important;
  border-color: var(--vscode-panel-border) !important;
}

/* ステータスバッジ（テーマに関係なく視認性を保つ） */
.status-inbox    { background: #d97706; color: #fff; }
.status-todo     { background: #6b7280; color: #fff; }
.status-progress { background: #2563eb; color: #fff; }
.status-done     { background: #16a34a; color: #fff; }
```

---

## ハマりどころ

### ハマり1: `@xyflow/react` の API 変更

- v12 では `Node` 型の `data` フィールドの型付けが変わっている
- `NodeProps<{data: T}>` という形式から変わっている可能性がある
- 必ず公式サンプルコードを参照すること: https://reactflow.dev/examples

### ハマり2: VS Code Webview の CSP でスタイルが適用されない

- `@xyflow/react/dist/style.css` のインポートが CSP でブロックされる場合がある
- Vite のビルドでスタイルをインラインに含めるか、`<style>` タグとして注入する

### ハマり3: `acquireVsCodeApi()` は一度しか呼べない

- `acquireVsCodeApi()` を複数回呼ぶとエラーになる
- `use-vscode-bridge.ts` のように、モジュールレベルでシングルトンとして管理する

---

## 完了条件（Acceptance Criteria）

1. Webview 内に React Flow のキャンバスが表示される（背景グリッド、コントロール、ミニマップ含む）
2. モックデータのノードを Props として渡すと、カスタムノードとして描画される
3. カンバンボードが4列（Inbox/Todo/In Progress/Done）で表示される
4. VS Code のテーマをダーク/ライトに切り替えても、UIが白/黒で固定されず追従する
5. Extension Host から `INIT_STATE` メッセージを受け取ると Zustand Store が更新される

---

## 参照ファイル

- `ai_shared/specs/M0_environment_setup.md` — 環境構築（前提）
- `ai_shared/specs/M1_extension_host.md` — postMessage型定義（M1-2）
- React Flow UI 公式: https://reactflow.dev
- shadcn/ui 公式: https://ui.shadcn.com

---

*最終更新: 2026-02-23 | バージョン: 1.0.0*
