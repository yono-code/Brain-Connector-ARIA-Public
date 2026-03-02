import { useEffect, useState } from 'react';

interface NoteDialogProps {
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export function NoteDialog({ initialValue, onSave, onClose }: NoteDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          background: 'var(--vscode-editorWidget-background, #252526)',
          border: '1px solid var(--vscode-panel-border, #454545)',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700 }}>
          ノードメモ
        </div>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            minHeight: 140,
            resize: 'vertical',
            background: 'var(--vscode-input-background, #3c3c3c)',
            color: 'var(--vscode-input-foreground, #d4d4d4)',
            border: '1px solid var(--vscode-input-border, #3c3c3c)',
            borderRadius: 6,
            padding: 8,
            fontSize: 12,
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              onSave(value);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
              color: 'var(--vscode-button-secondaryForeground, #cccccc)',
              border: '1px solid var(--vscode-panel-border, #454545)',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave(value)}
            style={{
              background: 'var(--vscode-button-background, #0e639c)',
              color: 'var(--vscode-button-foreground, #ffffff)',
              border: 'none',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
