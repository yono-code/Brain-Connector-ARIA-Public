// ============================================================
// reconcile-state.ts — State-First Reconciliation
// ============================================================
//
// 責務: 外部変更された AriaState を現在の GUI State にマージする。
//
// 優先ルール（設計書「AIとGUIの双方向同期設計」より）:
//   tasks / adrs    → incoming を優先（AI・人間の変更を反映する）
//   edges           → incoming を優先（接続情報は AI が変更しても有効とする）
//   containerCanvases → incoming を優先（M9: コンテナレイヤー永続化）
//   nodes.position  → current を優先（GUI の座標を保護する）
//   nodes.data      → incoming を優先
//   新規ノード      → incoming から追加する
//   削除ノード      → incoming に存在しなければ削除する
//
// ============================================================

import { AriaState, AriaNode } from '../shared/types';

export interface ReconcileOptions {
  preserveNodePositions?: boolean;
  preserveMindmapLayout?: boolean;
}

/**
 * 外部変更された State を現在の State にマージする。
 *
 * @param incoming - aria-state.json からパース済みの AriaState（parseAriaState の結果）
 * @param current  - 現在の Zustand Store の AriaState（GUI 座標の正）
 * @returns マージ後の AriaState（current を直接変更しない）
 */
export function reconcileState(
  incoming: AriaState,
  current: AriaState,
  options?: ReconcileOptions,
): AriaState {
  const preserveNodePositions = options?.preserveNodePositions ?? true;
  const preserveMindmapLayout = options?.preserveMindmapLayout ?? true;

  // --- ノードの Reconciliation ---
  //
  // ノードリストは incoming を基準（ソース・オブ・トゥルース）として再構築する。
  // incoming に存在しないノードは削除済みとみなし、結果に含めない。
  // position のみ current から引き継ぐことで、AI による誤った座標書き換えを防ぐ。
  const reconciledNodes: AriaNode[] = incoming.nodes.map((incomingNode) => {
    const currentNode = current.nodes.find((n) => n.id === incomingNode.id);

    if (!currentNode) {
      // 新規ノード → incoming のデータ（position 含む）をそのまま使用する
      return incomingNode;
    }

    // 既存ノード:
    // - preserveNodePositions=true の場合は位置を保護
    // - ただし preserveMindmapLayout=false のときは mindmap 位置を incoming で反映
    const shouldKeepCurrentPosition =
      preserveNodePositions &&
      !(incomingNode.type === 'mindmap' && !preserveMindmapLayout);

    return {
      ...incomingNode,
      position: shouldKeepCurrentPosition ? currentNode.position : incomingNode.position,
    };
  });

  return {
    // tasks / adrs / edges / version は incoming を優先する
    ...incoming,
    // ノードは Reconciliation 済みのものを使用する
    nodes: reconciledNodes,
    // M9: コンテナキャンバスは incoming を優先（欠如時は空にフォールバック）
    containerCanvases: incoming.containerCanvases ?? {},
    mindmapBoundaries: incoming.mindmapBoundaries ?? {},
    mindmapSettings: incoming.mindmapSettings ?? { snapEnabled: true },
    // lastModified は Reconciliation 実行時刻を記録する
    lastModified: new Date().toISOString(),
  };
}
