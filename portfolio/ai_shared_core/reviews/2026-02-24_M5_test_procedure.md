# M5 テスト手順書 — ファイル → GUI 逆同期

**作成日**: 2026-02-24
**対象タスク**: M5-7（逆同期統合テスト）
**ステータス**: `[x]` 完了（全11ケース PASS）
**前提条件**: M0〜M4 完了・ビルド成功（`dist/extension.js 23.8kb`）

---

## 事前準備

### 1. Extension Development Host の起動

```
1. VS Code でこのリポジトリのルート（`./`）を開く
2. F5 キーを押す → Extension Development Host ウィンドウが起動する
3. Extension Development Host 内で任意のフォルダをワークスペースとして開く
   （例: `./sandbox/aria-test-workspace`）
4. コマンドパレット（Ctrl+Shift+P）→「ARIA: Open Panel」を実行する
5. ARIA パネルが開くことを確認する
```

### 2. テスト用初期データの作成

> **注意**: 現在の GUI はタイトル入力欄がなく（`addTask('新しいタスク')` 固定）、
> Todo 列以外へ直接作成する手段もありません。
> 初期データは **aria-state.json を直接編集** して用意します。

```
1. ARIA パネルを開いた状態で、Todo 列の「+ タスクを追加」を 1回クリックする
2. 2秒以上待つ → .ai-context/aria-state.json が自動生成される
3. aria-state.json をテキストエディタで開き、"tasks" 内の ID をメモする（例: task-a1b2c3d4）
4. aria-state.json を以下の内容に手動で書き換える（ID 部分は実際の値で置き換える）:

"tasks": {
  "<ID-A>": {
    "id": "<ID-A>",
    "status": "Todo",
    "title": "テストタスク Alpha",
    "linkedNodeIds": [],
    "createdAt": "2026-02-24T00:00:00.000Z",
    "updatedAt": "2026-02-24T00:00:00.000Z"
  },
  "<ID-B>": {
    "id": "<ID-B>",
    "status": "In Progress",
    "title": "テストタスク Beta",
    "linkedNodeIds": [],
    "createdAt": "2026-02-24T00:00:00.000Z",
    "updatedAt": "2026-02-24T00:00:00.000Z"
  },
  "<ID-C>": {
    "id": "<ID-C>",
    "status": "Done",
    "title": "テストタスク Gamma",
    "linkedNodeIds": [],
    "createdAt": "2026-02-24T00:00:00.000Z",
    "updatedAt": "2026-02-24T00:00:00.000Z"
  }
}

  ※ <ID-B> / <ID-C> は task-xxxxxxxx 形式の新しいIDを crypto.randomUUID() 相当で
    手動採番する（例: task-00000002, task-00000003）

5. ファイルを保存する → 2〜3 秒後にカンバンに 3タスクが表示されることを確認する
   ※ これ自体が TC-1〜TC-3 の前提動作確認を兼ねる
```

---

## テストケース一覧

| # | テストケース | 検証対象 | 合否判定 |
|---|-------------|---------|---------|
| TC-1 | タスクステータスの正常変更 | 基本的な逆同期 | ✅ PASS |
| TC-2 | タイトルの変更 | タイトル反映 | ✅ PASS |
| TC-3 | 新規タスクの追加（正常ID） | タスク追加 | ✅ PASS |
| TC-4 | 不正ステータスの Inbox 隔離 | バリデーション | ✅ PASS |
| TC-5 | 不正 ID フォーマットの Inbox 隔離 | バリデーション | ✅ PASS |
| TC-6 | 空ファイルのエラー処理 | エッジケース | ✅ PASS |
| TC-7 | 不正 JSON のエラー処理 | エッジケース | ✅ PASS |
| TC-8 | BOM 付き UTF-8 の透過処理 | エッジケース | ✅ PASS |
| TC-9 | ノード座標の保護（上書きなし） | Reconciliation | ✅ PASS |
| TC-10 | 自己書き込みループなし | ループ防止 | ✅ PASS |
| TC-11 | 5回連続編集の正常処理 | デバウンス | ✅ PASS |

---

## テストケース詳細

