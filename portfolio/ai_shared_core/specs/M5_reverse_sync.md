# [M5] ファイル → GUI 逆同期 — スペックキット【最難関】

## 概要

- **目的**: `aria-state.json` が外部から変更されたとき、GUIに自動反映する
- **ゴール**: ファイル手動編集後 2秒以内に Zustand Store が更新され、UIが再レンダリングされる
- **前提条件**: M1-4（FileSystemWatcher）、M3-6（創発的タスク処理）、M4（ファイル出力）完了
- **推定工数**: 2週間
- **難易度**: ★★★★★（最難関）

---

## このマイルストーンの難しさ

以下の3つの問題が複雑に絡み合います：

1. **自己書き込みループ**: ARIAが書いたファイルをARIA自身が再検知して無限に更新が走る
2. **競合解消**: AIが書いた内容（不正なID、不正なステータス等）を安全に処理する
3. **部分更新**: ノード座標など GUI固有データは上書きせず、ステータス等のみ更新する

---

## タスク一覧（チェックリスト形式）

- [ ] M5-1: `aria-state.json` パーサー実装（バリデーション付き）
- [ ] M5-2: `AriaStateWatcher` との統合（M1-4 で実装済みのものを接続）
- [ ] M5-3: 差分検出と Store 更新ロジック
- [ ] M5-4: 不正タスクの Inbox 隔離
- [ ] M5-5: パース結果の Webview 送信
- [ ] M5-6: Webview 側 Store 更新受信（`setState` の呼び出し）
- [ ] M5-7: エッジケース対応（不正JSON・空ファイル・BOM等）

---

## 技術仕様・実装ガイド

### M5-1: aria-state.json パーサー

**`src/extension/sync/parse-aria-state.ts`**:

