# M5-7 逆同期統合テスト手順書

> **前提**: Extension Development Host（F5デバッグ）が起動できる状態であること。
> M4 までの実装（GUI → ファイル出力）が動作確認済みであること。

---

## テスト環境の準備

### Step 0: デバッグ起動

```
1. VS Code で Brain Connector ARIA フォルダを開く
2. F5 キー → Extension Development Host ウィンドウが起動する
3. Extension Development Host で「ファイル → フォルダを開く」で
   テスト用ワークスペース（任意のフォルダ）を開く
4. Ctrl+Shift+P → "Brain Connector ARIA: Open Panel" → ARIA パネルが表示される
5. Extension Host のデバッグコンソール（元のウィンドウ）を表示しておく
```

> **ポイント**: テスト中はデバッグコンソール（出力タブ）を常に表示して
> `ARIA:` プレフィックスのログを監視すること。

---

## テストケース一覧

| # | テスト名 | 完了条件 | 対応AC |
|---|---------|---------|--------|
| TC-1 | 正常逆同期（status変更） | カンバン更新 ≤2秒 | AC-1 |
| TC-2 | 不正JSON耐性 | GUIクラッシュしない | AC-2 |
| TC-3 | 不正IDタスクのInbox隔離 | Inbox列に移動 + 警告表示 | AC-3 |
| TC-4 | 自己書き込みループ非発生 | ログに無限ループなし | AC-4 |
| TC-5 | ノード座標保護 | GUI位置が変化しない | AC-5 |
| TC-6 | 5回連続編集での同期 | 最終状態が正しく反映 | AC-6 |
| TC-7 | 不正ステータスのInbox変換 | "Completed"→Inbox移動 | AC-3補足 |
| TC-8 | 空ファイル耐性 | GUIクラッシュしない | AC-2補足 |
| TC-9 | BOM付きUTF-8耐性 | 正常にパースされる | エッジケース |

---

## TC-1: 正常逆同期（ステータス変更）【最重要】

### 目的
`aria-state.json` のタスク `status` を手動変更したとき、2秒以内にカンバンが更新されることを確認する。

### 手順

**準備:**
```
1. ARIA パネルのカンバン「Todo」列の「+ タスクを追加」を3回クリック
   → 「新しいタスク」が3件 Todo 列に追加される
2. タスクが追加されてから約2秒待つ
   → ワークスペースの .ai-context/aria-state.json が自動生成される
3. .ai-context/aria-state.json をテキストエディタで開く（VS Code内で可）
```

**aria-state.json の該当箇所（例）:**
```json
"tasks": {
  "task-a1b2c3d4": {
    "id": "task-a1b2c3d4",
    "status": "Todo",
    "title": "新しいタスク",
    ...
  }
}
```

**実施:**
```
4. 上記の "status": "Todo" を "status": "Done" に書き換えて保存（Ctrl+S）
5. ARIA パネルのカンバンボードを観察する
```

**期待結果:**
- [ ] 保存から **2秒以内**に当該タスクが「✅ Done」列に移動する
- [ ] デバッグコンソールにエラーログが出ない
- [ ] 他の2件のタスクはそのまま「Todo」列にある

**失敗時の確認箇所:**
- `aria-state-watcher.ts` の `DEBOUNCE_MS`（300ms）が正しいか
- `extension.ts` の `handleExternalChange` が呼ばれているか（`console.error` が出ていないか）

---

## TC-2: 不正JSON耐性

### 目的
`aria-state.json` を壊してもGUIがクラッシュしないことを確認する。

### 手順

**準備:** TC-1 の準備を完了した状態（タスクが3件ある状態）

**実施:**
```
1. .ai-context/aria-state.json を開く
2. ファイルの内容全体を以下に書き換えて保存する:

{ invalid json here

3. ARIA パネルを観察する
```