---

### TC-1: タスクステータスの正常変更

**目的**: 最も基本的な逆同期シナリオの確認

**手順**:
```
1. .ai-context/aria-state.json をテキストエディタで開く
2. タスクA（<ID-A>）の "status" を "Todo" から "Done" に変更する
3. ファイルを保存する
4. ARIA パネルを見て 2〜3 秒待つ
```

**期待結果**:
- [ ] カンバンの Done 列にタスクA（「テストタスク Alpha」）が移動している
- [ ] Todo 列からタスクA が消えている
- [ ] VS Code の通知・警告は何も表示されない

---

### TC-2: タスクタイトルの変更

**目的**: タイトルフィールドの逆同期確認

**手順**:
```
1. aria-state.json のタスクB（<ID-B>）の "title" を
   「テストタスク Beta」から「テストタスク Beta【更新済み】」に変更する
2. ファイルを保存する
3. 2〜3 秒待つ
```

**期待結果**:
- [ ] カンバンの In Progress 列にある当該カードのタイトルが「テストタスク Beta【更新済み】」に変わっている
- [ ] ステータスは In Progress のまま変わっていない

---

### TC-3: 新規タスクの追加（正常 ID）

**目的**: AI がタスクを追加するユースケースの確認

**手順**:
```
1. aria-state.json の "tasks" オブジェクトに以下を追加する:
   "task-deadbeef": {
     "id": "task-deadbeef",
     "status": "Todo",
     "title": "AIが追加したタスク",
     "linkedNodeIds": [],
     "createdAt": "2026-02-24T00:00:00.000Z",
     "updatedAt": "2026-02-24T00:00:00.000Z"
   }
2. ファイルを保存する
3. 2〜3 秒待つ
```

**期待結果**:
- [ ] カンバンの Todo 列に「AIが追加したタスク」が表示される
- [ ] 既存タスク（A・B・C）はそのままの列に残っている
- [ ] 警告通知は表示されない

---

### TC-4: 不正ステータスの Inbox 隔離

**目的**: VALID_STATUSES 以外のステータス値を安全に処理する

**手順**:
```
1. aria-state.json のタスクA（<ID-A>）の "status" を "Completed" に変更する
   ※ "Done" ではなく、不正な "Completed" を意図的に設定する
2. ファイルを保存する
3. 2〜3 秒待つ
```

**期待結果**:
- [ ] VS Code の右下に警告通知が表示される
  - 例：「ARIA: 1 件のタスクが不正なIDまたはステータスのため、Inbox に移動されました。」
- [ ] カンバンの Inbox 列にタスクA が移動している
- [ ] GUI はクラッシュしない

**確認コマンド**: Extension Development Host の DevTools（Ctrl+Shift+I）→ Console で以下を確認:
```
ARIA: タスク "<ID-A>" の不正なステータス "Completed" を Inbox に変換します
```

---

### TC-5: 不正 ID フォーマットの Inbox 隔離

**目的**: `task-xxxxxxxx` 形式でない ID を安全に処理する

**手順**:
```
1. aria-state.json の "tasks" オブジェクトに以下を追加する:
   "my-custom-id": {
     "id": "my-custom-id",
     "status": "Todo",
     "title": "不正IDのタスク",
     "linkedNodeIds": [],
     "createdAt": "2026-02-24T00:00:00.000Z",
     "updatedAt": "2026-02-24T00:00:00.000Z"
   }
2. ファイルを保存する
3. 2〜3 秒待つ
```

**期待結果**:
- [ ] VS Code に警告通知が表示される
- [ ] カンバンの Inbox 列に「不正IDのタスク」が表示される
- [ ] 元のキー "my-custom-id" は存在せず、新しい `task-xxxxxxxx` 形式の ID が割り当てられている
- [ ] GUI はクラッシュしない

**DevTools Console で確認**:
```
ARIA: 不正なタスク ID "my-custom-id" を Inbox に隔離します。新 ID: "task-xxxxxxxx"
```

---

### TC-6: 空ファイルのエラー処理

**目的**: ファイルが空の場合に GUI が保護される

