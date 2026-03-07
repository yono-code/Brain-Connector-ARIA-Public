// ============================================================
// C4ContainerNode.tsx — C4 コンテナノード（削除UI・インライン編集・右クリックメニュー対応）
// ============================================================

import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { AriaNode } from '../../../../../src/shared/types';
import { Badge } from '../../ui/badge';
import { useAriaStore } from '../../../store/aria-store';
import { useContextMenu } from '../../context-menu/ContextMenu';
import { buildC4ContextMenuItems } from './node-menu-items';

interface C4NodeData {
  label: string;
  description?: string;
  technology?: string;
  [key: string]: unknown;
}

type C4NodeType = Extract<
  AriaNode['type'],
  'c4-container' | 'c4-component' | 'c4-person' | 'c4-database' | 'c4-module'
>;

const C4_NODE_TYPES: readonly C4NodeType[] = [
  'c4-container',
  'c4-component',
  'c4-person',
  'c4-database',
  'c4-module',
];

const C4_NODE_VISUALS: Record<C4NodeType, {
  icon: string;
  borderColor: string;
  background: string;
  borderRadius: number | string;
}> = {
  'c4-container': {
    icon: '🧱',
    borderColor: '#4ea1ff',
    background: 'rgba(78, 161, 255, 0.08)',
    borderRadius: 8,
  },
  'c4-component': {
    icon: '🧩',
    borderColor: '#4ec9b0',
    background: 'rgba(78, 201, 176, 0.08)',
    borderRadius: 8,
  },
  'c4-person': {
    icon: '👤',
    borderColor: '#c084fc',
    background: 'rgba(192, 132, 252, 0.10)',
    borderRadius: 8,
  },
  'c4-database': {
    icon: '🛢',
    borderColor: '#34d399',
    background: 'rgba(52, 211, 153, 0.10)',
    borderRadius: 12,
  },
  'c4-module': {
    icon: '🧪',
    borderColor: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.11)',
    borderRadius: 999,
  },
};

const SIDE_HANDLE_STYLE = {
  width: 8,
  height: 8,
  border: 'none',
  background: 'transparent',
};

function resolveC4Type(rawType: string | undefined): C4NodeType {
  if (C4_NODE_TYPES.includes(rawType as C4NodeType)) {
    return rawType as C4NodeType;
  }
  return 'c4-component';
}

