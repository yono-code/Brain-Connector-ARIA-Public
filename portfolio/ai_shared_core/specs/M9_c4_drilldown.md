# M9: C4 ドリルダウン — スペックキット

**前提条件**: M0〜M8 完了
**推定工数**: 大（データ構造変更あり）
**プランファイル**: `ai_shared/plans/M9_M12_feature_expansion_plan.md`

---

## ゴール

コンテキストレイヤーのノードを右クリックしてコンテナレイヤーへ遷移し、戻るボタンで復帰できる。
コンテナレイヤーで追加したノードは `aria-state.json` に永続化される。

---

## 背景と設計方針

現在、ARIA は C4 の **Context レベルのみ**を実装している（`CLAUDE.md` の「確定済み設計事項」より）。
M9 では Container レベルを追加し、ドリルダウン操作を可能にする。

**キー設計決定**:
- ナビゲーション状態（`currentLayer`, `activeContainerId`）は **Zustand Store のみに保持**、`aria-state.json` には永続化しない
- VS Code 再起動時は常にコンテキストレイヤーから開始する（ユーザー確認済み）
- コンテナキャンバスデータ（`containerCanvases`）は `aria-state.json` に永続化する
- React Flow の状態更新ロジック（`onNodesChange` / `onEdgesChange` / `onConnect` など）は **Store 主導**とし、`AriaCanvas.tsx` は「どのサーフェスに対する操作か」を決めて Store API を呼ぶ薄いルーティング層とする
- 将来のダイアグラム拡張（C4下位レイヤー、依存グラフ、ER図 等）を見据え、M9 から **Surface 抽象**（描画/編集対象の識別子）を導入する
- コンポーネントレイヤー・コードレイヤーは **スコープ外**（将来フェーズ）

### 実装固定ルール（古い世代エージェント向けに選択肢を減らす）

この M9 実装では、以下を **固定** とする（迷ったらこのルールを優先）:

1. `AriaCanvas.tsx` は「surface を解決して Store API を呼ぶだけ」にする
2. React Flow の配列更新ロジック（`applyNodeChanges` / `applyEdgeChanges` / `addEdge`）は Store 側に置く
3. `currentLayer` / `activeContainerId` / `breadcrumb` は `aria-state.json` に保存しない
4. `containerCanvases` は `AriaState` に保存する
5. M9 では **C4 タブの context/container を優先**して surface-aware API を適用する
6. Mindmap タブは M9 で全面リファクタしない（必要最小限の影響に留める）
7. 既存の postMessage 型名・メッセージ種別（`INIT_STATE`, `STATE_UPDATED`, `STATE_CHANGED`）は変更しない

---

## M9-1: データモデル拡張

### 変更ファイル: `src/shared/types.ts`

```typescript
// 新規追加
interface ContainerCanvas {
  nodeId: string;   // 親となるコンテキストレイヤーの nodeId
  nodes: AriaNode[];
  edges: AriaEdge[];
}

// 既存 AriaState に追加
interface AriaState {
  // --- 既存フィールド（変更なし）---
  nodes: AriaNode[];
  edges: AriaEdge[];
  tasks: Record<string, KanbanTask>;
  adrs: Record<string, ADR>;
  version: string;
  lastModified: string;

  // --- 新規追加 ---
  containerCanvases: Record<string, ContainerCanvas>;
  // キー: コンテキストレイヤーの nodeId
}
```

**注意**: `AriaNode.type` の型定義は変更しない。コンテナレイヤー内ノードも既存の `'c4-container' | 'c4-component' | 'mindmap'` を流用する。

---

## M9-2: Zustand Store 拡張

### 変更ファイル: `webview/src/store/aria-store.ts`

### 責務分離（この方針を M9 で確定）

- `webview/src/components/canvas/AriaCanvas.tsx`
  - `canvasType` + `currentLayer` から「現在の編集対象サーフェス」を解決する
  - React Flow イベントを Store の surface-aware API に中継する
  - **状態配列の直接更新ロジックは持たない**
- `webview/src/store/aria-store.ts`
  - サーフェスごとの `nodes` / `edges` の読み書きロジックを保持する
  - `_notifyExtension()` 呼び出しを含む永続化連携の責務を持つ
  - 将来ダイアグラム追加時の拡張ポイントになる

