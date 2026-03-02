// ============================================================
// KanbanCard.tsx — カンバンカード（削除UI・右クリックメニュー対応）
// ============================================================

import { useState } from 'react';
import type { KanbanTask, TaskStatus } from '../../../../src/shared/types';
import { useAriaStore } from '../../store/aria-store';
import { useContextMenu } from '../context-menu/ContextMenu';
import { isDueDateOverdue } from './task-date-utils';

interface KanbanCardProps {
  task: KanbanTask;
}

const STATUS_OPTIONS: TaskStatus[] = ['Inbox', 'Todo', 'In Progress', 'Done'];

export function KanbanCard({ task }: KanbanCardProps) {
  const updateTaskStatus = useAriaStore((s) => s.updateTaskStatus);
  const updateTask = useAriaStore((s) => s.updateTask);
  const deleteTask = useAriaStore((s) => s.deleteTask);
  const { openContextMenu } = useContextMenu();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [editStartDate, setEditStartDate] = useState(task.startDate ?? '');
  const [editDueDate, setEditDueDate] = useState(task.dueDate ?? '');
  const [showDelete, setShowDelete] = useState(false);

  const startEdit = () => {
    setEditValue(task.title);
    setEditStartDate(task.startDate ?? '');
    setEditDueDate(task.dueDate ?? '');
    setIsEditing(true);
  };

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    const nextTitle = trimmed || task.title;
    const nextStartDate = editStartDate || undefined;
    const nextDueDate = editDueDate || undefined;

    const hasChanges =
      nextTitle !== task.title ||
      nextStartDate !== task.startDate ||
      nextDueDate !== task.dueDate;

    if (hasChanges) {
      updateTask(task.id, {
        title: nextTitle,
        startDate: nextStartDate,
        dueDate: nextDueDate,
      });
    }
  };

  const cancelEdit = () => {
    setEditValue(task.title);
    setEditStartDate(task.startDate ?? '');
    setEditDueDate(task.dueDate ?? '');
    setIsEditing(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const otherStatuses = STATUS_OPTIONS.filter((s) => s !== task.status);
    openContextMenu(e.clientX, e.clientY, [
      { icon: '✏️', label: 'タイトルを編集', onClick: startEdit },
      { separator: true, label: '', onClick: () => { } },
      ...otherStatuses.map((status) => ({
        icon: '→',
        label: status,
        onClick: () => updateTaskStatus(task.id, status),
      })),
      { separator: true, label: '', onClick: () => { } },
      { icon: '🗑', label: '削除', onClick: () => deleteTask(task.id), danger: true },
    ]);
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      style={{
        position: 'relative',
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid var(--vscode-panel-border, #454545)',
        background: 'var(--vscode-editor-background, #1e1e1e)',
        fontSize: 12,
        cursor: 'default',
      }}
    >
      {/* 削除ボタン（ホバー時表示、編集中は非表示） */}
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

      {/* タイトル部分: 通常表示 / 編集中を切り替える */}
      {isEditing ? (
        <>
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
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
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
              <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground, #9d9d9d)' }}>開始日</span>
              <input
                aria-label="開始日"
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                }}
                style={{
                  fontSize: 10,
                  background: 'var(--vscode-input-background, #3c3c3c)',
                  color: 'var(--vscode-input-foreground, #d4d4d4)',
                  border: '1px solid var(--vscode-dropdown-border, #454545)',
                  borderRadius: 3,
                  padding: '1px 2px',
                  width: '100%',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
              <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground, #9d9d9d)' }}>納期</span>
              <input
                aria-label="納期"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                }}
                style={{
                  fontSize: 10,
                  background: 'var(--vscode-input-background, #3c3c3c)',
                  color: 'var(--vscode-input-foreground, #d4d4d4)',
                  border: '1px solid var(--vscode-dropdown-border, #454545)',
                  borderRadius: 3,
                  padding: '1px 2px',
                  width: '100%',
                }}
              />
            </label>
          </div>
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
            cursor: 'text',
            minHeight: 18,
            wordBreak: 'break-all' as const,
            paddingRight: showDelete ? 20 : 0,
          }}
        >
          {task.title}
        </div>
      )}

      {/* 日付表示（非編集中のみ） */}
      {!isEditing && (task.startDate || task.dueDate) && (
        <div style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground, #9d9d9d)', marginBottom: 6 }}>
          {task.startDate && <span>📅 {task.startDate}</span>}
          {task.startDate && task.dueDate && <span> 〜 </span>}
          {task.dueDate && (
            <span className={task.status !== 'Done' && isDueDateOverdue(task.dueDate) ? 'text-destructive font-bold text-red-400' : ''}>
              {task.dueDate}
            </span>
          )}
        </div>
      )}

      {/* ステータス変更セレクト */}
      <select
        value={task.status}
        onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
        style={{
          fontSize: 11,
          background: 'var(--vscode-dropdown-background, #3c3c3c)',
          color: 'var(--vscode-dropdown-foreground, #d4d4d4)',
          border: '1px solid var(--vscode-dropdown-border, #454545)',
          borderRadius: 4,
          padding: '2px 4px',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
