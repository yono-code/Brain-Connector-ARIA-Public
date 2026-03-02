import { useEffect, useMemo, useState } from 'react';
import { useViewport } from '@xyflow/react';
import type { AriaEdge, AriaNode } from '../../../../src/shared/types';

interface EdgeLabelEditorProps {
  edge: AriaEdge | null;
  nodes: AriaNode[];
  onCommit: (value: string) => void;
  onClose: () => void;
}

export function EdgeLabelEditor({ edge, nodes, onCommit, onClose }: EdgeLabelEditorProps) {
  const viewport = useViewport();
  const [value, setValue] = useState(edge?.label ?? '');

  useEffect(() => {
    setValue(edge?.label ?? '');
  }, [edge?.id, edge?.label]);

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
        padding: 6,
        display: 'flex',
        gap: 6,
        zIndex: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="リレーションラベル"
        style={{
          width: 180,
          background: 'var(--vscode-input-background, #3c3c3c)',
          color: 'var(--vscode-input-foreground, #d4d4d4)',
          border: '1px solid var(--vscode-input-border, #3c3c3c)',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 11,
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit(value);
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <button
        onClick={() => onCommit(value)}
        style={{
          background: 'var(--vscode-button-background, #0e639c)',
          color: 'var(--vscode-button-foreground, #ffffff)',
          border: 'none',
          borderRadius: 4,
          padding: '2px 8px',
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        保存
      </button>
    </div>
  );
}
