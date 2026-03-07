// ============================================================
// parse-aria-state.ts — aria-state.json パーサー（バリデーション付き）
// ============================================================
//
// 責務: 生テキストを受け取り、型安全な AriaState を返す。
// 不正なデータは Inbox に隔離し、エラーは呼び出し元に伝播する。
//
// ============================================================

import {
  AriaEdge,
  AriaNode,
  AriaState,
  ContainerCanvas,
  KanbanTask,
  MindmapBoundary,
  MindmapSettings,
  TaskStatus,
} from '../shared/types';

// --- 定数 ---

// 有効なタスクステータスの一覧
const VALID_STATUSES: readonly TaskStatus[] = [
  'Todo',
  'In Progress',
  'Done',
  'Inbox',
] as const;

// タスクIDの正規表現（"task-" + 8桁の16進数小文字）
const TASK_ID_PATTERN = /^task-[a-f0-9]{8}$/;

// ADR IDの正規表現（"adr-" + 8桁の16進数小文字）
const ADR_ID_PATTERN = /^adr-[a-f0-9]{8}$/;
const YMD_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const EDGE_VARIANTS = new Set<NonNullable<AriaEdge['variant']>>([
  'single-forward',
  'single-reverse',
  'double-headed',
  'double-parallel',
]);

// --- 型定義 ---

/**
 * parseAriaState の戻り値型。
 * 成功時は sanitize 済みの AriaState と隔離件数を返す。
 * 失敗時は人間可読なエラーメッセージを返す。
 */
export type ParseResult =
  | { ok: true; state: AriaState; quarantinedCount: number }
  | { ok: false; error: string };

// --- メイン関数 ---

/**
 * aria-state.json の生テキストをパースし、バリデーションを行う。
 *
 * バリデーションルール:
 * - BOM 付き UTF-8 を透過的に処理する
 * - 空ファイルはエラーとして扱う（GUI はクラッシュさせない）
 * - 不正 JSON はエラーとして扱う
 * - 必須フィールド（nodes / edges / tasks / adrs）が存在しない場合はエラー
 * - タスク ID が "task-[a-f0-9]{8}" 形式でない場合 → 新 ID で Inbox に隔離
 * - タスクの status が不正な場合 → Inbox にフォールバック
 * - ADR ID が "adr-[a-f0-9]{8}" 形式でない場合 → 新 ID で再採番（status なし）
 */
export function parseAriaState(rawJson: string): ParseResult {
  // BOM 除去 + 前後の空白除去
  const cleaned = rawJson.replace(/^\uFEFF/, '').trim();

  // 空ファイルは意図的な削除の可能性があるため、エラーとして扱い GUI 変更なし
  if (!cleaned) {
    return { ok: false, error: 'ファイルが空です' };
  }

  // JSON パース
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return {
      ok: false,
      error: `JSON パースエラー: ${(e as Error).message}`,
    };
  }

  // 最上位の型確認
  if (!isPlainObject(parsed)) {
    return { ok: false, error: '最上位の値がオブジェクトではありません' };
  }

  // 必須フィールドの存在確認
  const requiredFields = ['nodes', 'edges', 'tasks', 'adrs'] as const;
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      return { ok: false, error: `必須フィールド "${field}" が存在しません` };
    }
  }

  // フィールドの型確認
  const raw = parsed as Record<string, unknown>;

  if (!Array.isArray(raw.nodes)) {
    return { ok: false, error: '"nodes" フィールドが配列ではありません' };
  }
  if (!Array.isArray(raw.edges)) {
    return { ok: false, error: '"edges" フィールドが配列ではありません' };
  }
  if (!isPlainObject(raw.tasks)) {
    return { ok: false, error: '"tasks" フィールドがオブジェクトではありません' };
  }
  if (!isPlainObject(raw.adrs)) {
    return { ok: false, error: '"adrs" フィールドがオブジェクトではありません' };
  }

  // タスクの sanitize（不正データを Inbox に隔離）
  const { sanitizedTasks, quarantinedCount } = sanitizeTasks(
    raw.tasks as Record<string, unknown>
  );

  // ADR の sanitize（不正 ID を再採番）
  const sanitizedAdrs = sanitizeAdrs(raw.adrs as Record<string, unknown>);
  const sanitizedNodes = sanitizeNodes(raw.nodes as unknown[]);
  const sanitizedEdges = sanitizeEdges(raw.edges as unknown[]);
  const sanitizedContainerCanvases = sanitizeContainerCanvases(raw.containerCanvases);
  const mindmapBoundaries = sanitizeMindmapBoundaries(raw.mindmapBoundaries);
  const mindmapSettings = sanitizeMindmapSettings(raw.mindmapSettings);

  // AriaState を組み立てる
  // nodes / edges はMVPでは配列存在確認のみ（詳細バリデーションはM6以降で強化）
  const state: AriaState = {
    nodes: sanitizedNodes,
    edges: sanitizedEdges,
    tasks: sanitizedTasks,
    adrs: sanitizedAdrs,
    containerCanvases: sanitizedContainerCanvases,
    mindmapBoundaries,
    mindmapSettings,
    version: typeof raw.version === 'string' ? raw.version : '1.0.0',
    lastModified: new Date().toISOString(),
  };

  return { ok: true, state, quarantinedCount };
}