### Surface 抽象（将来拡張前提）

```typescript
// M9 で導入する「編集対象キャンバス」の識別子
// M9 実装で必須なのは c4-context / c4-container のみ。
// mindmap-root は将来統一用の予約枠（この時点で導入してもよい）。
type DiagramSurfaceRef =
  | { kind: 'c4-context' }
  | { kind: 'c4-container'; containerId: string }
  | { kind: 'mindmap-root' }; // M9では主に予約（既存挙動維持）
```

**設計意図**:
- `currentLayer`（UIナビ状態）と `DiagramSurfaceRef`（編集対象）を分離することで、将来 `component/code` レイヤーや別ダイアグラムを追加しても `AriaCanvas` の分岐を最小化する。
- `DiagramSurfaceRef` 自体はセッション内の操作コンテキストであり、`aria-state.json` に永続化しない。

**ナビゲーション状態**（Storeのみ、aria-state.jsonには保存しない）:

```typescript
// Store の型定義拡張
interface AriaStoreState extends AriaState {
  // ナビゲーション（セッション状態）
  currentLayer: 'context' | 'container';
  activeContainerId: string | null;
  breadcrumb: Array<{ id: string; label: string }>;

  // ... 既存アクション
}
```

**追加アクション**:

```typescript
// コンテナレイヤーへ遷移
enterContainerLayer: (nodeId: string) => void;
// → currentLayer = 'container'
// → activeContainerId = nodeId
// → breadcrumb に push

// コンテキストレイヤーへ復帰
exitContainerLayer: () => void;
// → currentLayer = 'context'
// → activeContainerId = null
// → breadcrumb をクリア

// コンテナ内ノード追加
addContainerNode: (parentContainerId: string, type: AriaNode['type'], position: {x: number; y: number}, label: string) => void;
// → containerCanvases[parentContainerId].nodes に push
// → containerCanvases が未存在なら初期化してから追加

// コンテナ内ノード削除（子孫連鎖削除）
deleteContainerNode: (parentContainerId: string, nodeId: string) => void;
// → 対象ノードと、そのノードを source/target とするエッジも削除
```

### 追加アクション（Surface-aware API: 推奨・将来拡張用）

```typescript
// サーフェスの読み取り（selector/helper）
getSurfaceNodes: (surface: DiagramSurfaceRef) => AriaNode[];
getSurfaceEdges: (surface: DiagramSurfaceRef) => AriaEdge[];

// React Flow 標準イベントの保存先をサーフェスで切り替える（M9で必須）
applyNodeChangesToSurface: (surface: DiagramSurfaceRef, changes: NodeChange[]) => void;
applyEdgeChangesToSurface: (surface: DiagramSurfaceRef, changes: EdgeChange[]) => void;
connectOnSurface: (surface: DiagramSurfaceRef, connection: Connection) => void;

// CRUD の統一口（M9時点では任意。将来統一のため推奨）
addNodeToSurface: (
  surface: DiagramSurfaceRef,
  type: AriaNode['type'],
  position: { x: number; y: number },
  label: string,
  options?: { parentId?: string }
) => AriaNode;
deleteNodeFromSurface: (surface: DiagramSurfaceRef, nodeId: string) => void;
```

**M9 での段階導入方針（スコープ管理）**:
- **必須**: `applyNodeChangesToSurface` / `applyEdgeChangesToSurface` / `connectOnSurface`
  - これがないとコンテナレイヤーでの移動・接続が永続化されない
- **推奨**: `getSurfaceNodes` / `getSurfaceEdges`
  - `AriaCanvas` から `containerCanvases[...]` 直接参照を減らし、将来のデータ構造変更に強くする
- **任意（M9内で余力があれば）**: `addNodeToSurface` / `deleteNodeFromSurface`
  - 既存 `addNode` / `deleteNode` / `addContainerNode` / `deleteContainerNode` を残しつつ、内部実装を surface-aware API に寄せる

