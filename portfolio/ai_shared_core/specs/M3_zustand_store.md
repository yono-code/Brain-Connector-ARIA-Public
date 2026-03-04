# [M3] Zustand Store 実装 — スペックキット

## 概要

- **目的**: アプリの全状態を管理する Zustand Store を実装する
- **ゴール**: 全CRUD操作が提供され、モックデータでGUIが動作する
- **前提条件**: M2-1（VS Code API ブリッジ）完了
- **推定工数**: 1.5週間

---

## タスク一覧（チェックリスト形式）

- [ ] M3-1: コアデータ型定義（`src/shared/types.ts` に追記）
- [ ] M3-2: Zustand Store 基本実装
- [ ] M3-3: React Flow 標準アクション統合
- [ ] M3-4: タスク CRUD 実装
- [ ] M3-5: ADR CRUD 実装
- [ ] M3-6: 創発的タスク処理
- [ ] M3-7: ID 生成ユーティリティ
- [ ] M3-8: Store → Extension Host 橋渡し

---

## 技術仕様・実装ガイド

### M3-7: ID 生成ユーティリティ（先に実装する）

**`webview/src/utils/id-generator.ts`**:

```typescript
// Webview 環境（ブラウザ）では crypto.randomUUID() が使用可能
// Extension Host 環境でも同じ関数が使用可能（Node.js 14.17+）

function shortUuid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export function generateTaskId(): string {
  return `task-${shortUuid()}`;
}

export function generateNodeId(): string {
  return `node-${shortUuid()}`;
}

export function generateEdgeId(): string {
  return `edge-${shortUuid()}`;
}

export function generateAdrId(): string {
  return `adr-${shortUuid()}`;
}
```

---

### M3-2 〜 M3-8: Zustand Store 完全実装

**`webview/src/store/aria-store.ts`**:

```typescript
import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import {
  AriaState,
  AriaNode,
  AriaEdge,
  KanbanTask,
  ADR,
  TaskStatus,
} from '../../../src/shared/types';
import {
  generateTaskId,
  generateNodeId,
  generateEdgeId,
  generateAdrId,
} from '../utils/id-generator';
import { postToExtension } from '../hooks/use-vscode-bridge';

// =============================================================================
// Store 型定義
// =============================================================================

interface AriaStoreState extends AriaState {
  // React Flow アクション
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // ノード CRUD
  addNode: (type: AriaNode['type'], position: { x: number; y: number }, label: string) => AriaNode;
  deleteNode: (nodeId: string) => void;

  // タスク CRUD
  addTask: (title: string) => KanbanTask;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskTitle: (taskId: string, title: string) => void;
  deleteTask: (taskId: string) => void;
  linkTaskToNode: (taskId: string, nodeId: string) => void;

  // 創発的タスク（AIが生成したIDなしタスク）
  addEmergentTaskFromAI: (title: string) => KanbanTask;

  // ADR CRUD
  addADR: (linkedNodeId: string, title: string) => ADR;
  updateADR: (adrId: string, patch: Partial<Pick<ADR, 'decision' | 'rejectedOptions' | 'title'>>) => void;
  deleteADR: (adrId: string) => void;

  // 状態の一括更新（逆同期時に使用）
  setState: (newState: AriaState) => void;
}

// =============================================================================
// Store 実装
// =============================================================================

export const useAriaStore = create<AriaStoreState>((set, get) => ({
  // --- 初期状態 ---
  nodes: [],
  edges: [],
  tasks: {},
  adrs: {},
  version: '1.0.0',
  lastModified: new Date().toISOString(),

  // --- React Flow アクション ---

  onNodesChange: (changes) => {
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes) as AriaNode[],
    }));
    _notifyExtension(get());
  },

  onEdgesChange: (changes) => {
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges) as AriaEdge[],
    }));
    _notifyExtension(get());
  },

  onConnect: (connection) => {
    set((s) => ({
      edges: addEdge(
        { ...connection, id: generateEdgeId() },
        s.edges
      ) as AriaEdge[],
    }));
    _notifyExtension(get());
  },

  // --- ノード CRUD ---

  addNode: (type, position, label) => {
    const node: AriaNode = {
      id: generateNodeId(),
      type,
      position,
      data: { label },
    };
    set((s) => ({ nodes: [...s.nodes, node] }));
    _notifyExtension(get());
    return node;
  },

  deleteNode: (nodeId) => {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
      // 紐付いていたタスクの linkedNodeIds からも削除
      tasks: Object.fromEntries(
        Object.entries(s.tasks).map(([id, task]) => [
          id,
          {
            ...task,
            linkedNodeIds: task.linkedNodeIds.filter((nid) => nid !== nodeId),
          },
        ])
      ),
    }));
    _notifyExtension(get());
  },

  // --- タスク CRUD ---

  addTask: (title) => {
    const task: KanbanTask = {
      id: generateTaskId(),
      status: 'Todo',
      title,
      linkedNodeIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ tasks: { ...s.tasks, [task.id]: task } }));
    _notifyExtension(get());
    return task;
  },

  updateTaskStatus: (taskId, status) => {
    set((s) => ({
      tasks: {
        ...s.tasks,
        [taskId]: {
          ...s.tasks[taskId],
          status,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    _notifyExtension(get());
  },

  updateTaskTitle: (taskId, title) => {
    set((s) => ({
      tasks: {
        ...s.tasks,
        [taskId]: {
          ...s.tasks[taskId],
          title,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    _notifyExtension(get());
  },

  deleteTask: (taskId) => {
    set((s) => {
      const { [taskId]: _, ...remaining } = s.tasks;
      return { tasks: remaining };
    });
    _notifyExtension(get());
  },

  linkTaskToNode: (taskId, nodeId) => {
    set((s) => {
      const task = s.tasks[taskId];
      if (!task) return s;
      if (task.linkedNodeIds.includes(nodeId)) return s;
      return {
        tasks: {
          ...s.tasks,
          [taskId]: {
            ...task,
            linkedNodeIds: [...task.linkedNodeIds, nodeId],
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
    _notifyExtension(get());
  },

  // --- 創発的タスク ---

  addEmergentTaskFromAI: (title) => {
    const task: KanbanTask = {
      id: generateTaskId(),
      status: 'Inbox',  // AIが生成したタスクは必ず Inbox へ
      title,
      linkedNodeIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ tasks: { ...s.tasks, [task.id]: task } }));
    _notifyExtension(get());
    return task;
  },

  // --- ADR CRUD ---

  addADR: (linkedNodeId, title) => {
    const adr: ADR = {
      id: generateAdrId(),
      linkedNodeId,
      title,
      decision: '',
      rejectedOptions: [],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ adrs: { ...s.adrs, [adr.id]: adr } }));
    _notifyExtension(get());
    return adr;
  },

  updateADR: (adrId, patch) => {
    set((s) => ({
      adrs: {
        ...s.adrs,
        [adrId]: { ...s.adrs[adrId], ...patch },
      },
    }));
    _notifyExtension(get());
  },

  deleteADR: (adrId) => {
    set((s) => {
      const { [adrId]: _, ...remaining } = s.adrs;
      return { adrs: remaining };
    });
    _notifyExtension(get());
  },

  // --- 状態の一括更新（逆同期時に使用） ---

  setState: (newState) => {
    set({
      ...newState,
      lastModified: new Date().toISOString(),
    });
    // 逆同期では Extension Host への通知は不要（無限ループ防止）
  },
}));

// =============================================================================
// Extension Host への通知（Debounce 付き）
// =============================================================================

let _debounceTimer: ReturnType<typeof setTimeout> | undefined;

function _notifyExtension(state: AriaState): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    postToExtension({ type: 'STATE_CHANGED', payload: state });
  }, 300);  // UI操作のバースト送信を防ぐ 300ms デバウンス
  // ※ Extension Host 側でさらに 2秒 Debounce してからファイル書き込みを行う
}
```