// --- プライベートヘルパー ---

/**
 * タスク Record を検証し、不正なエントリを Inbox に隔離する。
 * 戻り値に隔離件数を含めることで、呼び出し元が警告ダイアログを出せる。
 */
function sanitizeTasks(
  rawTasks: Record<string, unknown>
): { sanitizedTasks: Record<string, KanbanTask>; quarantinedCount: number } {
  const sanitizedTasks: Record<string, KanbanTask> = {};
  let quarantinedCount = 0;
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(rawTasks)) {
    // エントリの値自体が非オブジェクトなら完全にスキップ
    if (!isPlainObject(value)) {
      console.warn(`ARIA: タスクエントリ "${key}" の値が不正なためスキップします`);
      continue;
    }

    const rawTask = value as Record<string, unknown>;

    // タイトルが文字列でなければデフォルト値を設定
    const title =
      typeof rawTask.title === 'string' && rawTask.title.trim()
        ? rawTask.title.trim()
        : '（タイトルなし）';

    // linkedNodeIds の sanitize（配列でなければ空配列）
    const linkedNodeIds = Array.isArray(rawTask.linkedNodeIds)
      ? (rawTask.linkedNodeIds as unknown[]).filter(
        (id): id is string => typeof id === 'string'
      )
      : [];

    // createdAt / updatedAt の sanitize
    const createdAt =
      typeof rawTask.createdAt === 'string' ? rawTask.createdAt : now;
    const updatedAt =
      typeof rawTask.updatedAt === 'string' ? rawTask.updatedAt : now;

    // 日付フィールド (startDate / dueDate) の sanitize
    const startDate = sanitizeTaskDate(rawTask.startDate, 'startDate', key);
    const dueDate = sanitizeTaskDate(rawTask.dueDate, 'dueDate', key);
    const note =
      typeof rawTask.note === 'string' && rawTask.note.trim()
        ? rawTask.note
        : undefined;

    // タスクIDのバリデーション
    // Record のキーを正として使用する（内部 id フィールドとの不一致は上書き）
    const isValidKey = TASK_ID_PATTERN.test(key);

    if (!isValidKey) {
      // 不正なキー形式 → 新 ID を採番して Inbox に隔離する
      // crypto.randomUUID() を toLowerCase() で小文字に統一する（大文字が混入する場合に対応）
      const safeId = `task-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toLowerCase()}`;
      console.warn(
        `ARIA: 不正なタスク ID "${key}" を Inbox に隔離します。新 ID: "${safeId}"`
      );
      sanitizedTasks[safeId] = {
        id: safeId,
        status: 'Inbox',
        title,
        linkedNodeIds,
        note,
        createdAt,
        updatedAt: now, // 隔離時刻を updatedAt に記録する
        startDate,
        dueDate,
      };
      quarantinedCount++;
      continue;
    }

    // ステータスのバリデーション
    const rawStatus = rawTask.status as string;
    const isValidStatus = VALID_STATUSES.includes(rawStatus as TaskStatus);

    if (!isValidStatus) {
      // 不正なステータス → Inbox にフォールバック
      console.warn(
        `ARIA: タスク "${key}" の不正なステータス "${rawStatus}" を Inbox に変換します`
      );
      sanitizedTasks[key] = {
        id: key,
        status: 'Inbox',
        title,
        linkedNodeIds,
        note,
        createdAt,
        updatedAt: now,
        startDate,
        dueDate,
      };
      quarantinedCount++;
      continue;
    }

    // バリデーション通過 → そのまま追加（id フィールドはキーで上書き）
    sanitizedTasks[key] = {
      id: key,
      status: rawStatus as TaskStatus,
      title,
      linkedNodeIds,
      note,
      createdAt,
      updatedAt,
      startDate,
      dueDate,
    };
  }

  return { sanitizedTasks, quarantinedCount };
}

