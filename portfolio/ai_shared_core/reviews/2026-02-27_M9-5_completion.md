# レビュー: M9-5 完了確認（M7除外） — 2026-02-27

**レビュー種別**: 受け入れ検証補完
**対象**: M9-5 Acceptance Criteria
**実施者**: Codex (GPT-5)

---

## 追加実装

- `webview/src/components/canvas/nodes/node-menu-items.ts`（新規）
  - C4/Mindmap のコンテキストメニュー構築ロジックを純粋関数化
- `webview/src/components/canvas/nodes/C4ContainerNode.tsx`
  - 上記ヘルパー経由でメニュー生成（遷移項目の条件分岐を明示化）
- `webview/src/components/canvas/nodes/MindmapNode.tsx`
  - 上記ヘルパー経由でメニュー生成（コンテナ遷移項目が混入しない構造に固定）
- `src/extension/__tests__/aria-state-watcher.test.ts`（新規）
  - self-write cooldown / debounce / create-event の挙動を検証

---

## 追加テスト

- `webview/src/components/canvas/nodes/__tests__/node-menu-items.test.ts`
  - `c4-container` + context のみ遷移項目が出ることを検証
  - mindmap メニューに遷移項目が出ないことを検証
- `src/extension/__tests__/aria-state-watcher.test.ts`
  - `markWriteStart()` 中イベント無視（ループ抑止）を検証

---

## 実行結果

- `npm test -- --pool=threads`: **11 files / 63 tests PASS**
- `npm run build:all`: **PASS**（sandbox制限外実行）

---

## 判定

- `M9-5` を `[x]` に更新
- `task.md` のフェーズサマリーで `M9` を `✅ 完了` に更新

