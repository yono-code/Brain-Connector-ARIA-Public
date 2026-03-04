# M10: ADR コンテナレイヤー対応 — スペックキット

**前提条件**: M9 完了
**推定工数**: 小
**プランファイル**: `ai_shared/plans/M9_M12_feature_expansion_plan.md`

---

## ゴール

コンテナレイヤー内のノードに対しても ADR を記述・参照できる。
ADR パネルタブが両レイヤーで常時使用可能。

---

## 背景と設計方針

現在の ADR は `linkedNodeId` でノードに紐付く設計のため、データ構造上は変更不要。
コンテナレイヤーのノードも `id: "node-xxxxxxxx"` 形式の ID を持つため、既存の ADR CRUD がそのまま使える。

**必要な変更**:
1. ADR パネルタブの表示条件がコンテキストレイヤー限定になっている場合は解除
2. ADR ファイル出力に「どのレイヤーのノードか」のメタデータを追加

---

## M10-1: ADR パネルのレイヤー非依存化

### 変更ファイル: `webview/src/components/layout/TabBar.tsx` / `webview/src/components/adr/AdrPanel.tsx`（必要時）

コンテナレイヤー時も「📄 ADR」タブが表示・クリックできること。

```tsx
// もし TabBar.tsx 等で currentLayer をチェックしてタブを隠している場合は削除
// ADR タブは常時表示
```

**実装補足（現行コード基準）**:
- 現行 `webview/src/components/layout/TabBar.tsx` は ADR タブを常時表示しているため、M10-1 は「表示条件変更」ではなく「コンテナレイヤー時に ADR 操作が問題なく動くか」の確認が中心になる可能性が高い。
- 実際の不具合ポイントは `AdrPanel.tsx` 側のノード一覧取得/表示ロジックになりやすい（コンテキストノードのみを参照していないか確認）。

コンテナレイヤー内でノードを右クリック → ADR 追加が選択できること。
→ `addADR(linkedNodeId)` の呼び出し先は変わらない（既存実装を流用）。

---

## M10-2: ADR ファイル出力のメタデータ拡張

### 変更ファイル: `src/extension/generators/adr-generator.ts`（＋ `src/extension/file-writer.ts`）

コンテナレイヤーのノードに紐付いた ADR には、レイヤー情報をメタデータに追加する。

```markdown
# ADR-0001: タイトル

**作成日**: YYYY-MM-DD
**ステータス**: 決定済み
**レイヤー**: コンテナ（親コンテナ: [parentContainerLabel] / [parentContainerId]）
**関連ノード**: [linkedNodeId]

## 決定内容

...
```

**ロジック**:

```typescript
// adr-generator.ts 内
function getNodeLayer(
  nodeId: string,
  state: AriaState
): { layer: 'context' | 'container'; parentContainerId?: string; parentContainerLabel?: string } {
  // state.nodes に存在すればコンテキストレイヤー
  if (state.nodes.some(n => n.id === nodeId)) {
    return { layer: 'context' };
  }
  // state.containerCanvases 内を検索
  for (const [containerId, canvas] of Object.entries(state.containerCanvases)) {
    if (canvas.nodes.some(n => n.id === nodeId)) {
      const parentLabel = state.nodes.find(n => n.id === containerId)?.data?.label ?? containerId;
      return { layer: 'container', parentContainerId: containerId, parentContainerLabel: parentLabel };
    }
  }
  return { layer: 'context' }; // フォールバック
}
```

**実装補足（必須）**:
- 現行の `generateAdrFiles()` は `adrs` のみを受け取るシグネチャのため、上記ロジックを実装するには `state.nodes` / `state.containerCanvases` へアクセスできるように引数拡張が必要。
- それに伴い `src/extension/file-writer.ts` の `generateAdrFiles(...)` 呼び出しも更新する。
- `state.containerCanvases` は後方互換のため `state.containerCanvases ?? {}` として扱う。

---

## M10-3: Acceptance Criteria

```
[ ] コンテナレイヤー内でノードを右クリック → ADR 追加が選択できる
[ ] ADR パネルタブがコンテナレイヤーでも表示・操作できる
[ ] コンテキストレイヤーのノード ADR: レイヤーメタデータなし（既存通り）
[ ] コンテナレイヤーのノード ADR: 「レイヤー: コンテナ（親: [名前]）」が出力される
[ ] ADR 削除・編集は両レイヤーで動作する
```

---

*最終更新: 2026-02-25 | バージョン: 1.0.0*
