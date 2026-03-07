import type { ContextMenuItem } from '../../context-menu/ContextMenu';
import type { AriaNode, MindmapStyleRole } from '../../../../../src/shared/types';

interface C4MenuParams {
  id: string;
  label: string;
  type: AriaNode['type'];
  currentLayer: 'context' | 'container';
  hasLinkedAdr: boolean;
  onStartEdit: () => void;
  onAddAdr: (linkedNodeId: string, title: string) => void;
  onOpenLinkedAdr: () => void;
  onEnterContainerLayer: (nodeId: string) => void;
  onDelete: () => void;
}

interface MindmapMenuParams {
  collapsed?: boolean;
  hasChildren?: boolean;
  checkboxEnabled?: boolean;
  checked?: boolean;
  boundaryVisible?: boolean;
  styleRole?: MindmapStyleRole;
  colorItems?: ContextMenuItem[];
  onStartEdit: () => void;
  onEditNote?: () => void;
  onToggleCollapse?: () => void;
  onCollapseDescendants?: () => void;
  onExpandDescendants?: () => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onToggleCheckboxEnabled?: () => void;
  onToggleSubtreeCheckboxEnabled?: () => void;
  onToggleChecked?: () => void;
  onToggleSubtreeChecked?: () => void;
  onToggleBoundary?: () => void;
  onSetStyleRole?: (role: MindmapStyleRole) => void;
  onCreateTask: () => void;
  onLinkExistingTask: () => void;
  onDelete: () => void;
}

export function buildC4ContextMenuItems(params: C4MenuParams): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { icon: '✏️', label: 'ラベルを編集', onClick: params.onStartEdit },
    { icon: '📄', label: 'ADRを追加', onClick: () => params.onAddAdr(params.id, `${params.label} の追加ADR`) },
  ];

  if (params.hasLinkedAdr) {
    items.push({ icon: '📘', label: '対応 ADR を開く', onClick: params.onOpenLinkedAdr });
  }

  if (params.currentLayer === 'context' && params.type === 'c4-container') {
    items.push({ separator: true, label: '', onClick: () => {} });
    items.push({
      icon: '📦',
      label: 'コンテナレイヤーへ遷移',
      onClick: () => params.onEnterContainerLayer(params.id),
    });
  }

  items.push({ separator: true, label: '', onClick: () => {} });
  items.push({ icon: '🗑', label: '削除', onClick: params.onDelete, danger: true });

  return items;
}

export function buildMindmapContextMenuItems(params: MindmapMenuParams): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { icon: '✏️', label: 'ラベルを編集', onClick: params.onStartEdit },
    ...(params.onEditNote
      ? [{ icon: '📝', label: 'メモを編集', onClick: params.onEditNote } satisfies ContextMenuItem]
      : []),
    ...(params.onToggleCollapse
      ? [{
          icon: params.collapsed ? '▶' : '▼',
          label: params.collapsed ? '展開' : '折りたたみ',
          onClick: params.onToggleCollapse,
        } satisfies ContextMenuItem]
      : []),
    ...(params.onCollapseDescendants && params.onExpandDescendants && params.hasChildren
      ? [
          {
            icon: '📦',
            label: '子孫を全折りたたみ',
            onClick: params.onCollapseDescendants,
          } satisfies ContextMenuItem,
          {
            icon: '📂',
            label: '子孫を全展開',
            onClick: params.onExpandDescendants,
          } satisfies ContextMenuItem,
        ]
      : []),
    { separator: true, label: '', onClick: () => {} },
    { icon: '➕', label: '子ノードを追加', onClick: params.onAddChild },
    { icon: '➕', label: '兄弟ノードを追加', onClick: params.onAddSibling },
    ...(params.onToggleCheckboxEnabled
      ? [
          { separator: true, label: '', onClick: () => {} } satisfies ContextMenuItem,
          {
            icon: params.checkboxEnabled ? '☑️' : '☐',
            label: params.checkboxEnabled ? 'チェックボックスを解除' : 'チェックボックス化',
            onClick: params.onToggleCheckboxEnabled,
          } satisfies ContextMenuItem,
        ]
      : []),
    ...(params.onToggleSubtreeCheckboxEnabled
      ? [{
          icon: '📚',
          label: '配下のチェックボックス切替',
          onClick: params.onToggleSubtreeCheckboxEnabled,
        } satisfies ContextMenuItem]
      : []),
    ...(params.onToggleChecked
      ? [{
          icon: params.checked ? '✅' : '⬜',
          label: params.checked ? 'チェックを外す' : 'チェックする',
          onClick: params.onToggleChecked,
        } satisfies ContextMenuItem]
      : []),
    ...(params.onToggleSubtreeChecked
      ? [{
          icon: '✅',
          label: '配下を一括チェック切替',
          onClick: params.onToggleSubtreeChecked,
        } satisfies ContextMenuItem]
      : []),
    ...(params.onSetStyleRole
      ? [{
          icon: '🎨',
          label: 'スタイルロール',
          onClick: () => {},
          children: [
            {
              icon: params.styleRole === 'standard' ? '✓' : '・',
              label: '標準',
              onClick: () => params.onSetStyleRole?.('standard'),
            },
            {
              icon: params.styleRole === 'top' ? '✓' : '・',
              label: '最上位',
              onClick: () => params.onSetStyleRole?.('top'),
            },
            {
              icon: params.styleRole === 'helper' ? '✓' : '・',
              label: '補助',
              onClick: () => params.onSetStyleRole?.('helper'),
            },
          ],
        } satisfies ContextMenuItem]
      : []),
    ...(params.colorItems && params.colorItems.length > 0
      ? [{
          icon: '🎯',
          label: '色を変更',
          onClick: () => {},
          children: params.colorItems,
        } satisfies ContextMenuItem]
      : []),
    ...(params.onToggleBoundary
      ? [{
          icon: params.boundaryVisible ? '☁️' : '🌥️',
          label: params.boundaryVisible ? '境界線を非表示' : '境界線を表示',
          onClick: params.onToggleBoundary,
        } satisfies ContextMenuItem]
      : []),
    { separator: true, label: '', onClick: () => {} },
    {
      icon: '📋',
      label: 'タスクへ追加',
      onClick: () => {},
      children: [
        { icon: '➕', label: '新規タスクとして追加', onClick: params.onCreateTask },
        { icon: '🔗', label: '既存タスクに紐付け', onClick: params.onLinkExistingTask },
      ],
    },
    { separator: true, label: '', onClick: () => {} },
    { icon: '🗑', label: '削除', onClick: params.onDelete, danger: true },
  ];

  return items;
}
