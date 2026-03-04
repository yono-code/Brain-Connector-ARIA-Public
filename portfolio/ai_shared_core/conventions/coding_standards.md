# coding_standards.md — ARIA コーディング規約

> TypeScript / React / VS Code Extension 開発における規約を定めます。
> すべてのAIエージェントはこの規約に従ってコードを生成してください。

---

## 1. TypeScript 規約

### 型定義の必須化

```typescript
// NG: 型なし変数
const items = [];
const data = {};
let status = 'Todo';

// OK: 型付き変数
const items: KanbanTask[] = [];
const data: AriaState = { nodes: [], edges: [], tasks: {}, adrs: {} };
let status: TaskStatus = 'Todo';
```

### `any` 型の禁止

```typescript
// NG
function parse(data: any): any { ... }

// OK
function parse(data: unknown): AriaState | null { ... }
```

### 型ガードの活用

```typescript
// OK: 型ガードで安全に処理
function isAriaState(value: unknown): value is AriaState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    'tasks' in value
  );
}
```

### インターフェース vs 型エイリアス

- オブジェクトの形状定義には `interface` を使用
- Union 型・複合型には `type` を使用

```typescript
// オブジェクト形状 → interface
interface KanbanTask {
  id: string;
  status: TaskStatus;
  title: string;
  linkedNodeIds: string[];
}

// Union型 → type
type TaskStatus = 'Todo' | 'In Progress' | 'Done' | 'Inbox';
type ExtensionMessage = InitMessage | UpdateMessage | ErrorMessage;
```

---

## 2. ファイル命名規約

| 対象 | 規則 | 例 |
|------|------|-----|
| Reactコンポーネント | `PascalCase.tsx` | `KanbanBoard.tsx` |
| カスタムフック | `use-kebab-case.ts` | `use-aria-store.ts` |
| ユーティリティ関数 | `kebab-case.ts` | `parse-status-md.ts` |
| 型定義ファイル | `types.ts` または `[domain].types.ts` | `aria.types.ts` |
| テストファイル | `[対象ファイル].test.ts` | `parse-status-md.test.ts` |
| Extension Host モジュール | `kebab-case.ts` | `aria-state-watcher.ts` |

---

## 3. フォルダ構成規約

```
src/
├── extension/                    ← Extension Host（Node.js/CJS環境）
│   ├── extension.ts              ← エントリーポイント
│   ├── aria-panel.ts             ← Webviewパネル管理
│   ├── file-writer.ts            ← ファイル書き込みモジュール
│   ├── aria-state-watcher.ts     ← FileSystemWatcher
│   ├── persistence.ts            ← データ永続化
│   └── utils/
│       └── aria-logger.ts        ← ログユーティリティ
│
├── webview/                      ← Webview（ブラウザ/ESM環境）
│   ├── main.tsx                  ← Reactエントリーポイント
│   ├── App.tsx                   ← アプリルートコンポーネント
│   ├── components/               ← UIコンポーネント
│   │   ├── canvas/               ← React Flow関連
│   │   │   ├── AriaCanvas.tsx
│   │   │   └── nodes/
│   │   │       ├── C4ContainerNode.tsx
│   │   │       └── MindmapNode.tsx
│   │   ├── kanban/               ← カンバンボード
│   │   │   ├── KanbanBoard.tsx
│   │   │   └── KanbanCard.tsx
│   │   └── ui/                   ← shadcn/ui ラッパー
│   ├── hooks/                    ← カスタムフック
│   │   ├── use-vscode-bridge.ts  ← postMessage通信
│   │   └── use-aria-store.ts     ← Zustand
│   ├── store/                    ← Zustand Store
│   │   └── aria-store.ts
│   └── utils/
│       └── id-generator.ts       ← ID生成ユーティリティ
│
└── shared/                       ← Extension Host / Webview 共通型
    └── types.ts
```

---

## 4. React コンポーネント規約

### 関数コンポーネントのみ使用

```typescript
// OK: 関数コンポーネント
const KanbanCard: React.FC<KanbanCardProps> = ({ task, onStatusChange }) => {
  return <div>...</div>;
};

// NG: クラスコンポーネント（禁止）
class KanbanCard extends React.Component { ... }
```

### Props 型定義

```typescript
// OK: Props は必ず型定義する
interface KanbanCardProps {
  task: KanbanTask;
  onStatusChange: (id: string, newStatus: TaskStatus) => void;
}
```

### カスタムフックの分離

- ロジックはカスタムフックに分離し、コンポーネントをシンプルに保つ

