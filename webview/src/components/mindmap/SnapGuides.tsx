import { useViewport } from '@xyflow/react';

export interface SnapGuide {
  axis: 'x' | 'y';
  value: number;
}

interface SnapGuidesProps {
  guides: SnapGuide[];
}

export function SnapGuides({ guides }: SnapGuidesProps) {
  const viewport = useViewport();

  if (guides.length === 0) {
    return null;
  }

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {guides.map((guide, index) => {
        if (guide.axis === 'x') {
          const x = guide.value * viewport.zoom + viewport.x;
          return (
            <line
              key={`x-${index}`}
              x1={x}
              x2={x}
              y1={0}
              y2="100%"
              stroke="var(--vscode-textLink-foreground, #4a9eff)"
              strokeWidth={1}
              strokeDasharray="6 4"
            />
          );
        }

        const y = guide.value * viewport.zoom + viewport.y;
        return (
          <line
            key={`y-${index}`}
            x1={0}
            x2="100%"
            y1={y}
            y2={y}
            stroke="var(--vscode-textLink-foreground, #4a9eff)"
            strokeWidth={1}
            strokeDasharray="6 4"
          />
        );
      })}
    </svg>
  );
}
