import { useEffect, useMemo, useState } from 'react';
import { useViewport } from '@xyflow/react';
import type { AriaEdge, AriaNode } from '../../../../src/shared/types';

interface C4EdgeEditorProps {
  edge: AriaEdge | null;
  nodes: AriaNode[];
  onCommit: (
    patch: Partial<Pick<AriaEdge, 'label' | 'variant' | 'sourceLabel' | 'targetLabel'>>,
  ) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function C4EdgeEditor({
  edge,
  nodes,
  onCommit,
  onDelete,
  onClose,
}: C4EdgeEditorProps) {
  const viewport = useViewport();
  const [variant, setVariant] = useState<NonNullable<AriaEdge['variant']>>('single-forward');
  const [label, setLabel] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [targetLabel, setTargetLabel] = useState('');

  useEffect(() => {
    if (!edge) {
      return;
    }
    setVariant(edge.variant ?? 'single-forward');
    setLabel(edge.label ?? '');
    setSourceLabel(edge.sourceLabel ?? '');
    setTargetLabel(edge.targetLabel ?? '');
  }, [edge?.id, edge?.label, edge?.sourceLabel, edge?.targetLabel, edge?.variant]);

  const position = useMemo(() => {
    if (!edge) return null;
    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    if (!sourceNode || !targetNode) return null;

    const worldX = (sourceNode.position.x + targetNode.position.x) / 2;
    const worldY = (sourceNode.position.y + targetNode.position.y) / 2;
    return {
      left: worldX * viewport.zoom + viewport.x,
      top: worldY * viewport.zoom + viewport.y,
    };
  }, [edge, nodes, viewport.x, viewport.y, viewport.zoom]);

  if (!edge || !position) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: position.left,
        top: position.top - 24,
        transform: 'translate(-50%, -100%)',
        background: 'var(--vscode-editorWidget-background, #252526)',
        border: '1px solid var(--vscode-panel-border, #454545)',
        borderRadius: 6,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 260,
        zIndex: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
        <span>ライン種別</span>
        <select
          value={variant}
          onChange={(event) => setVariant(event.target.value as NonNullable<AriaEdge['variant']>)}
          style={inputStyle}
        >
          <option value="single-forward">片方向</option>
          <option value="single-reverse">片方向（逆向き）</option>
          <option value="double-headed">両端矢印</option>
          <option value="double-parallel">2本双方向</option>
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
        <span>ラベル</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          style={inputStyle}
        />
      </label>

      {variant === 'double-parallel' && (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
            <span>{edge.source} → {edge.target}</span>
            <input
              value={sourceLabel}
              onChange={(event) => setSourceLabel(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
            <span>{edge.target} → {edge.source}</span>
            <input
              value={targetLabel}
              onChange={(event) => setTargetLabel(event.target.value)}
              style={inputStyle}
            />
          </label>
        </>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onCommit({
            variant,
            label,
            sourceLabel: variant === 'double-parallel' ? sourceLabel : undefined,
            targetLabel: variant === 'double-parallel' ? targetLabel : undefined,
          })}
          style={{
            ...buttonStyle,
            background: 'var(--vscode-button-background, #0e639c)',
            color: 'var(--vscode-button-foreground, #ffffff)',
          }}
        >
          保存
        </button>
        <button
          onClick={onDelete}
          style={{
            ...buttonStyle,
            background: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
            color: 'var(--vscode-errorForeground, #f48771)',
          }}
        >
          削除
        </button>
        <button
          onClick={onClose}
          style={{
            ...buttonStyle,
            background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
            color: 'var(--vscode-button-secondaryForeground, #d4d4d4)',
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--vscode-input-background, #3c3c3c)',
  color: 'var(--vscode-input-foreground, #d4d4d4)',
  border: '1px solid var(--vscode-input-border, #3c3c3c)',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 11,
};

const buttonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 4,
  padding: '3px 9px',
  cursor: 'pointer',
  fontSize: 11,
};
