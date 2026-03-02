// ============================================================
// KanbanBoard.tsx — カンバンボード（Inbox 列は InboxCard を使用）
// ============================================================

import { useState, useEffect } from 'react';
import type { TaskStatus } from '../../../../src/shared/types';
import { useAriaStore } from '../../store/aria-store';
import { KanbanCard } from './KanbanCard';
import { InboxCard } from './InboxCard';
import { shouldHideOldDoneTask } from './task-date-utils';

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'Inbox', label: '📥 Inbox', color: '#d97706' },
  { id: 'Todo', label: '⬜ Todo', color: '#6b7280' },
  { id: 'In Progress', label: '🔵 In Progress', color: '#2563eb' },
  { id: 'Done', label: '✅ Done', color: '#16a34a' },
];

export function KanbanBoard() {
  // セレクタは安定した参照（tasks オブジェクト自体）を返す。
  // Object.values() をセレクタ内で呼ぶと毎回新しい配列参照を返すため
  // useSyncExternalStore が無限ループに陥る（React 19 + zustand@5）。
  const tasksMap = useAriaStore((s) => s.tasks);
  const tasks = Object.values(tasksMap);
  const addTask = useAriaStore((s) => s.addTask);

  const [filterOld, setFilterOld] = useState(() => {
    const saved = localStorage.getItem('aria.kanban.hideOldDone');
    return saved !== 'false'; // デフォルトは true（非表示）
  });

  useEffect(() => {
    localStorage.setItem('aria.kanban.hideOldDone', filterOld.toString());
  }, [filterOld]);

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: 12,
      overflowX: 'auto',
      height: '100%',
      background: 'var(--vscode-sideBar-background, #252526)',
    }}>
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id && !shouldHideOldDoneTask(t, filterOld));
        return (
          <div key={col.id} style={{ minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* カラムヘッダー */}
            <div style={{
              fontWeight: 'bold',
              fontSize: 12,
              color: col.color,
              paddingBottom: 8,
              borderBottom: `2px solid ${col.color}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              <span>
                {col.label}
                {col.id === 'Done' && (
                  <button
                    onClick={() => setFilterOld(!filterOld)}
                    style={{
                      background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
                      fontSize: 10, padding: 0, marginLeft: 6, opacity: 0.8
                    }}
                  >
                    {filterOld ? '🔽 一部非表示' : '🔼 全て表示'}
                  </button>
                )}
              </span>
              <span style={{ opacity: 0.7 }}>({colTasks.length})</span>
            </div>

            {/* タスクカード一覧: Inbox 列は InboxCard、それ以外は KanbanCard */}
            {colTasks.map((task) =>
              col.id === 'Inbox'
                ? <InboxCard key={task.id} task={task} />
                : <KanbanCard key={task.id} task={task} />
            )}

            {/* Todo 列にのみタスク追加ボタンを表示する */}
            {col.id === 'Todo' && (
              <button
                onClick={() => addTask('新しいタスク')}
                style={{
                  marginTop: 4,
                  padding: '4px 8px',
                  fontSize: 11,
                  background: 'transparent',
                  border: '1px dashed var(--vscode-panel-border, #454545)',
                  color: 'var(--vscode-descriptionForeground, #9d9d9d)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                + タスクを追加
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