**推奨実装順（Store内）**:
1. `containerCanvases` の read/write helper を private 関数で用意
2. `apply*ToSurface` / `connectOnSurface` を実装
3. `AriaCanvas.tsx` を surface-aware API 呼び出しに切替
4. 余力があれば CRUD の統一口（`addNodeToSurface` 等）へ寄せる

**重要**: `setState()` で `containerCanvases` を更新した際も、既存の `_notifyExtension()` サブスクライバーが発火して Extension Host への通知が走ること（既存メカニズムをそのまま流用）。

**実装補足（現行コード基準）**:
- `webview/src/store/aria-store.ts` の `_notifyExtension()` は現在 `nodes / edges / tasks / adrs / version / lastModified` のみを payload に積んでいる。`containerCanvases` を明示的に追加しないと GUI → Extension Host 同期で欠落する。
- `setState(newState)` で受け取る `AriaState` は、後方互換性のため `containerCanvases ?? {}` に正規化してから Store に取り込む実装にする（起動時 `loadAriaState()` 経由の古いデータ対策）。

---

## M9-3: UI コンポーネント実装

### M9-3-1: BreadcrumbNav.tsx（新規作成）

**配置**: `webview/src/components/canvas/BreadcrumbNav.tsx`

```tsx
// 表示仕様
// コンテキストレイヤー時: 非表示
// コンテナレイヤー時: 「🏗 コンテキスト  ›  [コンテナ名]」
//
// スタイル: キャンバス左上に絶対配置（React Flow の z-index より上）
// クリック不要（表示のみ、戻るボタンと分離）
```

### M9-3-2 + M9-3-3: AriaCanvas.tsx 更新

**配置**: `webview/src/components/canvas/AriaCanvas.tsx`

```tsx
// C4 タブでの編集対象サーフェスを解決（UIは薄いルーティングのみ）
const c4Surface: DiagramSurfaceRef =
  currentLayer === 'context'
    ? { kind: 'c4-context' }
    : { kind: 'c4-container', containerId: activeContainerId! };

const surface: DiagramSurfaceRef =
  canvasType === 'c4'
    ? c4Surface
    : { kind: 'mindmap-root' }; // M9では既存挙動維持のため予約利用でも可

// currentLayer に応じて表示を切替
const displayNodes = getSurfaceNodes(surface);
const displayEdges = getSurfaceEdges(surface);

// React Flow 標準イベントも surface-aware API へ中継
const handleNodesChange = (changes: NodeChange[]) =>
  applyNodeChangesToSurface(surface, changes);
const handleEdgesChange = (changes: EdgeChange[]) =>
  applyEdgeChangesToSurface(surface, changes);
const handleConnect = (connection: Connection) =>
  connectOnSurface(surface, connection);

// 戻るボタン（containerレイヤー時のみ表示）
{currentLayer === 'container' && (
  <Panel position="top-left">
    <button onClick={exitContainerLayer}>← 戻る</button>
  </Panel>
)}

// BreadcrumbNav を常時レンダリング（内部で currentLayer を見て表示/非表示切替）
<BreadcrumbNav />
```

**重要な実装補足（現行 `AriaCanvas.tsx` との差分）**:
- 現在の `AriaCanvas` は `canvasType`（`'c4' | 'mindmap'`）で表示を分けている。`currentLayer` の切替は **C4 タブ時のみ**適用し、Mindmap タブは従来通り `canvasType === 'mindmap'` の表示を維持する。
- 現在の `onNodesChange / onEdgesChange / onConnect` はコンテキストレイヤー（`state.nodes / state.edges`）専用。M9 では **Store 側の surface-aware API** を追加し、`AriaCanvas` はその呼び出しに切り替える。
- 上記を入れない場合、コンテナレイヤーでのノード移動・エッジ接続が UI 上は見えても永続化されない。
- `AriaCanvas.tsx` に `applyNodeChanges` / `addEdge` の実ロジックを持ち込まない（Store に集約する）。

**ノード追加時の挙動変更**:
- M9 最小実装:
  - コンテキストレイヤー時: 既存の `addNode()` を呼ぶ
  - コンテナレイヤー時: `addContainerNode(activeContainerId, ...)` を呼ぶ
- 将来拡張を見据えた推奨形:
  - `addNodeToSurface(surface, ...)` を経由して追加する（`addNode` / `addContainerNode` は内部ラッパー化）

