import { useEffect, useMemo, useState, type CSSProperties } from 'react';

interface MermaidImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (source: string) => { ok: true; importedNodeCount: number } | { ok: false; error: string };
}

export function MermaidImportDialog({ open, onClose, onImport }: MermaidImportDialogProps) {
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setImportedCount(null);
  }, [open]);

  const disabled = useMemo(() => !source.trim(), [source]);

  if (!open) {
    return null;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginBottom: 8, fontSize: 14 }}>Mermaid Input</h3>
        <p style={{ fontSize: 11, opacity: 0.85, marginBottom: 8 }}>
          Supported: <code>mindmap</code> and simple <code>graph TD</code> with <code>--&gt;</code> edges.
        </p>
        <textarea
          value={source}
          onChange={(event) => setSource(event.target.value)}
          spellCheck={false}
          style={textareaStyle}
        />
        {error && (
          <div style={errorStyle}>
            {error}
          </div>
        )}
        {importedCount !== null && !error && (
          <div style={okStyle}>
            Imported {importedCount} nodes.
          </div>
        )}
        <div style={buttonRowStyle}>
          <button onClick={onClose} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button
            onClick={() => {
              const result = onImport(source);
              if (!result.ok) {
                setError(result.error);
                setImportedCount(null);
                return;
              }
              setError(null);
              setImportedCount(result.importedNodeCount);
              onClose();
            }}
            disabled={disabled}
            style={{
              ...primaryButtonStyle,
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 20,
};

const dialogStyle: CSSProperties = {
  width: 'min(760px, 92vw)',
  background: 'var(--vscode-editor-background, #1e1e1e)',
  border: '1px solid var(--vscode-panel-border, #454545)',
  borderRadius: 8,
  padding: 12,
  boxShadow: '0 10px 32px rgba(0, 0, 0, 0.4)',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 260,
  resize: 'vertical',
  borderRadius: 6,
  border: '1px solid var(--vscode-input-border, #5a5a5a)',
  background: 'var(--vscode-input-background, #3c3c3c)',
  color: 'var(--vscode-input-foreground, #d4d4d4)',
  fontFamily: 'var(--vscode-editor-font-family, Consolas, monospace)',
  fontSize: 12,
  padding: 10,
  outline: 'none',
};

const buttonRowStyle: CSSProperties = {
  marginTop: 10,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 6,
  padding: '6px 14px',
  fontSize: 12,
  background: 'var(--vscode-button-background, #0e639c)',
  color: 'var(--vscode-button-foreground, #ffffff)',
};

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid var(--vscode-panel-border, #454545)',
  borderRadius: 6,
  padding: '6px 14px',
  fontSize: 12,
  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
  color: 'var(--vscode-button-secondaryForeground, #cccccc)',
  cursor: 'pointer',
};

const errorStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  color: 'var(--vscode-errorForeground, #f48771)',
};

const okStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  color: '#34d399',
};
