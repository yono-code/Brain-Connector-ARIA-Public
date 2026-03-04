# M12: タスクリスト 日付管理＋フィルター — スペックキット

**前提条件**: M8 完了（M9 と並行実装可）
**推定工数**: 小〜中
**プランファイル**: `ai_shared/plans/M9_M12_feature_expansion_plan.md`

---

## ゴール

タスクに開始日・納期を設定でき、完了した古いタスクをフィルターで隠せる。

---

## M12-1: データモデル拡張

### 変更ファイル: `src/shared/types.ts`

```typescript
interface KanbanTask {
  id: string;
  status: TaskStatus;
  title: string;
  linkedNodeIds: string[];
  createdAt: string;        // 既存
  updatedAt: string;        // 既存
  startDate?: string;       // 新規追加: YYYY-MM-DD 形式（ISO 8601 日付）
  dueDate?: string;         // 新規追加: YYYY-MM-DD 形式（ISO 8601 日付）
}
```

**日付フォーマット**: `YYYY-MM-DD`（時刻なし）。ブラウザの `<input type="date">` の value 形式と一致。

**後方互換性**: `startDate` / `dueDate` はオプショナル（`?`）のため、既存の `aria-state.json` の読み込みに影響なし。

### Zustand Store の変更（`webview/src/store/aria-store.ts`）

`updateTask` アクションのパッチ型に `startDate` / `dueDate` を追加:

```typescript
updateTask: (taskId: string, patch: Partial<Pick<KanbanTask, 'title' | 'status' | 'startDate' | 'dueDate'>>) => void;
```

**実装補足（現行コード基準）**:
- 現行 Store は `updateTaskStatus()` / `updateTaskTitle()` の分割 API で、`updateTask()` は未実装。
- M12 では `updateTask()` を新規追加し、既存 API はラッパーとして残す（後方互換）か、Kanban 側のみ新 API に移行する方針に統一する。
- `_notifyExtension()` の payload は `tasks` 全体送信のため、タスク型に日付が追加されても追加対応は不要（型更新のみ）。

### Extension Host の変更（逆同期対応）

**変更ファイル**: `src/extension/parse-aria-state.ts`

- `sanitizeTasks()` で `startDate` / `dueDate` を保持・型検証する（文字列以外は `undefined`）。
- これを行わない場合、外部編集された `aria-state.json` の日付情報が逆同期時に失われる。

---

## M12-2: UI 実装

### M12-2-1 + M12-2-2: KanbanCard.tsx — 日付表示と超過警告

```tsx
// 日付がある場合に表示
{(task.startDate || task.dueDate) && (
  <div className="task-dates">
    {task.startDate && <span>📅 {task.startDate}</span>}
    {task.startDate && task.dueDate && <span> 〜 </span>}
    {task.dueDate && (
      <span className={isOverdue(task.dueDate) ? 'text-destructive' : ''}>
        {task.dueDate}
      </span>
    )}
  </div>
)}
```

```typescript
// 期限超過判定（当日はまだ超過としない）
const isOverdue = (dueDate: string): boolean => {
  const today = getLocalTodayYmd(); // YYYY-MM-DD（ローカル日付基準）
  return dueDate < today;
};
```

```typescript
// UTC の toISOString() は使わず、ローカル日付を使う
const getLocalTodayYmd = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
```

### M12-2-3: KanbanCard.tsx（日付入力フォーム・現行UIベース）

現行実装には専用タスク編集パネルがないため、まずは `KanbanCard.tsx` 内（既存のタイトル/ステータス UI の近く）に日付フィールドを追加する方針とする。新規サイドパネル作成は M12 スコープ外。

```tsx
<input
  type="date"
  value={task.startDate ?? ''}
  onChange={e => updateTask(task.id, { startDate: e.target.value || undefined })}
/>
<input
  type="date"
  value={task.dueDate ?? ''}
  onChange={e => updateTask(task.id, { dueDate: e.target.value || undefined })}
/>
```

### M12-2-4: KanbanBoard.tsx — フィルタートグル

**フィルター条件（仮）**: `status === 'Done'` かつ `dueDate` が設定されていて `今日 > dueDate + 7日`

```typescript
// フィルター条件
const shouldHide = (task: KanbanTask, filterEnabled: boolean): boolean => {
  if (!filterEnabled) return false;
  if (task.status !== 'Done') return false;
  if (!task.dueDate) return false;
  const threshold = new Date(task.dueDate);
  threshold.setDate(threshold.getDate() + 7);
  return new Date() > threshold;
};
```

**実装補足（タイムゾーン）**:
- `new Date('YYYY-MM-DD')` は UTC 扱いになる環境差があり得るため、`dueDate` の比較はローカル日付として `YYYY-MM-DD` を分解して `new Date(year, month-1, day)` で生成するヘルパーを使う方が安全。

**トグルボタン**:

```tsx
// カンバンヘッダーに配置
const [filterOld, setFilterOld] = useState(true); // デフォルト: ON（古い完了タスクを隠す）

<button onClick={() => setFilterOld(!filterOld)}>
  {filterOld ? '🔽 完了タスクを一部非表示中' : '🔼 すべて表示'}
</button>
```

**フィルター状態の永続化（補足決定）**: `AriaState` には含めず `localStorage` に保持する（推奨キー例: `aria.kanban.hideOldDone`）。`.ai-context/aria-state.json` の差分ノイズを増やさないため。

---

## M12-3: ファイル出力更新

### 変更ファイル: `src/extension/generators/status-md-generator.ts`

`dueDate` / `startDate` が設定されているタスクは、行に日付情報を付与:

```markdown
## ✅ Done
- [x] タスクタイトル 📅 2026-02-25〜2026-03-10 <!-- task-id-task-xxxxxxxx -->
```

**フォーマット規則**:
- `startDate` のみ: `📅 2026-02-25〜`
- `dueDate` のみ: `📅 〜2026-03-10`
- 両方: `📅 2026-02-25〜2026-03-10`
- どちらもなし: 日付情報なし（既存通り）

**IDアンカー位置**: 日付情報の後ろに配置（既存のパーサーはIDアンカーを行末から検索するため影響なし）

**実装補足**:
- 日付文字列は `task.title` と同様にそのまま出力せず、`undefined` の組み合わせを分岐してフォーマット関数にまとめると保守しやすい。
- `status.md` の逆同期起点は現状 `aria-state.json` であり、M12 では `status.md` 解析ロジック追加はスコープ外（出力のみ更新）。

---

## M12-4: Acceptance Criteria

```
[ ] KanbanCard の編集モードに「開始日」「納期」入力欄が表示される
[ ] 日付を設定すると KanbanCard に日付が表示される（📅 開始日〜納期）
[ ] 納期が過去日の場合、納期が赤文字で表示される
[ ] フィルタートグル ON（デフォルト）: Done かつ dueDate+7日経過タスクが非表示
[ ] フィルタートグル OFF: すべてのタスクが表示される
[ ] status.md に日付情報が出力される
[ ] 日付未設定のタスクは status.md に日付情報なし（既存通り）
[ ] 既存の aria-state.json（日付フィールドなし）を読み込んでもエラーが発生しない
```

---

*最終更新: 2026-02-25 | バージョン: 1.0.0*