### M9-3-4: C4ContainerNode.tsx（右クリック項目追加）

`c4-container` タイプのノードのみ、以下のメニュー項目を追加:

```
📦 コンテナレイヤーへ遷移
```

クリック時: `enterContainerLayer(nodeId)` を呼び出す。

**実装補足**:
- 現行実装ではコンテキストメニュー項目の配列は `webview/src/components/canvas/nodes/C4ContainerNode.tsx` で組み立てている。
- `webview/src/components/context-menu/ContextMenu.tsx` は汎用描画/UI の責務であり、M9 では原則変更不要（M11 のサブメニュー対応時のみ拡張の可能性あり）。

---

## M9-4: Extension Host 対応

**実装補足（見落としやすい必須変更）**:
- `src/extension/persistence.ts`
  - `DEFAULT_ARIA_STATE` に `containerCanvases: {}` を追加
  - `loadAriaState()` で `containerCanvases` 欠如時に `{}` を補完（起動時ロード経路の後方互換）
- `src/extension/file-writer.ts`
  - `architecture-generator.ts` が `containerCanvases` を参照する場合、呼び出し引数を拡張する（`generateArchitectureMermaid(state)` など）

### M9-4-1: parse-aria-state.ts 更新

`containerCanvases` フィールドのパースを追加:

```typescript
// パース時の処理
const containerCanvases = raw.containerCanvases ?? {};

// バリデーション
// - 各 ContainerCanvas の nodes/edges の型チェック
// - 不正なノードは除外（Inbox隔離ではなく単純除外）
// - containerCanvases が存在しない場合は {} で初期化（後方互換性）
```

### M9-4-2: reconcile-state.ts 更新

```typescript
// containerCanvases のマージ方針
// - existing の containerCanvases を基準
// - incoming の containerCanvases で上書き（シンプルに）
// - 理由: ノード座標保護が必要なのはコンテキストレイヤーのみ（既実装）
//         コンテナレイヤーは incoming を優先で問題なし
```

### M9-4-3: architecture-generator.ts 更新

```typescript
// containerCanvases が存在する場合、C4Container セクションを追加出力

// 出力例:
// C4Context
//   title ARIA Project — Context Level
//   Container(node1, "システムA", ...)
//
// C4Container
//   title システムA — Container Level (node1)
//   Container(inner1, "APIサーバー", "[Node.js]", "")
//   Container(inner2, "DB", "[PostgreSQL]", "")
```

**実装補足**:
- 現行の `generateArchitectureMermaid()` は `nodes, edges` のみを引数に取る。`containerCanvases` 出力を追加する場合はシグネチャ変更に伴い `src/extension/file-writer.ts` の呼び出し更新が必要。

---

## M9-4.5: 実装レシピ（旧世代エージェント向け）

この節は「どう書くか」を具体化する。M9 の実装時は **上から順に**進めること。

### Step 0: 先にやること（安全策）

1. `webview/src/store/aria-store.ts` の既存アクション名は削除・改名しない（互換維持）
2. 既存の `AriaCanvas.tsx` を一気に書き換えず、Store API を先に追加してから UI を切替える
3. `src/shared/types.ts` を最初に更新して、型エラーで必要変更箇所を炙り出す

### Step 1: `src/shared/types.ts`（型を先に確定）

**必須変更**
- `ContainerCanvas` 型を追加
- `AriaState` に `containerCanvases: Record<string, ContainerCanvas>` を追加

**実装ルール**
- `AriaNode.type` は変更しない
- `containerCanvases` の key は「コンテキストレイヤーの c4-container ノード ID」
- コンテナ内ノードの ID 形式も既存 `node-xxxxxxxx` のまま

**確認ポイント**
- `AriaState` を使っている全ファイルで型エラーが発生し、追従が必要な箇所が見えること（正常）

### Step 2: `src/extension/persistence.ts`（起動時ロードの後方互換）

**必須変更**
- `DEFAULT_ARIA_STATE` に `containerCanvases: {}` を追加
- `loadAriaState()` の戻り値で `containerCanvases` 欠如時に `{}` を補完

