# M11: セマンティックネットワーク機能拡張 — スペックキット

**前提条件**: M8 完了（M9 と並行実装可）
**推定工数**: 中
**プランファイル**: `ai_shared/plans/M9_M12_feature_expansion_plan.md`
**参照実装**: `docs/mindmap-local/js/app.js`（キーボード・右クリック実装の参考）

---

## ゴール

1. キーボードショートカット（Tab/Enter/Delete）でノードを素早く操作できる
2. 右クリックメニューからノードをタスクに直接追加できる
3. デザインは他サービス（XMind、Miro、FigJam 等）と明確に差別化する

---

## M11-1: キーボードショートカット

### 仕様

| キー | 動作 | 条件 |
|------|------|------|
| `Tab` | 選択中ノードの**子ノード**を追加 | mindmap ノードが選択中のみ |
| `Enter` | 選択中ノードの**兄弟ノード**を追加 | mindmap ノードが選択中のみ |
| `Delete` / `Backspace` | 選択中ノードを削除（子孫も連鎖削除） | mindmap ノードが選択中のみ |

### 変更ファイル: `webview/src/components/canvas/AriaCanvas.tsx`

```typescript
// useEffect でキャンバスにフォーカスが当たっている間の keydown を検知
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // 入力中（input/textarea）は無視
    if (['INPUT', 'TEXTAREA'].includes((e.target as Element).tagName)) return;

    const selectedMindmapNode = selectedNodes.find(n => n.type === 'mindmap');
    if (!selectedMindmapNode) return;

    switch (e.key) {
      case 'Tab':
        e.preventDefault(); // フォーカス移動を抑制
        e.stopPropagation(); // VS Code / React Flow 側への伝播抑制（必要時）
        addChildNode(selectedMindmapNode.id);
        break;
      case 'Enter':
        e.preventDefault(); // フォーム送信を抑制
        e.stopPropagation(); // React Flow 側への伝播抑制（必要時）
        addSiblingNode(selectedMindmapNode.id);
        break;
      case 'Delete':
      case 'Backspace':
        deleteMindmapNode(selectedMindmapNode.id);
        break;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedNodes]);
```

**注意**:
- `Tab` は VS Code のフォーカス移動と競合する可能性がある。`e.preventDefault()` を必ず呼ぶ
- `Tab` / `Enter` は必要に応じて `e.stopPropagation()` も呼ぶ（VS Code / React Flow との競合回避）
- `Enter` は React Flow のノード編集モードと競合しないよう、ノード編集中（isEditing状態）は無効化する
- `Delete` / `Backspace` は文字入力中（input要素にフォーカス）の誤発火を防ぐ
- `AriaCanvas.tsx` は C4 タブと Mindmap タブで共用されているため、キーボードショートカットは `canvasType === 'mindmap'` のときだけ有効化する
- 現行 Store に `selectedNodes` 専用 state はないため、React Flow ノード配列の `selected` フラグ（表示中ノードから抽出）を使うか、Store に専用 selector を追加する

### 子孫連鎖削除の実装

```typescript
// aria-store.ts に deleteMindmapNode アクション追加（または既存の deleteNode を拡張）
deleteMindmapNode: (nodeId: string) => {
  // 子孫ノードを再帰的に収集
  const collectDescendants = (id: string, collected: string[] = []): string[] => {
    const children = edges
      .filter(e => e.source === id)
      .map(e => e.target);
    children.forEach(childId => {
      collected.push(childId);
      collectDescendants(childId, collected);
    });
    return collected;
  };

  const descendants = collectDescendants(nodeId);
  const toDelete = [nodeId, ...descendants];

  set(state => ({
    nodes: state.nodes.filter(n => !toDelete.includes(n.id)),
    edges: state.edges.filter(e => !toDelete.includes(e.source) && !toDelete.includes(e.target)),
  }));
}
```

---

## M11-2: 右クリック「タスクへ追加」

### 変更ファイル: `webview/src/components/canvas/nodes/MindmapNode.tsx`（項目定義）＋ `webview/src/components/context-menu/ContextMenu.tsx`（サブメニューUI）

`mindmap` タイプのノードに対してのみ、以下のサブメニューを追加:

```
📋 タスクへ追加
  ├── ➕ 新規タスクとして追加
  └── 🔗 既存タスクに紐付け
```

#### 「➕ 新規タスクとして追加」の動作

```typescript
// ノードの label をタイトルとして Todo タスクを作成し、ノードに紐付け
const task = addTask(node.data.label);  // status: 'Todo'
linkTaskToNode(task.id, node.id);
```

#### 「🔗 既存タスクに紐付け」の動作

`TaskLinkPicker` コンポーネントを表示する。

**実装補足（現行コード基準）**:
- 現行の `ContextMenu.tsx` は「一次元のメニュー項目配列」を描画する汎用 UI で、メニュー項目そのものは各ノードコンポーネント（`MindmapNode.tsx` など）で定義している。
- 本仕様どおりサブメニューを出す場合は `ContextMenuItem` に `children?: ContextMenuItem[]` を追加し、`webview/src/components/context-menu/ContextMenu.tsx` 側の描画/ホバー挙動も拡張する。
- 段階実装にする場合は、第一段階でフラットな項目（例: 「📋 新規タスクとして追加」「📋 既存タスクに紐付け」）でも可否を事前合意すること。

### M11-2-4: TaskLinkPicker コンポーネント（新規作成）

**配置**: `webview/src/components/kanban/TaskLinkPicker.tsx`

**仕様**:
- モーダルダイアログ形式
- 表示するタスク: `status === 'Todo' || status === 'In Progress'` のもの（Done / Inbox は除外）
- タスクを選択 → `linkTaskToNode(taskId, nodeId)` を呼び出して閉じる
- キャンセルボタン・Escape キーで閉じる
- タスクが0件のときは「紐付けられるタスクがありません」と表示

```tsx
interface TaskLinkPickerProps {
  nodeId: string;
  onClose: () => void;
}
```

---

## M11-3: デザイン方針

**絶対に避けるスタイル**: XMind、Miro、FigJam、MindMeister のビジュアルスタイル

**ARIA 独自のデザイン指針**:
- shadcn/ui の `Card` コンポーネントをベースにしたノードスタイル（Canvas描画ではなく React DOM）
- 参照実装（`docs/mindmap-local`）の **機能面のみ**を参考にし、ビジュアルは独自に設計
- ARIAの統一カラースキーム（VS Code テーマ変数）を使用
- 接続線: React Flow の標準エッジ（smoothstep or bezier）をカスタムカラーで使用
- ノード形状: 角丸の shadcn Card（参照実装の Canvas圧縮スタイルとは異なる）

---

## M11-4: Acceptance Criteria

```
[ ] mindmap ノード選択中に Tab → 子ノードが追加され、フォーカスが移る
[ ] mindmap ノード選択中に Enter → 兄弟ノードが追加され、フォーカスが移る
[ ] mindmap ノード選択中に Delete → ノードと子孫が削除される
[ ] input 要素にフォーカス中は Tab/Enter/Delete がノード操作を発火しない
[ ] c4-container ノード選択中はキーボードショートカットが発火しない
[ ] 右クリック「新規タスクとして追加」→ カンバンの Todo 列にノード名のタスクが追加される
[ ] 右クリック「既存タスクに紐付け」→ TaskLinkPicker が開く
[ ] TaskLinkPicker でタスクを選択 → 対象ノードの linkedNodeIds に追加される
[ ] タスクが0件のとき TaskLinkPicker に「紐付けられるタスクがありません」が表示される
```

---

*最終更新: 2026-02-25 | バージョン: 1.0.0*