export function C4ContainerNode({ id, data, selected, type }: NodeProps) {
  const d = data as C4NodeData;
  const nodeType = resolveC4Type(type);
  const visual = C4_NODE_VISUALS[nodeType];
  const deleteNode = useAriaStore((s) => s.deleteNode);
  const deleteContainerNode = useAriaStore((s) => s.deleteContainerNode);
  const addADR = useAriaStore((s) => s.addADR);
  const enterContainerLayer = useAriaStore((s) => s.enterContainerLayer);
  const currentLayer = useAriaStore((s) => s.currentLayer);
  const activeContainerId = useAriaStore((s) => s.activeContainerId);
  const updateNodeData = useAriaStore((s) => s.updateNodeData);
  const adrs = useAriaStore((s) => s.adrs);
  const selectAdrByNodeId = useAriaStore((s) => s.selectAdrByNodeId);
  const { openContextMenu } = useContextMenu();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(d.label);
  const [showDelete, setShowDelete] = useState(false);
  const linkedAdr = Object.values(adrs).find((adr) => adr.linkedNodeId === id);
  const adrDecisionPreview = linkedAdr?.decision
    ? linkedAdr.decision.replace(/\s+/g, ' ').slice(0, 80)
    : '';
  const hoverPreview = linkedAdr
    ? `対応ADR: ${linkedAdr.title}${adrDecisionPreview ? `\n${adrDecisionPreview}${linkedAdr.decision.length > 80 ? '…' : ''}` : ''}`
    : undefined;

  const startEdit = () => {
    setEditValue(d.label);
    setIsEditing(true);
  };

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== d.label) {
      updateNodeData(id, { label: trimmed });
    } else {
      setEditValue(d.label);
    }
  };

  const cancelEdit = () => {
    setEditValue(d.label);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (currentLayer === 'container' && activeContainerId) {
      deleteContainerNode(activeContainerId, id);
      return;
    }
    deleteNode(id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const safeType: AriaNode['type'] = nodeType;

    const items = buildC4ContextMenuItems({
      id,
      label: d.label,
      type: safeType,
      currentLayer,
      hasLinkedAdr: !!linkedAdr,
      onStartEdit: startEdit,
      onAddAdr: addADR,
      onOpenLinkedAdr: () => selectAdrByNodeId(id),
      onEnterContainerLayer: enterContainerLayer,
      onDelete: handleDelete,
    });

    openContextMenu(e.clientX, e.clientY, items);
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      title={hoverPreview}
      style={{
        position: 'relative',
        padding: 12,
        borderRadius: visual.borderRadius,
        border: `2px solid ${selected
          ? 'var(--vscode-focusBorder, #007acc)'
          : visual.borderColor}`,
        background: visual.background,
        minWidth: 160,
        maxWidth: 240,
        cursor: 'pointer',
      }}
    >
      {nodeType === 'c4-database' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              top: 4,
              height: 10,
              borderRadius: 999,
              border: `2px solid ${visual.borderColor}`,
              borderBottom: 'none',
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 4,
              height: 10,
              borderRadius: 999,
              border: `2px solid ${visual.borderColor}`,
              borderTop: 'none',
              opacity: 0.65,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* 削除ボタン（ホバー時表示） */}
      {showDelete && !isEditing && (
        <button
          className="nopan nodrag nowheel"
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          title="削除"
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
            color: 'var(--vscode-errorForeground, #f48771)',
            border: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          ×
        </button>
      )}

      <Handle id="c4-in-left" type="target" position={Position.Top} style={{ ...SIDE_HANDLE_STYLE, left: '30%' }} />
      <Handle id="c4-in-center" type="target" position={Position.Top} />
      <Handle id="c4-in-right" type="target" position={Position.Top} style={{ ...SIDE_HANDLE_STYLE, left: '70%' }} />

      {/* ラベル: 編集中 / 表示切替 */}
      {isEditing ? (
        <input
          autoFocus
          className="nopan nodrag"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
          }}
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box' as const,
            fontSize: 13,
            fontWeight: 'bold',
            background: 'var(--vscode-input-background, #3c3c3c)',
            color: 'var(--vscode-input-foreground, #d4d4d4)',
            border: '1px solid var(--vscode-focusBorder, #007acc)',
            borderRadius: 3,
            padding: '2px 4px',
            outline: 'none',
          }}
        />
      ) : (
        <div
          onDoubleClick={startEdit}
          title="ダブルクリックで編集 / 右クリックでメニュー"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 'bold',
            color: 'var(--vscode-editor-foreground, #d4d4d4)',
            fontSize: 13,
            cursor: 'text',
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>{visual.icon}</span>
          <span>{d.label}</span>
        </div>
      )}

      {d.technology && (
        <Badge variant="outline" style={{ marginTop: 4, fontSize: 10 }}>
          {d.technology}
        </Badge>
      )}

      {d.description && (
        <div style={{
          marginTop: 4,
          fontSize: 11,
          color: 'var(--vscode-descriptionForeground, #9d9d9d)',
          lineHeight: 1.4,
        }}>
          {d.description}
        </div>
      )}

      <Handle id="c4-out-left" type="source" position={Position.Bottom} style={{ ...SIDE_HANDLE_STYLE, left: '30%' }} />
      <Handle id="c4-out-center" type="source" position={Position.Bottom} />
      <Handle id="c4-out-right" type="source" position={Position.Bottom} style={{ ...SIDE_HANDLE_STYLE, left: '70%' }} />
    </div>
  );
}