**期待結果:**
- [ ] GUIがクラッシュしない（パネルが白くなったり消えたりしない）
- [ ] カンバンに既存の3件のタスクが表示されたまま（状態が変化しない）
- [ ] デバッグコンソールに以下のログが出る:
  ```
  ARIA: aria-state.json のパースエラー: JSON パースエラー: ...
  ```
- [ ] VSCode通知エリアに `aria-state.json の読み込みに失敗しました` メッセージが表示される

**後始末:**
```
4. aria-state.json を正しいJSONに戻す（Ctrl+Z で元に戻すか、TC-1完了後の内容を貼り直す）
```

---

## TC-3: 不正IDタスクのInbox隔離

### 目的
`task-[a-f0-9]{8}` 形式でないIDのタスクが自動的にInboxへ隔離されることを確認する。

### 手順

**準備:** .ai-context/aria-state.json が正常な状態であること

**実施:**
```
1. .ai-context/aria-state.json の "tasks" オブジェクトに
   以下の不正IDタスクを追加して保存する:

"tasks": {
  "task-a1b2c3d4": { ... 既存タスク ... },
  "invalid-id-format": {
    "id": "invalid-id-format",
    "status": "Todo",
    "title": "不正IDテストタスク",
    "linkedNodeIds": [],
    "createdAt": "2026-02-23T00:00:00.000Z",
    "updatedAt": "2026-02-23T00:00:00.000Z"
  }
}

2. 保存後、ARIA パネルのカンバンボードを観察する
```

**期待結果:**
- [ ] カンバンの「📥 Inbox」列に「不正IDテストタスク」が表示される
  （「Todo」列ではなく「Inbox」列に追加される）
- [ ] VSCode通知エリアに以下の警告が表示される:
  ```
  ARIA: 1 件のタスクが不正なIDまたはステータスのため、Inbox に移動されました。
  カンバンボードで確認してください。
  ```
- [ ] デバッグコンソールに以下のログが出る:
  ```
  ARIA: 不正なタスク ID "invalid-id-format" を Inbox に隔離します。新 ID: "task-xxxxxxxx"
  ```
- [ ] `aria-state.json` 内の元の `"invalid-id-format"` キーは、次のGUI操作時（2秒デバウンス後）に正しい `task-xxxxxxxx` 形式に書き直される

---

## TC-4: 自己書き込みループ非発生

### 目的
ARIA が `aria-state.json` を書き込んだとき、それをトリガーに再度処理が走らない（無限ループしない）ことを確認する。

### 手順

**実施:**
```
1. デバッグコンソールをクリアする（コンソール内で右クリック → 「コンソールをクリア」）
2. ARIA パネルのカンバンで「+ タスクを追加」をクリック
3. 15秒間、デバッグコンソールを観察する
```

**期待結果:**
- [ ] `handleExternalChange` が **1回だけ** 呼ばれる
  （もし無限ループなら `ARIA:` ログが連続して流れ続ける）
- [ ] 15秒後もコンソールに新しい `ARIA:` ログが追加されていない
- [ ] CPU使用率が高止まりしていない

**ループ発生時のシグネチャ（失敗パターン）:**
```
ARIA: aria-state.json のパースエラー: ...  ← 連続して出続ける
```
または
```
STATE_UPDATED 送信 ← 連続して出続ける（STATE_UPDATEDのデバッグログを追加した場合）
```

**仕組みの確認:**
`AriaStateWatcher.markWriteStart()` が呼ばれると `_isWriting = true` になり、
600ms の間 FileSystemWatcher のイベントを無視する。これがループを防いでいる。

---

## TC-5: ノード座標保護

### 目的
`aria-state.json` でノードの `position` を変更しても、GUIのノード位置が変わらないことを確認する。

### 手順

**準備:**
```
1. ARIA パネルのキャンバス上で右クリック（またはツールバー）から
   ノードを1つ追加する
   ※ ノード追加 UI がない場合はデバッグコンソールから直接Zustandを操作、
     または後述の json 直接編集で追加する
2. ノードをキャンバス上で任意の位置にドラッグ移動する
3. 2秒待つ → aria-state.json に現在の座標が書き込まれる
4. aria-state.json を開き、ノードの現在の position を記録する:
```

