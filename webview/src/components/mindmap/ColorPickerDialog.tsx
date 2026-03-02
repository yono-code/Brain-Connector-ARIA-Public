import { useEffect, useMemo, useState } from 'react';
import { M13_COLOR_PRESETS } from './mindmap-style';

interface ColorPickerDialogProps {
  initialColor?: string;
  onClose: () => void;
  onSave: (hex: string) => void;
}

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function ColorPickerDialog({ initialColor, onClose, onSave }: ColorPickerDialogProps) {
  const [value, setValue] = useState(initialColor ?? '#1F6FEB');
  const [showSimilarityWarning, setShowSimilarityWarning] = useState(false);
  const isValid = useMemo(() => HEX_COLOR_PATTERN.test(value), [value]);

  useEffect(() => {
    if (initialColor) {
      setValue(initialColor);
    }
  }, [initialColor]);

  const handlePrimarySave = () => {
    if (!isValid) {
      return;
    }
    if (!M13_COLOR_PRESETS.includes(value.toUpperCase() as (typeof M13_COLOR_PRESETS)[number])) {
      setShowSimilarityWarning(true);
      return;
    }
    onSave(value.toUpperCase());
  };

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
          width: 'min(400px, 92vw)',
          background: 'var(--vscode-editorWidget-background, #252526)',
          border: '1px solid var(--vscode-panel-border, #454545)',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700 }}>
          カスタムカラー
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="color"
            value={isValid ? value : '#1F6FEB'}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            style={{ width: 48, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }}
          />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="#RRGGBB"
            style={{
              flex: 1,
              background: 'var(--vscode-input-background, #3c3c3c)',
              color: 'var(--vscode-input-foreground, #d4d4d4)',
              border: '1px solid var(--vscode-input-border, #3c3c3c)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
            }}
          />
        </div>
        {!isValid && (
          <div style={{ fontSize: 11, color: 'var(--vscode-errorForeground, #f48771)' }}>
            #RRGGBB 形式で入力してください。
          </div>
        )}
        {showSimilarityWarning && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--vscode-editorWarning-foreground, #cca700)',
              border: '1px solid var(--vscode-editorWarning-border, #b89500)',
              background: 'var(--vscode-editorWarning-background, rgba(204,167,0,0.12))',
              borderRadius: 6,
              padding: 8,
            }}
          >
            類似配色の可能性があります。非模倣方針を確認した上で保存してください。
          </div>
        )}
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
            onClick={() => {
              if (!showSimilarityWarning) {
                handlePrimarySave();
                return;
              }
              if (isValid) {
                onSave(value.toUpperCase());
              }
            }}
            style={{
              background: 'var(--vscode-button-background, #0e639c)',
              color: 'var(--vscode-button-foreground, #ffffff)',
              border: 'none',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: isValid ? 'pointer' : 'not-allowed',
              opacity: isValid ? 1 : 0.6,
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