```typescript
import { AriaState, KanbanTask, TaskStatus } from '../../shared/types';

const VALID_STATUSES: TaskStatus[] = ['Todo', 'In Progress', 'Done', 'Inbox'];
const TASK_ID_PATTERN = /^task-[a-f0-9]{8}$/;

type ParseResult =
  | { ok: true; state: AriaState }
  | { ok: false; error: string };

// aria-state.json の生テキストをパースし、バリデーションを行う
export function parseAriaState(raw: string): ParseResult {
  // BOM 除去
  const cleaned = raw.replace(/^\uFEFF/, '').trim();

  if (!cleaned) {
    return { ok: false, error: 'ファイルが空です' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, error: `JSONパースエラー: ${(e as Error).message}` };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: '最上位の値がオブジェクトではありません' };
  }

  // 必須フィールドの確認
  const requiredFields = ['nodes', 'edges', 'tasks', 'adrs'];
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      return { ok: false, error: `必須フィールド "${field}" が存在しません` };
    }
  }

  const state = parsed as AriaState;

  // タスクのバリデーション（不正なデータを Inbox に変換）
  const sanitizedTasks: Record<string, KanbanTask> = {};
  for (const [id, task] of Object.entries(state.tasks ?? {})) {
    if (!isObject(task)) continue;

    const t = task as KanbanTask;

    // IDフォーマットが不正 → スキップ（または Inbox に隔離）
    if (!TASK_ID_PATTERN.test(id)) {
      console.warn(`ARIA: 不正なタスクID "${id}" を Inbox に隔離します`);
      const safeId = `task-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
      sanitizedTasks[safeId] = {
        ...t,
        id: safeId,
        status: 'Inbox',
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    // ステータスが不正 → Inbox にフォールバック
    if (!VALID_STATUSES.includes(t.status)) {
      console.warn(`ARIA: タスク "${id}" の不正なステータス "${t.status}" を Inbox に変換します`);
      sanitizedTasks[id] = { ...t, status: 'Inbox' };
      continue;
    }

    sanitizedTasks[id] = t;
  }

  return {
    ok: true,
    state: {
      ...state,
      tasks: sanitizedTasks,
      lastModified: new Date().toISOString(),
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

---

### M5-3: 差分検出と State-First Reconciliation

外部変更を取り込む際、ノード座標などのGUI固有データは **現在の State から保持** する。

**`src/extension/sync/reconcile-state.ts`**:

```typescript
import { AriaState, AriaNode } from '../../shared/types';

/**
 * 外部変更された State を現在の State にマージする。
 *
 * ルール:
 * - tasks / adrs → incoming を優先（AIや人間の変更を反映）
 * - nodes の position → current を優先（GUI座標を保護）
 * - nodes の data（label等）→ incoming を優先
 * - edges → incoming を優先
 */
export function reconcileState(
  incoming: AriaState,
  current: AriaState
): AriaState {
  // ノードの座標を current から保持しつつ、data は incoming から取得
  const reconciledNodes: AriaNode[] = incoming.nodes.map((incomingNode) => {
    const currentNode = current.nodes.find((n) => n.id === incomingNode.id);
    if (!currentNode) {
      // 新規ノード → incoming のまま使用
      return incomingNode;
    }
    return {
      ...incomingNode,
      // 座標は current を維持（AIによる座標変更は無視）
      position: currentNode.position,
    };
  });

  return {
    ...incoming,
    nodes: reconciledNodes,
    lastModified: new Date().toISOString(),
  };
}
```

---

### M5-2 + M5-5 + M5-6: Extension Host での統合

`src/extension.ts` の `onExternalChange` コールバックを完成させる:

```typescript
// AriaStateWatcher の onExternalChange コールバック（Extension Host 内）
const onExternalChange = async (rawJson: string) => {
  const result = parseAriaState(rawJson);

  if (!result.ok) {
    // パースエラー → ログ出力してGUIはクラッシュさせない
    console.error(`ARIA: aria-state.json のパースエラー: ${result.error}`);
    vscode.window.showWarningMessage(
      `ARIA: aria-state.json の読み込みに失敗しました。GUIの状態は変更されていません。`
    );
    return;
  }

  // State-First Reconciliation（ノード座標を保護）
  const reconciledState = reconcileState(result.state, currentState);
  currentState = reconciledState;

  // Webview に更新を通知（Webview 側で setState() を呼ぶ）
  panel.postMessage({ type: 'STATE_UPDATED', payload: reconciledState });
};
```

Webview 側（`App.tsx`）での受信処理（M3-2 の `setState` を使用）:

```typescript
useExtensionMessages((message: ExtensionToWebviewMessage) => {
  switch (message.type) {
    case 'INIT_STATE':
    case 'STATE_UPDATED':
      // setState は _notifyExtension を呼ばないため無限ループにならない
      setState(message.payload);
      break;
    case 'ERROR':
      console.error('ARIA Extension Error:', message.payload.message);
      break;
  }
});
```

---

### M5-4: Inbox 隔離の警告通知

不正なタスクが Inbox に移動された場合、ユーザーに通知する:

```typescript
// Extension Host 内での通知処理
const inboxCount = Object.values(reconciledState.tasks)
  .filter((t) => t.status === 'Inbox')
  .length;

const prevInboxCount = Object.values(currentState.tasks)
  .filter((t) => t.status === 'Inbox')
  .length;

if (inboxCount > prevInboxCount) {
  vscode.window.showWarningMessage(
    `ARIA: ${inboxCount - prevInboxCount}件の新しいタスクが Inbox に移動されました。` +
    ` GUIのカンバンボードで確認してください。`
  );
}
```

---

### M5-7: エッジケース対応チェックリスト

実装時に必ず以下のケースをテストすること:

| ケース | 想定動作 |
|-------|---------|
| `aria-state.json` が空ファイル | エラーログを出力、GUI 変更なし |
| `aria-state.json` が不正 JSON | エラーログを出力、GUI 変更なし |
| `aria-state.json` が BOM 付き UTF-8 | BOM を除去してパース |
| `aria-state.json` が改行 CRLF | 正常にパース（JSON.parse は CRLF を無視） |
| タスクID が `task-xxxxxxxx` 形式でない | Inbox に隔離して新ID採番 |
| タスクの `status` が `"Completed"` など不正な値 | Inbox に変換 |
| ノードが全削除されている | nodes: [] として正常に処理 |
| 同じファイルが 5回連続で変更される | デバウンス（300ms）で1回だけ処理 |
| ARIA の書き込み中に外部変更が来る | `isWriting` フラグで無視 |

---

## 競合シナリオと対処法

### シナリオ1: ARIA書き込みと外部変更が同時発生

```
時刻 0ms: GUI操作 → Debounce開始
時刻 1800ms: ユーザーが aria-state.json を手動編集
時刻 2000ms: ARIA が aria-state.json を書き込む（markWriteStart()）
時刻 2000ms〜2600ms: isWriting=true のため、FileSystemWatcher は無視
時刻 2600ms: isWriting=false（クールダウン終了）
```

**問題**: 時刻 1800ms の手動編集が上書きされる

**対策**: MVP では「最後の書き込みが勝つ（Last Write Wins）」を採用。Phase 2 以降でより高度な競合解消を検討。

### シナリオ2: AIエージェントがタスクを大量追加

AIが `aria-state.json` に20個のタスクを追加した場合、すべてが Inbox に入るわけではない。
**AIが正しい `task-xxxxxxxx` 形式のIDと有効なステータスを付与した場合は、そのまま取り込む。**
IDが不正な場合のみ Inbox に隔離する。

---

## 完了条件（Acceptance Criteria）

1. `.ai-context/aria-state.json` のタスクの `status` を `"Done"` に手動変更すると、2秒以内にカンバンの Done 列に移動する
2. `aria-state.json` に不正な JSON を書き込んでも、GUI がクラッシュせずエラーメッセージが表示される
3. `aria-state.json` に不正な ID フォーマットのタスクを追加すると、Inbox に隔離される
4. ARIA 自身が書き込んだファイルの変更をトリガーに、無限ループが発生しない
5. ノードの position（座標）を `aria-state.json` で変更しても、GUI のノード位置は変わらない（座標は current を維持）
6. 5回連続で `aria-state.json` を手動編集しても、正しく同期される

### 検証手順

```
1. ARIA パネルを開き、タスクを3つ作成する（M4 完了済みが前提）
2. .ai-context/aria-state.json をテキストエディタで開く
3. あるタスクの "status" を "Todo" から "Done" に変更して保存
4. 2秒待つ → カンバンの Done 列に移動していることを確認
5. aria-state.json に存在しないステータス "Completed" を設定して保存
6. カンバンの Inbox 列に追加され、警告が表示されることを確認
7. aria-state.json を { invalid json } に書き換える
8. GUI がクラッシュしないことを確認
```

---

## 参照ファイル

- `ai_shared/specs/M1_extension_host.md` — M1-4（AriaStateWatcher）
- `ai_shared/specs/M3_zustand_store.md` — M3-6（addEmergentTaskFromAI）、M3-2（setState）
- `ai_shared/specs/M4_file_output.md` — M4-8（isWriting フラグ）
- 設計書: `AIとGUIの双方向同期設計：ARIA.docx`
- 設計書: `AI駆動データ連携仕様設計書.docx`

---

*最終更新: 2026-02-23 | バージョン: 1.0.0*