**記録する値（例）:**
```json
"nodes": [
  {
    "id": "node-a1b2c3d4",
    "position": { "x": 250, "y": 180 },  ← この値を記録
    ...
  }
]
```

**実施:**
```
5. aria-state.json の position を全く別の値に変更して保存する:

"position": { "x": 9999, "y": 9999 }

6. ARIA パネルのキャンバスを観察する
```

**期待結果:**
- [ ] キャンバス上のノードが `x:9999, y:9999` の位置に**移動しない**
- [ ] ノードは元の位置（ドラッグした位置）を維持する
- [ ] デバッグコンソールにエラーなし

**仕組みの確認:**
`reconcileState()` 内で `position: currentNode.position` により、
incoming（9999, 9999）を無視して current（元の座標）を使用している。

---

## TC-6: 5回連続編集での同期

### 目的
短時間に5回連続して `aria-state.json` を編集しても、最終状態が正しく反映されることを確認する。

### 手順

**準備:** タスクが3件ある状態（TC-1完了後の状態）

**実施:**
```
1回目: aria-state.json でタスク1の status を "Todo" → "In Progress" に変更 → 保存
（0.5秒以内に）
2回目: aria-state.json でタスク1の status を "In Progress" → "Done" に変更 → 保存
（0.5秒以内に）
3回目: aria-state.json でタスク2の title を "新しいタスク" → "更新タスクB" に変更 → 保存
（0.5秒以内に）
4回目: aria-state.json でタスク3の status を "Todo" → "In Progress" に変更 → 保存
（0.5秒以内に）
5回目: aria-state.json でタスク1の status を "Done" → "Inbox" に変更 → 保存

最後に 2秒待つ
```

**期待結果:**
- [ ] タスク1が「📥 Inbox」列に表示される
- [ ] タスク2のタイトルが「更新タスクB」になっている
- [ ] タスク3が「🔵 In Progress」列に表示される
- [ ] デバッグコンソールに異常なエラーがない

**仕組みの確認:**
`AriaStateWatcher` の `DEBOUNCE_MS = 300ms` が連続変更をまとめ、
5回分の変更が最後の保存から300ms後に1回だけ処理される。

---

## TC-7: 不正ステータスのInbox変換

### 目的
有効な4つの状態（Todo / In Progress / Done / Inbox）以外の値が自動的にInboxに変換されることを確認する。

### 手順

**実施:**
```
1. aria-state.json で既存タスクの status を "Completed" に変更して保存する:

"status": "Completed"

2. ARIA パネルのカンバンボードを観察する
```

**期待結果:**
- [ ] 当該タスクが「📥 Inbox」列に表示される（「Completed」列は存在しない）
- [ ] VSCode通知エリアに警告が表示される（「1 件のタスクが...Inbox に移動されました」）
- [ ] デバッグコンソールに:
  ```
  ARIA: タスク "task-xxxxxxxx" の不正なステータス "Completed" を Inbox に変換します
  ```

**他に試せる不正ステータス値:**
- `"done"` （小文字）
- `"IN_PROGRESS"` （アンダースコア区切り）
- `""` （空文字列）
- `null`
- `123` （数値）

---

## TC-8: 空ファイル耐性

### 目的
`aria-state.json` が空になってもGUIがクラッシュしないことを確認する。

### 手順

**実施:**
```
1. .ai-context/aria-state.json を開き、内容を全て削除して空ファイルにして保存する
2. ARIA パネルを観察する
```

**期待結果:**
- [ ] GUIがクラッシュしない（既存の状態を維持する）
- [ ] デバッグコンソールに:
  ```
  ARIA: aria-state.json のパースエラー: ファイルが空です
  ```