```typescript
// OK: ロジックをフックに切り出す
function useTaskDragDrop(taskId: string) {
  const updateStatus = useAriaStore((s) => s.updateTaskStatus);
  // ドラッグ&ドロップのロジック
  return { onDrop, onDragOver };
}

// コンポーネントはシンプルに
const KanbanCard: React.FC<Props> = ({ task }) => {
  const { onDrop, onDragOver } = useTaskDragDrop(task.id);
  return <div onDrop={onDrop} onDragOver={onDragOver}>...</div>;
};
```

### パフォーマンス最適化

- 不要な再レンダリングを防ぐために `React.memo` / `useCallback` / `useMemo` を適切に使用
- Zustand の selector を細粒度にし、関係ないState変更で再レンダリングしないようにする

```typescript
// OK: 必要なデータのみセレクト
const taskCount = useAriaStore((s) => s.tasks.length);

// NG: Store全体をセレクト（不要な再レンダリングが発生）
const store = useAriaStore();
```

---

## 5. VS Code 拡張機能特有の規約

### Webview の CSP（Content Security Policy）

```typescript
// Webviewパネル作成時に必ずCSPを設定する
const panel = vscode.window.createWebviewPanel(
  'ariaPanel',
  'ARIA',
  vscode.ViewColumn.One,
  {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
    ],
    // 外部リソースへのアクセスを禁止（ローカルリソースのみ）
    retainContextWhenHidden: true,
  }
);
```

### postMessage の型付け（必須）

```typescript
// src/shared/types.ts で共通型を定義
// Extension Host → Webview
type ExtensionToWebviewMessage =
  | { type: 'INIT_STATE'; payload: AriaState }
  | { type: 'STATE_UPDATED'; payload: AriaState }
  | { type: 'ERROR'; payload: { message: string } };

// Webview → Extension Host
type WebviewToExtensionMessage =
  | { type: 'READY' }
  | { type: 'STATE_CHANGED'; payload: AriaState };
```

### vscode.workspace.fs の使用

```typescript
// OK: vscode.workspace.fs を使う（権限チェック・エラーハンドリング付き）
const encoder = new TextEncoder();
await vscode.workspace.fs.writeFile(uri, encoder.encode(content));

// NG: fs.promises.writeFile の直接使用（Extension Host では可だが、fs APIを統一する）
```

### Extension Host での ID 生成

```typescript
// OK: crypto.randomUUID() を使う（ESM/CJS問題がない）
function generateTaskId(): string {
  return `task-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

// NG: nanoid（ESMのみ対応のバージョンは Extension Host で使えない）
```

---

## 6. コメント規約

### 日本語で記述する

```typescript
// OK: 日本語コメント
// Zustand Store の変更を Extension Host に通知するサブスクライバー
const unsubscribe = useAriaStore.subscribe((state) => {
  vscode.postMessage({ type: 'STATE_CHANGED', payload: state });
});

// NG: 英語のみ（禁止）
// Subscriber to notify Extension Host of Zustand Store changes
```

### セクション区切り

```typescript
// --- データ変換 ---

// --- イベントハンドラ ---

// --- ライフサイクル ---
```

### 複雑なロジックへの説明コメント

- 10行を超える新規ロジックには必ず説明コメントを付ける
- 「何をしているか」ではなく「なぜそうしているか」を書く

```typescript
// OK: 「なぜ」を説明する
// FileSystemWatcher の自己検知ループを防ぐため、書き込み完了後 600ms は
// 外部変更イベントを無視する。600ms は Debounce(2秒) より短く、
// 十分な余裕を持って自己書き込みと外部変更を区別できる値。
const WRITE_COOLDOWN_MS = 600;

// NG: 「何をしているか」だけ（意味が薄い）
// クールダウンを 600ms に設定する
const WRITE_COOLDOWN_MS = 600;
```

---

## 7. コミットメッセージ形式

```
[Type]: 日本語の説明 (補足情報)
```

| Type | 用途 |
|------|------|
| `feat:` | 新機能の追加 |
| `fix:` | バグ修正 |
| `refactor:` | 動作変更なしのコード改善 |
| `test:` | テストの追加・修正 |
| `docs:` | ドキュメントの変更 |
| `chore:` | ビルド・設定等の雑務 |
| `style:` | フォーマット・スタイルのみの変更 |

**例**:
```
feat: status.md の自動生成ロジックを実装 (M4-2)
fix: FileSystemWatcher の自己ループ検知バグを修正
docs: M5_reverse_sync.md にエッジケース対処法を追記
```

---

*最終更新: 2026-02-23 | バージョン: 1.0.0*