**固定実装（推奨）**
```typescript
return {
  ...parsed,
  containerCanvases:
    parsed.containerCanvases && typeof parsed.containerCanvases === 'object'
      ? parsed.containerCanvases
      : {},
};
```

**やってはいけないこと**
- `currentLayer` などの UI 状態をここで保存/復元しない

### Step 3: `webview/src/store/aria-store.ts`（M9 の中心）

#### 3-1. 型定義の追記

**追加 import（必要になるもの）**
- `NodeChange`, `EdgeChange`, `Connection`（既存 import を流用可）
- `ContainerCanvas`（`src/shared/types.ts` から）

**追加 state**
- `currentLayer`
- `activeContainerId`
- `breadcrumb`

**初期値（固定）**
```typescript
currentLayer: 'context',
activeContainerId: null,
breadcrumb: [],
```

#### 3-2. private helper を先に作る（重要）

古い世代のエージェント向けに、まず helper を作ってから action を書く。

**推奨 helper（ファイル内 private 関数）**
```typescript
function ensureContainerCanvas(
  state: AriaStoreState,
  containerId: string
): ContainerCanvas

function mapContainerCanvas(
  state: AriaStoreState,
  containerId: string,
  updater: (canvas: ContainerCanvas) => ContainerCanvas
): Pick<AriaStoreState, 'containerCanvases'>
```

**helper の責務**
- `ensureContainerCanvas`: 未作成なら `{ nodeId, nodes: [], edges: [] }` を仮想的に返す
- `mapContainerCanvas`: 更新後の `containerCanvases` を immutable に返す

**禁止**
- `state.containerCanvases[containerId].nodes.push(...)` のような破壊的更新

#### 3-3. Navigation アクションを実装

**`enterContainerLayer(nodeId)`**
- `currentLayer = 'container'`
- `activeContainerId = nodeId`
- `breadcrumb = [{ id: nodeId, label: 対象ノード名 }]`
- ノード名は `state.nodes.find(n => n.id === nodeId)?.data.label ?? nodeId`

**`exitContainerLayer()`**
- `currentLayer = 'context'`
- `activeContainerId = null`
- `breadcrumb = []`

**通知**
- Navigation state は `aria-state.json` 非永続なので、`_notifyExtension()` は呼ばない（固定）

#### 3-4. Container CRUD（最低限）

**`addContainerNode(parentContainerId, ...)`**
- `ensureContainerCanvas` / `mapContainerCanvas` 経由で `canvas.nodes` を更新
- ADR 自動生成（M6 の既存ルール）も行う
- 必要なら `parentId` を options 化してエッジ自動追加（M8 mindmap の考え方を流用可、M9では必須ではない）
- 更新後に `_notifyExtension(get())`

**`deleteContainerNode(parentContainerId, nodeId)`**
- 対象ノード削除
- `canvas.edges` から関連エッジ削除
- `tasks[*].linkedNodeIds` からも nodeId を除去（コンテキストノード削除と同じ整合性を維持）
- 更新後に `_notifyExtension(get())`

#### 3-5. Surface-aware React Flow API（M9 必須）

**M9 で必ず実装するアクション**
```typescript
applyNodeChangesToSurface(surface: DiagramSurfaceRef, changes: NodeChange[]): void
applyEdgeChangesToSurface(surface: DiagramSurfaceRef, changes: EdgeChange[]): void
connectOnSurface(surface: DiagramSurfaceRef, connection: Connection): void
```

**固定ルーティング（M9）**
- `surface.kind === 'c4-context'`
  - `state.nodes` / `state.edges` のうち C4 ノード/エッジのみ対象にする
  - mindmap ノード/エッジを壊さない
- `surface.kind === 'c4-container'`
  - `containerCanvases[surface.containerId].nodes/edges` を更新
- `surface.kind === 'mindmap-root'`
  - M9 では未使用でもよい（`throw` ではなく既存ハンドラ経路を使う方が安全）

**C4 Context 更新時の注意（重要）**
- `applyNodeChanges(changes, s.nodes)` をそのまま実行すると mindmap ノードにも作用しうるため、以下の形で分離する:
  1. C4 ノード配列を抽出
  2. `applyNodeChanges(changes, c4Nodes)`
  3. mindmap ノードと再結合
