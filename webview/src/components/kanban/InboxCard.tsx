// ============================================================
// InboxCard.tsx — Inbox 列専用カード（削除UI・右クリックメニュー対応）
// ============================================================

import { useState } from 'react';
import type { KanbanTask } from '../../../../src/shared/types';
import { useAriaStore } from '../../store/aria-store';
import { useContextMenu } from '../context-menu/ContextMenu';

interface InboxCardProps {
  task: KanbanTask;
  draggable?: boolean;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
}

export function InboxCard({
  task,
  draggable = false,
  onDragStart,
  onDragEnd,
}: InboxCardProps) {
  const nodes            = useAriaStore((s) => s.nodes);
  const updateTaskStatus = useAriaStore((s) => s.updateTaskStatus);
  const updateTask       = useAriaStore((s) => s.updateTask);
  const linkTaskToNode   = useAriaStore((s) => s.linkTaskToNode);
  const deleteTask       = useAriaStore((s) => s.deleteTask);
  const { openContextMenu } = useContextMenu();

  const [showDelete, setShowDelete] = useState(false);
  const [isEditing,  setIsEditing]  = useState(false);
  const [editValue,  setEditValue]  = useState(task.title);
  const [editNote,   setEditNote]   = useState(task.note ?? '');

  const handleApprove = () => {
    updateTaskStatus(task.id, 'Todo');
  };

  const handleLinkNode = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nodeId = e.target.value;
    if (nodeId) linkTaskToNode(task.id, nodeId);
  };

  const startEdit = () => {
    setEditValue(task.title);
    setEditNote(task.note ?? '');
    setIsEditing(true);
  };

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    const nextTitle = trimmed || task.title;
    const nextNote = editNote.trim() ? editNote : undefined;
    const hasChanged = nextTitle !== task.title || nextNote !== task.note;

    if (!hasChanged) {
      setEditValue(task.title);
      setEditNote(task.note ?? '');
      return;
    }
    updateTask(task.id, { title: nextTitle, note: nextNote });
  };

  const cancelEdit = () => {
    setEditValue(task.title);
    setEditNote(task.note ?? '');
    setIsEditing(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY, [
      { icon: '✏️', label: 'タイトルを編集', onClick: startEdit },
      { icon: '✓',  label: 'Todo へ承認',    onClick: () => updateTaskStatus(task.id, 'Todo') },
      { separator: true, label: '', onClick: () => {} },
      { icon: '🗑', label: '削除',             onClick: () => deleteTask(task.id), danger: true },
    ]);
  };

  return (
    <div
      draggable={draggable && !isEditing}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/task-id', task.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart?.(task.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      style={{
        position: 'relative',
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid #d97706',
        background: 'var(--vscode-editor-background, #1e1e1e)',
        fontSize: 12,
      }}
    >
      {/* 削除ボタン（ホバー時表示） */}
      {showDelete && !isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
          title="削除"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
            color: 'var(--vscode-errorForeground, #f48771)',
            border: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
            cursor: 'pointer',
            fontSize: 11,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          ×
        </button>
      )}

      {/* タイトル */}
      {isEditing ? (
        <>
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box' as const,
              fontSize: 12,
              background: 'var(--vscode-input-background, #3c3c3c)',
              color: 'var(--vscode-input-foreground, #d4d4d4)',
              border: '1px solid var(--vscode-focusBorder, #007acc)',
              borderRadius: 3,
              padding: '2px 4px',
              marginBottom: 6,
              outline: 'none',
            }}
          />
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            placeholder="メモ"
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box' as const,
              fontSize: 11,
              minHeight: 52,
              resize: 'vertical',
              background: 'var(--vscode-input-background, #3c3c3c)',
              color: 'var(--vscode-input-foreground, #d4d4d4)',
              border: '1px solid var(--vscode-dropdown-border, #454545)',
              borderRadius: 3,
              padding: '4px 6px',
              marginBottom: 6,
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <button
              onClick={commitEdit}
              style={{
                flex: 1,
                fontSize: 10,
                padding: '2px 4px',
                borderRadius: 3,
                border: 'none',
                background: 'var(--vscode-button-background, #0e639c)',
                color: 'var(--vscode-button-foreground, #ffffff)',
                cursor: 'pointer',
              }}
            >
              保存
            </button>
            <button
              onClick={cancelEdit}
              style={{
                flex: 1,
                fontSize: 10,
                padding: '2px 4px',
                borderRadius: 3,
                border: '1px solid var(--vscode-dropdown-border, #454545)',
                background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                color: 'var(--vscode-button-secondaryForeground, #d4d4d4)',
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
          </div>
        </>
      ) : (
        <div
          onDoubleClick={startEdit}
          title="ダブルクリックで編集 / 右クリックでメニュー"
          style={{
            color: 'var(--vscode-editor-foreground, #d4d4d4)',
            marginBottom: 6,
            wordBreak: 'break-all',
            paddingRight: showDelete ? 20 : 0,
            cursor: 'text',
          }}
        >
          {task.title}
        </div>
      )}

      {!isEditing && task.note && (
        <div
          title={task.note}
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            marginBottom: 6,
            color: 'var(--vscode-editor-foreground, #d4d4d4)',
            background: 'rgba(127,127,127,0.12)',
            border: '1px solid var(--vscode-panel-border, #454545)',
            borderRadius: 4,
            padding: '4px 6px',
            whiteSpace: 'pre-wrap',
            maxHeight: 76,
            overflow: 'auto',
          }}
        >
          📝 {task.note}
        </div>
      )}

      {/* ノード紐付けドロップダウン（ノードが存在する場合のみ表示） */}
      {nodes.length > 0 && (
        <select
          onChange={handleLinkNode}
          defaultValue=""
          style={{
            width: '100%',
            fontSize: 11,
            background: 'var(--vscode-dropdown-background, #3c3c3c)',
            color: 'var(--vscode-dropdown-foreground, #d4d4d4)',
            border: '1px solid var(--vscode-dropdown-border, #454545)',
            padding: '2px 4px',
            marginBottom: 6,
            borderRadius: 3,
          }}
        >
          <option value="">ノードに紐付ける...</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.data.label}
            </option>
          ))}
        </select>
      )}

      {/* 承認ボタン */}
      <button
        onClick={handleApprove}
        style={{
          width: '100%',
          background: '#16a34a',
          color: '#ffffff',
          border: 'none',
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        ✓ 承認して Todo へ
      </button>
    </div>
  );
}