---

## ハマりどころ

### ハマり1: `applyNodeChanges` の型

`@xyflow/react` v12 では `Node` 型の定義が変わっている。`AriaNode` が `Node` を継承しているか、または `as AriaNode[]` のキャストが必要になる場合がある。公式の型定義を確認すること。

### ハマり2: 逆同期時の `setState` での Extension Host への通知

`setState`（逆同期で使用）では Extension Host への通知（`_notifyExtension`）を行わない。
これを行うと、Extension Host → Webview → Extension Host の無限ループが発生する。

### ハマり3: Zustand の `subscribe` vs React コンポーネント

- Zustand の `subscribe` は React レンダリングサイクル外で動作する
- `setState` コールバック内でセレクターを計算しないこと（古い state を参照する可能性がある）

---

## 完了条件（Acceptance Criteria）

1. `addTask('テストタスク')` を呼び出すとカンバンの Todo 列にカードが追加される
2. `updateTaskStatus(taskId, 'Done')` を呼び出すとカードが Done 列に移動する
3. `addEmergentTaskFromAI('AIが生成したタスク')` を呼び出すとカードが Inbox 列に追加される
4. `addNode('c4-container', {x:100, y:100}, 'システム')` を呼び出すとキャンバスにノードが追加される
5. `deleteNode(nodeId)` を呼び出すとノードと紐付きエッジ・タスクリンクが削除される
6. タスク操作後に `postToExtension({ type: 'STATE_CHANGED', ... })` が呼ばれる（コンソールで確認）
7. `setState(newState)` で全状態が更新されても Extension Host への通知は行われない

---

## 参照ファイル

- `ai_shared/specs/M2_webview_reactflow.md` — M2-1 VS Code API ブリッジ（前提）
- `src/shared/types.ts` — コアデータ型定義

---

*最終更新: 2026-02-23 | バージョン: 1.0.0*
