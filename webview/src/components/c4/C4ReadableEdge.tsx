import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

interface C4ReadableEdgeData {
  pathOffset?: number;
  routeOffset?: number;
  labelOffset?: number;
  labelAlongOffset?: number;
  bendYOffset?: number;
}

export function C4ReadableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerStart,
  markerEnd,
  selected,
  style,
  data,
}: EdgeProps) {
  const payload = (data as C4ReadableEdgeData | undefined) ?? {};
  const pathOffset = payload.pathOffset ?? 0;
  const routeOffset = payload.routeOffset ?? 26;
  const labelOffset = payload.labelOffset ?? (pathOffset === 0 ? 0 : Math.sign(pathOffset) * 14);
  const labelAlongOffset = payload.labelAlongOffset ?? 0;
  const bendYOffset = payload.bendYOffset ?? 0;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const nx = -dy / length;
  const ny = dx / length;
  const tx = dx / length;
  const ty = dy / length;

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    centerY: (sourceY + targetY) / 2 + bendYOffset,
    borderRadius: 14,
    offset: routeOffset,
  });

  const finalLabelX = labelX + nx * labelOffset + tx * labelAlongOffset;
  const finalLabelY = labelY + ny * labelOffset + ty * labelAlongOffset;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 3.4 : style?.strokeWidth ?? 2.8,
        }}
      />
      {typeof label === 'string' && label.trim() && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${finalLabelX}px, ${finalLabelY}px)`,
              pointerEvents: 'none',
              zIndex: 50,
              padding: '2px 8px',
              borderRadius: 999,
              border: '1px solid var(--vscode-panel-border, #454545)',
              background: 'var(--vscode-editorWidget-background, #252526)',
              color: 'var(--vscode-editor-foreground, #d4d4d4)',
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