/**
 * ADR Record を検証し、不正な ID を再採番する。
 * ADR にはステータスがないため、Inbox 隔離の概念は適用しない。
 */
function sanitizeAdrs(
  rawAdrs: Record<string, unknown>
): AriaState['adrs'] {
  const sanitizedAdrs: AriaState['adrs'] = {};
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(rawAdrs)) {
    if (!isPlainObject(value)) {
      console.warn(`ARIA: ADR エントリ "${key}" の値が不正なためスキップします`);
      continue;
    }

    const rawAdr = value as Record<string, unknown>;
    const isValidKey = ADR_ID_PATTERN.test(key);

    const targetKey = isValidKey
      ? key
      : `adr-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toLowerCase()}`;

    if (!isValidKey) {
      console.warn(
        `ARIA: 不正な ADR ID "${key}" を再採番します。新 ID: "${targetKey}"`
      );
    }

    sanitizedAdrs[targetKey] = {
      id: targetKey,
      linkedNodeId:
        typeof rawAdr.linkedNodeId === 'string' ? rawAdr.linkedNodeId : '',
      title: typeof rawAdr.title === 'string' ? rawAdr.title : '（タイトルなし）',
      decision: typeof rawAdr.decision === 'string' ? rawAdr.decision : '',
      rejectedOptions: Array.isArray(rawAdr.rejectedOptions)
        ? (rawAdr.rejectedOptions as unknown[]).filter(
          (o): o is string => typeof o === 'string'
        )
        : [],
      createdAt: typeof rawAdr.createdAt === 'string' ? rawAdr.createdAt : now,
    };
  }

  return sanitizedAdrs;
}

/**
 * containerCanvases を検証し、最低限の型保証（各 canvas の nodes/edges が配列）を行う。
 * フィールド欠如は後方互換のため {} として扱う。
 */
function sanitizeContainerCanvases(
  rawValue: unknown
): Record<string, ContainerCanvas> {
  if (typeof rawValue === 'undefined') {
    return {};
  }

  if (!isPlainObject(rawValue)) {
    console.warn('ARIA: "containerCanvases" フィールドが不正なため空として扱います');
    return {};
  }

  const result: Record<string, ContainerCanvas> = {};

  for (const [containerId, value] of Object.entries(rawValue)) {
    if (!isPlainObject(value)) {
      console.warn(`ARIA: containerCanvases["${containerId}"] が不正なためスキップします`);
      continue;
    }

    const rawCanvas = value as Record<string, unknown>;
    const nodes = Array.isArray(rawCanvas.nodes)
      ? sanitizeNodes(rawCanvas.nodes as unknown[])
      : [];
    const edges = Array.isArray(rawCanvas.edges)
      ? sanitizeEdges(rawCanvas.edges as unknown[])
      : [];

    result[containerId] = {
      nodeId:
        typeof rawCanvas.nodeId === 'string' ? rawCanvas.nodeId : containerId,
      nodes,
      edges,
    };
  }

  return result;
}

function sanitizeEdges(rawEdges: unknown[]): AriaEdge[] {
  const result: AriaEdge[] = [];

  for (const rawEdge of rawEdges) {
    if (!isPlainObject(rawEdge)) {
      continue;
    }

    const edge = rawEdge as Record<string, unknown>;
    if (
      typeof edge.id !== 'string' ||
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string'
    ) {
      continue;
    }

    const variant = (
      typeof edge.variant === 'string' && EDGE_VARIANTS.has(edge.variant as NonNullable<AriaEdge['variant']>)
    )
      ? edge.variant as NonNullable<AriaEdge['variant']>
      : 'single-forward';
    const label = typeof edge.label === 'string' && edge.label.trim()
      ? edge.label
      : undefined;
    const sourceLabel = typeof edge.sourceLabel === 'string' && edge.sourceLabel.trim()
      ? edge.sourceLabel
      : undefined;
    const targetLabel = typeof edge.targetLabel === 'string' && edge.targetLabel.trim()
      ? edge.targetLabel
      : undefined;

    const nextEdge: AriaEdge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      variant,
    };
    if (label) {
      nextEdge.label = label;
    }
    if (sourceLabel) {
      nextEdge.sourceLabel = sourceLabel;
    }
    if (targetLabel) {
      nextEdge.targetLabel = targetLabel;
    }
    result.push(nextEdge);
  }

  return result;
}