- Edge も同様に C4 対象のみ抽出して再結合する

#### 3-6. `_notifyExtension()` と `setState()` の修正（必須）

**`_notifyExtension()`**
- payload 抽出に `containerCanvases` を追加する

```typescript
const { nodes, edges, tasks, adrs, version, lastModified, containerCanvases } = state;
const payload: AriaState = { nodes, edges, tasks, adrs, version, lastModified, containerCanvases };
```

**`setState(newState)`**
- `containerCanvases ?? {}` を補完して Store に取り込む
- `currentLayer` / `activeContainerId` / `breadcrumb` は保持（または context に初期化）するが、`newState` から上書きしない

**固定実装（推奨）**
```typescript
set((s) => ({
  ...s, // navigation を残す
  ...newState,
  containerCanvases: newState.containerCanvases ?? {},
  lastModified: new Date().toISOString(),
}));
```

### Step 4: `webview/src/components/canvas/AriaCanvas.tsx`（薄いルーティング化）

#### 4-1. 先に Store から取るものを追加

**追加 selector（M9）**
- `currentLayer`
- `activeContainerId`
- `containerCanvases`（直接参照を残す場合）
- `enter/exit` 系アクション
- `applyNodeChangesToSurface` / `applyEdgeChangesToSurface` / `connectOnSurface`
- （推奨）`getSurfaceNodes` / `getSurfaceEdges`

#### 4-2. surface 解決の実装（固定）

**C4 タブ**
- `currentLayer === 'context'` → `{ kind: 'c4-context' }`
- `currentLayer === 'container' && activeContainerId != null` → `{ kind: 'c4-container', containerId: activeContainerId }`
- `currentLayer === 'container' && activeContainerId == null` は異常系
  - フォールバックで `context` 扱い + warning log（クラッシュさせない）

**Mindmap タブ**
- M9 では既存挙動維持を優先し、現行 `onNodesChange/onEdgesChange/onConnect` を使い続けてよい
- ただし将来統一のため、コメントで `mindmap-root` 移行予定を明記する

#### 4-3. ReactFlow に渡すハンドラ（固定）

- `canvasType === 'c4'` の場合:
  - `onNodesChange={(changes) => applyNodeChangesToSurface(surface, changes)}`
  - `onEdgesChange={(changes) => applyEdgeChangesToSurface(surface, changes)}`
  - `onConnect={(connection) => connectOnSurface(surface, connection)}`
- `canvasType === 'mindmap'` の場合:
  - 既存の `onNodesChange / onEdgesChange / onConnect` をそのまま使う（M9 のスコープ管理）

### Step 5: `webview/src/components/canvas/nodes/C4ContainerNode.tsx`

**固定変更**
- 右クリックメニューに `📦 コンテナレイヤーへ遷移` を追加
- `useAriaStore((s) => s.enterContainerLayer)` を取得して onClick で呼ぶ
- 対象ノードタイプが `c4-container` の場合のみ表示（`c4-component` には出さない）

**メニュー位置（推奨）**
- `ラベル編集` の下、`削除` より上

### Step 6: `src/extension/parse-aria-state.ts`

**必須変更**
- `containerCanvases` を `raw.containerCanvases ?? {}` で取り込む
- 各 canvas の `nodes` / `edges` が配列かを確認
- 不正 canvas はスキップ（全体エラーにしない）
- `AriaState` 組み立て時に `containerCanvases` を含める

**固定方針**
- M9 では `nodes` / `edges` の厳密バリデーションを拡張しすぎない（既存ポリシーを踏襲）
- 不正タスクの Inbox 隔離ルールはコンテナキャンバスには適用しない

### Step 7: `src/extension/reconcile-state.ts`

**必須変更**
- `return` する `AriaState` に `containerCanvases` マージ結果を含める

**固定方針（M9）**
- コンテキスト `nodes.position` のみ current 優先（既存どおり）
- `containerCanvases` は incoming 優先のシンプル上書き

### Step 8: `src/extension/generators/architecture-generator.ts` + `src/extension/file-writer.ts`

