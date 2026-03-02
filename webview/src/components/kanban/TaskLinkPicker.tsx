// ============================================================
// TaskLinkPicker.tsx — 既存タスクとの紐付けモーダル
// ============================================================

import { useEffect, useState } from 'react';
import { useAriaStore } from '../../store/aria-store';

interface TaskLinkPickerProps {
    nodeId: string;
    onClose: () => void;
}

export function TaskLinkPicker({ nodeId, onClose }: TaskLinkPickerProps) {
    const tasksMap = useAriaStore((s) => s.tasks);
    const linkTaskToNode = useAriaStore((s) => s.linkTaskToNode);

    const [hoveredId, setHoveredId] = useState<string | null>(null);

    // Todo または In Progress のタスクのみ表示
    const taskOptions = Object.values(tasksMap).filter(
        (t) => t.status === 'Todo' || t.status === 'In Progress'
    ).sort((a, b) => a.updatedAt > b.updatedAt ? -1 : 1);

    const handleSelect = (taskId: string) => {
        linkTaskToNode(taskId, nodeId);
        onClose();
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <>
            <div
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000 }}
                onClick={onClose}
            />
            <div style={{
                position: 'fixed',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'var(--vscode-editor-background, #1e1e1e)',
                border: '1px solid var(--vscode-dropdown-border, #454545)',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                width: 400,
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 2001,
            }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--vscode-dropdown-border, #454545)' }}>
                    <h3 style={{ margin: 0, fontSize: 13, color: 'var(--vscode-editor-foreground)' }}>🔗 既存タスクに紐付け</h3>
                </div>

                <div style={{ padding: 8, overflowY: 'auto', flex: 1, minHeight: 150 }}>
                    {taskOptions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--vscode-descriptionForeground)' }}>
                            紐付けられるタスクがありません
                        </div>
                    ) : (
                        taskOptions.map(task => {
                            const statusIcon = task.status === 'Todo' ? '⬜' : '🔵';
                            return (
                                <button
                                    key={task.id}
                                    onClick={() => handleSelect(task.id)}
                                    onMouseEnter={() => setHoveredId(task.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '8px 12px',
                                        margin: '2px 0',
                                        border: 'none',
                                        borderRadius: 4,
                                        background: hoveredId === task.id ? 'var(--vscode-list-activeSelectionBackground, #094771)' : 'transparent',
                                        color: 'var(--vscode-editor-foreground, #d4d4d4)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        outline: 'none',
                                    }}
                                >
                                    <span style={{ fontSize: 12 }}>{statusIcon}</span>
                                    <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {task.title}
                                    </span>
                                    {task.linkedNodeIds.includes(nodeId) && (
                                        <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', background: 'var(--vscode-badge-background, #4d4d4d)', padding: '2px 6px', borderRadius: 4 }}>紐付け済み</span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
}
