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

export function C4ContainerNode({ id, data, selected, type }: NodeProps) {
  const d = data as C4NodeData;
  const deleteNode = useAriaStore((s) => s.deleteNode);
  const deleteContainerNode = useAriaStore((s) => s.deleteContainerNode);
  const addADR = useAriaStore((s) => s.addADR);
  const enterContainerLayer = useAriaStore((s) => s.enterContainerLayer);
  const currentLayer = useAriaStore((s) => s.currentLayer);
  const activeContainerId = useAriaStore((s) => s.activeContainerId);
  const updateNodeData = useAriaStore((s) => s.updateNodeData);
  const { openContextMenu } = useContextMenu();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(d.label);
  const [showDelete, setShowDelete] = useState(false);

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
    const safeType: AriaNode['type'] =
      type === 'c4-container' ? 'c4-container'
      : type === 'c4-component' ? 'c4-component'
      : 'c4-component';

    const items = buildC4ContextMenuItems({
      id,
      label: d.label,
      type: safeType,
      currentLayer,
      onStartEdit: startEdit,
      onAddAdr: addADR,
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
      style={{
        position: 'relative',
        padding: 12,
        borderRadius: 8,
        border: `2px solid ${selected
          ? 'var(--vscode-focusBorder, #007acc)'
          : 'var(--vscode-panel-border, #454545)'}`,
        background: 'var(--vscode-editor-background, #1e1e1e)',
        minWidth: 160,
        maxWidth: 240,
        cursor: 'pointer',
      }}
    >
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

      <Handle type="target" position={Position.Top} />

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
            fontWeight: 'bold',
            color: 'var(--vscode-editor-foreground, #d4d4d4)',
            fontSize: 13,
            cursor: 'text',
          }}
        >
          {d.label}
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

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