**必須変更**
- `architecture-generator` が `containerCanvases` を受け取れるようにする
- `file-writer.ts` の呼び出しを合わせて更新する

**固定方針（M9）**
- 既存の Context 出力は壊さない
- `containerCanvases` が空なら C4Container セクションは出力しない
- 出力順は「Context セクション → Container セクション群」

### Step 9: 手動テスト（この順番で実施）

1. C4 タブで `c4-container` ノードを追加
2. 右クリックで「コンテナレイヤーへ遷移」
3. 空キャンバス + 戻るボタン + Breadcrumb 表示を確認
4. コンテナレイヤー内でノードを追加
5. ノードをドラッグ移動
6. ノード間を接続
7. `aria.syncNow` 実行
8. `.ai-context/aria-state.json` に `containerCanvases` が出ていることを確認
9. VS Code を再起動して復元確認
10. `.ai-context/architecture.mermaid` に C4Container セクションが追加されることを確認

### Step 10: デバッグチェック（詰まりやすい箇所）

**症状**: コンテナ内ノードの追加はできるが再起動で消える  
**確認**:
- `webview/src/store/aria-store.ts` の `_notifyExtension()` payload に `containerCanvases` が含まれているか
- `src/extension/file-writer.ts` に渡る `currentState` に `containerCanvases` が入っているか

**症状**: コンテナ内でドラッグしても位置が戻る  
**確認**:
- `AriaCanvas.tsx` が C4 タブ時に `applyNodeChangesToSurface` を呼んでいるか
- `applyNodeChangesToSurface` が `containerCanvases[containerId].nodes` を更新しているか（`state.nodes` を触っていないか）

**症状**: 起動時に `containerCanvases` が `undefined` で落ちる  
**確認**:
- `src/extension/persistence.ts` の補完処理
- `webview/src/store/aria-store.ts` `setState(newState)` の `?? {}` 補完

### 禁止事項（M9）

- `aria-state.json` に `currentLayer` / `activeContainerId` / `breadcrumb` を保存しない
- `MindmapNode.tsx` の仕様変更を M9 のついでに進めない（M11スコープ）
- `ContextMenu.tsx` のサブメニュー対応を M9 で先行しない（M11スコープ）
- `reconcile-state.ts` でコンテナ内ノード座標まで current 優先にしない（M9では incoming 優先）
- `containerCanvases` 内にコンテキストレイヤーのノードをコピーしない（重複保持禁止）

---

## M9-5: Acceptance Criteria

```
[ ] c4-container ノードを右クリック → 「コンテナレイヤーへ遷移」が表示される
[ ] 遷移後、キャンバスがコンテナキャンバス（空）に切り替わる
[ ] BreadcrumbNav に「コンテキスト › [ノード名]」が表示される
[ ] コンテナ内でノードを追加できる
[ ] コンテナ内でノード移動・接続が保存される（再描画/再起動後も保持）
[ ] C4 タブの React Flow 更新イベントが Store の surface-aware API 経由で処理される（`AriaCanvas.tsx` に配列更新ロジックを持ち込まない）
[ ] 戻るボタンでコンテキストレイヤーに戻れる
[ ] VS Code 再起動後、コンテナ内のノードが復元されている（aria-state.json で永続化）
[ ] architecture.mermaid に C4Container セクションが出力される
[ ] コンテナ内の操作で isWriting ループが発生しない
[ ] mindmap ノードに対しては「コンテナレイヤーへ遷移」が表示されない
```

---

## 注意事項

- `AriaToolbar.tsx` でのノード追加ボタン（「+ コンテナ」等）は、`currentLayer` に応じて呼び出すアクションを切り替える必要がある
- コンテナレイヤー内での右クリックメニューは、コンテキストレイヤーと同じものを使う（「コンテナレイヤーへ遷移」以外は共通）
- `aria-state.json` の `containerCanvases` フィールドが存在しない古いファイルを読み込んだ場合は `{}` として初期化する（後方互換性）
- M9 では C4 の `context/container` に絞って surface-aware API を導入する。Mindmap まで同時に全面リファクタするとスコープ超過になりやすいため、`mindmap-root` は予約枠として段階適用してよい

---

*最終更新: 2026-02-26 | バージョン: 1.2.0*