- [ ] VSCode通知エリアに `aria-state.json の読み込みに失敗しました: ファイルが空です` が表示される

**後始末:**
```
3. aria-state.json を正しいJSONに戻す
```

---

## TC-9: BOM付きUTF-8耐性

### 目的
BOM（Byte Order Mark）付きで保存された `aria-state.json` が正常にパースされることを確認する。

### 手順

**実施（PowerShellで BOM付きファイルを生成する）:**
```powershell
# PowerShell で BOM 付き UTF-8 ファイルを生成する
$json = Get-Content ".ai-context\aria-state.json" -Raw
[System.IO.File]::WriteAllText(
  (Resolve-Path ".ai-context\aria-state.json"),
  $json,
  [System.Text.Encoding]::UTF8  # VS Code デフォルトは BOM なし
)
```

> VS Code の「ファイル → 名前を付けて保存」→「文字コード付きで保存」→「UTF-8 with BOM」でも可能。

**実施:**
```
1. BOM付きで aria-state.json を保存した後、任意のタスクの status を変更して保存
2. ARIA パネルのカンバンボードを観察する
```

**期待結果:**
- [ ] BOM付きでも正常にパースされ、カンバンが更新される
- [ ] デバッグコンソールにエラーが出ない

---

## テスト結果記録シート

```
実施日時: 2026-02-23 ___:___
実施者: ___

| テスト | 結果 | 備考 |
|--------|------|------|
| TC-1 正常逆同期（status変更） | [ ] PASS / [ ] FAIL | |
| TC-2 不正JSON耐性 | [ ] PASS / [ ] FAIL | |
| TC-3 不正IDタスクのInbox隔離 | [ ] PASS / [ ] FAIL | |
| TC-4 自己書き込みループ非発生 | [ ] PASS / [ ] FAIL | |
| TC-5 ノード座標保護 | [ ] PASS / [ ] FAIL | |
| TC-6 5回連続編集での同期 | [ ] PASS / [ ] FAIL | |
| TC-7 不正ステータスのInbox変換 | [ ] PASS / [ ] FAIL | |
| TC-8 空ファイル耐性 | [ ] PASS / [ ] FAIL | |
| TC-9 BOM付きUTF-8耐性 | [ ] PASS / [ ] FAIL | |

Acceptance Criteria 確認:
[ ] AC-1: status 変更 → 2秒以内にカンバン更新
[ ] AC-2: 不正JSON → GUIクラッシュしない
[ ] AC-3: 不正IDタスク → Inbox隔離
[ ] AC-4: 自己書き込みループ非発生
[ ] AC-5: position 変更 → GUI位置は変わらない
[ ] AC-6: 5回連続編集でも正しく同期

全AC通過: [ ] YES → M5-7 完了（task.md を [x] に更新すること）
         [ ] NO  → 失敗したTCの内容を task.md に [!] でエスカレーション報告
```

---

## よくあるトラブルと対処法

### パネルが表示されない
- F5 で再度デバッグ起動する
- `npm run build:extension` でビルドが成功しているか確認する

### aria-state.json が生成されない
- ARIA パネルでタスクを追加してから2秒待つ
- `.ai-context/` フォルダが存在するか確認する
- デバッグコンソールで `ARIA: ファイル書き込みに失敗しました` エラーがないか確認する

### カンバンが更新されない
- `watcher?.start()` が呼ばれているか確認（Extension Development Host を再起動）
- `.ai-context/aria-state.json` のパスが正しいか確認（ワークスペースルート直下の `.ai-context/`）
- デバッグコンソールで `ARIA:` プレフィックスのエラーを確認する

### 無限ループが発生した場合
- Extension Development Host を閉じる（Shift+F5）
- `AriaStateWatcher.markWriteStart()` が `file-writer.ts` の呼び出し前に実行されているか確認する

---

*作成日: 2026-02-23 | M5-7 テスト手順書 v1.0*