**手順**:
```
1. .ai-context/aria-state.json の内容をすべて削除して空にする
2. ファイルを保存する
3. 2〜3 秒待つ
```

**期待結果**:
- [ ] GUI（カンバンボード）の表示がまったく変化しない
- [ ] VS Code にエラーメッセージが表示される（または Webview にエラー通知が届く）
- [ ] GUI はクラッシュしない
- [ ] ARIA パネルは引き続き操作可能である

**DevTools Console で確認**:
```
ARIA: aria-state.json のパースエラー: ファイルが空です
```

---

### TC-7: 不正 JSON のエラー処理

**目的**: 壊れた JSON を書き込んでも GUI が保護される

**手順**:
```
1. aria-state.json の内容を以下に書き換える（意図的に不正にする）:
   { invalid json content here
2. ファイルを保存する
3. 2〜3 秒待つ
```

**期待結果**:
- [ ] GUI の表示がまったく変化しない（TC-6 実施前の状態を維持）
- [ ] VS Code にエラーメッセージが表示される
- [ ] GUI はクラッシュしない

**DevTools Console で確認**:
```
ARIA: aria-state.json のパースエラー: JSON パースエラー: ...
```

**後片付け**: 正常な aria-state.json を元に戻す（ARIA パネルでタスクを操作して 2秒待てば再生成される）

---

### TC-8: BOM 付き UTF-8 の透過処理

**目的**: BOM（バイトオーダーマーク）付きファイルを正常にパースする

**手順** （PowerShell を使用）:
```powershell
# 現在の aria-state.json を読み込む
$content = Get-Content -Path ".ai-context\aria-state.json" -Raw -Encoding UTF8

# BOM 付き UTF-8 で保存する
$utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText(
  (Resolve-Path ".ai-context\aria-state.json"),
  $content,
  $utf8Bom
)
```

**期待結果**:
- [ ] ARIA パネルの GUI が変化しない（正常にパースされ、同じ内容が維持される）
- [ ] エラー通知が表示されない
- [ ] DevTools の Console にエラーが出ない

---

### TC-9: ノード座標の保護（上書きなし）

**目的**: AI がノードの position を変更しても、GUI の座標が上書きされないことを確認

> **注意**: GUI からのノード追加は未実装のため、aria-state.json への直接注入でノードを
> キャンバスに出現させてからテストする。

**手順（前準備：ノードをファイル注入で出現させる）**:
```
1. aria-state.json の "nodes" 配列に以下を追加して保存する:
   {
     "id": "node-test0001",
     "type": "c4-container",
     "position": { "x": 200, "y": 200 },
     "data": { "label": "テストノード" }
   }
2. 2〜3 秒待つ → キャンバスに「テストノード」が (200, 200) 付近に表示されることを確認する
   ※ この時点で currentState に position: {x:200, y:200} が記録される
```

**手順（本テスト：position 上書きを試みる）**:
```
3. aria-state.json の node-test0001 の "position" を { "x": 0, "y": 0 } に変更して保存する
4. 2〜3 秒待つ
```

**期待結果**:
- [ ] キャンバス上の「テストノード」が (0, 0) に移動しない
- [ ] ノードは手順2で表示された位置（200, 200 付近）に留まっている
- [ ] エラー通知は表示されない

**根拠**: `reconcile-state.ts` の `position: currentNode.position` により座標は保護される

---

### TC-10: 自己書き込みループの未発生確認

**目的**: ARIA 自身のファイル書き込みが再検知されて無限ループにならないことを確認

> **注意**: ノード追加機能は不要。Todo 列の「+ タスクを追加」ボタンで実施できる。

**手順**:
```
1. Extension Host のデバッグコンソールを開く
   （開発元 VS Code ウィンドウ → メニュー「ヘルプ」→「開発者ツールの切り替え」→ Console タブ）
2. Console のフィルター欄に "[ARIA] writeAllAiContextFiles" と入力して絞り込む
3. ARIA パネルの Todo 列にある「+ タスクを追加」ボタンをクリックする
4. 5秒間 Console を観察する
```

