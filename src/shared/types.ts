import type { ConfiguredLocale, I18nSnapshot } from './i18n/runtime';

// ============================================================
// ARIA 共有型定義 — Extension Host と Webview の両方で使用する
// ============================================================

// ----- タスク関連 -----

export type TaskStatus = 'Todo' | 'In Progress' | 'Done' | 'Inbox';

export interface KanbanTask {
  id: string;           // 形式: "task-xxxxxxxx"（crypto.randomUUID() で生成）
  status: TaskStatus;
  title: string;
  linkedNodeIds: string[];
  createdAt: string;    // ISO 8601 形式
  updatedAt: string;    // ISO 8601 形式
  startDate?: string;   // YYYY-MM-DD 形式
  dueDate?: string;     // YYYY-MM-DD 形式
}

// ----- ADR関連 -----

export interface ADR {
  id: string;           // 形式: "adr-xxxxxxxx"
  linkedNodeId: string;
  title: string;
  decision: string;
  rejectedOptions: string[];
  createdAt: string;    // ISO 8601 形式
}

// ----- M13: セマンティックネットワーク拡張 -----

export type MindmapStyleRole = 'standard' | 'top' | 'helper';

export interface MindmapBoundary {
  id: string;
  label: string;
  nodeIds: string[];
  visible: boolean;
}

export interface MindmapSettings {
  snapEnabled?: boolean;
}

export type ConsentScope =
  | 'export_compliance_guard'
  | 'ai_layout_sync_apply';

export type ConsentMode =
  | 'always_allow'
  | 'ask_high_risk_only'
  | 'always_ask';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface WorkspaceConsentRecord {
  workspaceIdHash: string;
  termsVersion: string;
  acceptedAt: string; // ISO 8601
  scopes: ConsentScope[];
  mode: ConsentMode;
  updatedAt: string;  // ISO 8601
}

// ----- React Flow ノード・エッジ -----

export interface AriaNode {
  id: string;           // 形式: "node-xxxxxxxx"
  type: 'c4-container' | 'c4-component' | 'mindmap';
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    technology?: string;
    // M13: mindmap 専用拡張
    note?: string;
    collapsed?: boolean;
    checkboxEnabled?: boolean;
    checked?: boolean;
    styleRole?: MindmapStyleRole;
    color?: string; // #RRGGBB
    boundaryId?: string;
  };
  // React Flow セッション属性（永続化対象外）
  selected?: boolean;
}

export interface AriaEdge {
  id: string;           // 形式: "edge-xxxxxxxx"
  source: string;
  target: string;
  label?: string;
}

export interface ContainerCanvas {
  nodeId: string;       // 親コンテキストノードID（キーと同値を想定）
  nodes: AriaNode[];
  edges: AriaEdge[];
}

// ----- アプリ全体の状態 -----

export interface AriaState {
  nodes: AriaNode[];
  edges: AriaEdge[];
  tasks: Record<string, KanbanTask>;  // key: task.id
  adrs: Record<string, ADR>;          // key: adr.id
  containerCanvases: Record<string, ContainerCanvas>; // key: 親コンテキスト nodeId
  // M13: optional（後方互換）
  mindmapBoundaries?: Record<string, MindmapBoundary>;
  mindmapSettings?: MindmapSettings;
  version: string;                    // スキーマバージョン（例: "1.0.0"）
  lastModified: string;               // ISO 8601 形式
}

export interface MindmapExportRequest {
  format: 'markdown' | 'svg' | 'png';
  content: string;
  stateHash: string;
}

// ----- postMessage 通信プロトコル -----

/** Extension Host → Webview */
export type ExtensionToWebviewMessage =
  | { type: 'INIT_STATE'; payload: AriaState }
  | { type: 'I18N_INIT'; payload: I18nSnapshot }
  | { type: 'I18N_LOCALE_CHANGED'; payload: I18nSnapshot }
  | { type: 'STATE_UPDATED'; payload: AriaState }
  | { type: 'ERROR'; payload: { message: string; code?: string } }
  | { type: 'MINDMAP_EXPORT_RESULT'; payload: { ok: boolean; message: string } }
  | { type: 'OPEN_RULE_GUIDE' }
  | { type: 'ADD_TASK' };  // aria.addTask コマンド経由（VS Code キーバインド）

/** Webview → Extension Host */
export type WebviewToExtensionMessage =
  | { type: 'READY' }
  | { type: 'I18N_SET_LOCALE_REQUEST'; payload: { locale: ConfiguredLocale } }
  | { type: 'STATE_CHANGED'; payload: AriaState }
  | { type: 'MINDMAP_EXPORT_REQUEST'; payload: MindmapExportRequest };