function sanitizeNodes(rawNodes: unknown[]): AriaNode[] {
  const result: AriaNode[] = [];
  for (const rawNode of rawNodes) {
    if (!isPlainObject(rawNode)) {
      continue;
    }

    const node = rawNode as Record<string, unknown>;
    if (typeof node.id !== 'string') {
      continue;
    }

    const type =
      node.type === 'c4-container' ||
      node.type === 'c4-component' ||
      node.type === 'c4-person' ||
      node.type === 'c4-database' ||
      node.type === 'c4-module' ||
      node.type === 'mindmap'
        ? node.type
        : 'mindmap';
    const position = isPlainObject(node.position)
      ? {
          x: Number((node.position as Record<string, unknown>).x) || 0,
          y: Number((node.position as Record<string, unknown>).y) || 0,
        }
      : { x: 0, y: 0 };
    const data = isPlainObject(node.data)
      ? (node.data as Record<string, unknown>)
      : {};
    const nextData: AriaNode['data'] = {
      label: typeof data.label === 'string' && data.label.trim() ? data.label.trim() : '（無題）',
    };

    if (typeof data.description === 'string') nextData.description = data.description;
    if (typeof data.technology === 'string') nextData.technology = data.technology;

    if (type === 'mindmap') {
      if (typeof data.note === 'string' && data.note.trim()) nextData.note = data.note;
      nextData.collapsed = typeof data.collapsed === 'boolean' ? data.collapsed : false;
      nextData.checkboxEnabled = typeof data.checkboxEnabled === 'boolean' ? data.checkboxEnabled : false;
      nextData.checked =
        typeof data.checked === 'boolean'
          ? data.checked
          : false;

      const rawStyleRole = data.styleRole;
      nextData.styleRole =
        rawStyleRole === 'top' || rawStyleRole === 'helper' || rawStyleRole === 'standard'
          ? rawStyleRole
          : 'standard';

      if (typeof data.color === 'string' && HEX_COLOR_PATTERN.test(data.color)) {
        nextData.color = data.color;
      }

      if (typeof data.boundaryId === 'string' && data.boundaryId.trim()) {
        nextData.boundaryId = data.boundaryId.trim();
      }
    }

    result.push({
      id: node.id,
      type,
      position,
      data: nextData,
    });
  }
  return result;
}

function sanitizeMindmapBoundaries(rawValue: unknown): Record<string, MindmapBoundary> | undefined {
  if (typeof rawValue === 'undefined') {
    return undefined;
  }
  if (!isPlainObject(rawValue)) {
    return {};
  }

  const result: Record<string, MindmapBoundary> = {};
  for (const [id, value] of Object.entries(rawValue)) {
    if (!isPlainObject(value)) {
      continue;
    }
    const b = value as Record<string, unknown>;
    result[id] = {
      id,
      label: typeof b.label === 'string' && b.label.trim() ? b.label.trim() : 'Boundary',
      nodeIds: Array.isArray(b.nodeIds)
        ? b.nodeIds.filter((v): v is string => typeof v === 'string')
        : [],
      visible: typeof b.visible === 'boolean' ? b.visible : true,
    };
  }
  return result;
}

function sanitizeMindmapSettings(rawValue: unknown): MindmapSettings | undefined {
  if (typeof rawValue === 'undefined') {
    return undefined;
  }
  if (!isPlainObject(rawValue)) {
    return { snapEnabled: true };
  }
  const raw = rawValue as Record<string, unknown>;
  return {
    snapEnabled:
      typeof raw.snapEnabled === 'boolean'
        ? raw.snapEnabled
        : true,
  };
}

/**
 * プレーンオブジェクトかどうかを判定する型ガード。
 * 配列・null・プリミティブを除外する。
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeTaskDate(
  rawValue: unknown,
  fieldName: 'startDate' | 'dueDate',
  taskId: string,
): string | undefined {
  if (typeof rawValue !== 'string') {
    return undefined;
  }

  const value = rawValue.trim();
  if (!value) {
    return undefined;
  }

  if (!isValidYmdDate(value)) {
    console.warn(
      `ARIA: タスク "${taskId}" の ${fieldName} "${value}" は不正な日付形式のため破棄します`
    );
    return undefined;
  }

  return value;
}

function isValidYmdDate(value: string): boolean {
  const match = YMD_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