**正常時のログ（1回だけ出力される）**:
```
[ARIA] writeAllAiContextFiles 開始
[ARIA] writeAllAiContextFiles 完了
```

**ループ発生時のログ（2回以上繰り返される）**:
```
[ARIA] writeAllAiContextFiles 開始
[ARIA] writeAllAiContextFiles 完了
[ARIA] writeAllAiContextFiles 開始   ← これが出たらループ
[ARIA] writeAllAiContextFiles 完了
...
```

**期待結果**:
- [ ] `writeAllAiContextFiles 開始` が 1回だけ出力される
- [ ] aria-state.json の `lastModified` タイムスタンプが 1回だけ更新される
- [ ] GUI は安定して動作する

**根拠**: `AriaStateWatcher.markWriteStart()` + 600ms クールダウンにより防止される

---

### TC-11: 5回連続編集の正常処理（デバウンス確認）

**目的**: 短時間の連続変更が 1回だけ処理されることを確認

**手順**:
```
1. aria-state.json をエディタで開く
2. タスクA の "status" を以下の順序で素早く変更・保存する（各操作を 1秒以内で行う）:
   1回目: "Todo" → "Done"
   2回目: "Done" → "In Progress"
   3回目: "In Progress" → "Todo"
   4回目: "Todo" → "Done"
   5回目: "Done" → "In Progress"
3. 最後の保存から 2〜3 秒待つ
```

**期待結果**:
- [ ] カンバンが最終状態（"In Progress"）に更新される
- [ ] GUI が中間状態でチラつかない（デバウンス 300ms により最終変更のみ処理される）
- [ ] エラーや警告が表示されない

---

## テスト実施チェックリスト

テスト完了時に合否を記録する:

```
[x] TC-1  タスクステータスの正常変更     → PASS
[x] TC-2  タスクタイトルの変更           → PASS
[x] TC-3  新規タスクの追加（正常ID）      → PASS
[x] TC-4  不正ステータスの Inbox 隔離    → PASS
[x] TC-5  不正 ID の Inbox 隔離          → PASS
[x] TC-6  空ファイルのエラー処理          → PASS
[x] TC-7  不正 JSON のエラー処理          → PASS
[x] TC-8  BOM 付き UTF-8 の透過処理      → PASS
[x] TC-9  ノード座標の保護               → PASS
[x] TC-10 自己書き込みループなし          → PASS
[x] TC-11 5回連続編集の正常処理           → PASS
```

---

## M5 完了条件（Acceptance Criteria）との対応

| 完了条件 | 対応テストケース |
|---------|---------------|
| status 変更が 2秒以内に GUI に反映される | TC-1 |
| 不正 JSON でも GUI がクラッシュしない | TC-7 |
| 不正 ID のタスクが Inbox に隔離される | TC-5 |
| 自己書き込みループが発生しない | TC-10 |
| ノード position の書き換えが無視される | TC-9 |
| 5回連続編集でも正しく同期される | TC-11 |

---

## トラブルシューティング

### 問題: aria-state.json を保存しても GUI が変化しない

**確認事項**:
1. Extension Development Host が起動中か
2. ワークスペースが開かれているか（requireWorkspace が null を返していないか）
3. `.ai-context/` ディレクトリが存在するか
4. DevTools Console に `[ARIA] AriaStateWatcher 起動完了` が出ているか

### 問題: 2秒以上待っても反映されない

**確認事項**:
1. `AriaStateWatcher` の DEBOUNCE_MS = 300ms のため、保存後 300ms 以上かかる場合はバグの可能性
2. DevTools Console に `handleExternalChange` 由来のログが出ているか確認する

### 問題: TC-10 でループが発生した

**対処**:
1. `aria-state-watcher.ts` の `markWriteStart()` が `writeAllAiContextFiles` 呼び出し前に実行されているか確認する（`extension.ts` の `scheduleWrite` 内 `watcher?.markWriteStart()` 参照）
2. WRITE_COOLDOWN_MS = 600ms の設定値を確認する

---

*作成者: Claude | 対象ビルド: dist/extension.js 23.8kb | 最終更新: 2026-02-24（全11ケース PASS — M5-7 完了）*
