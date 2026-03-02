import { Panel } from '@xyflow/react';
import { useAriaStore } from '../../store/aria-store';

export function BreadcrumbNav() {
  const currentLayer = useAriaStore((s) => s.currentLayer);
  const breadcrumb = useAriaStore((s) => s.breadcrumb);

  if (currentLayer !== 'container') {
    return null;
  }

  const current = breadcrumb[breadcrumb.length - 1];
  const label = current?.label ?? 'コンテナ';

  return (
    <Panel
      position="top-left"
      style={{
        marginTop: 42,
        background: 'var(--vscode-editorWidget-background, rgba(37,37,38,0.95))',
        border: '1px solid var(--vscode-widget-border, #454545)',
        borderRadius: 6,
        padding: '6px 10px',
        color: 'var(--vscode-editor-foreground, #d4d4d4)',
        fontSize: 11,
        pointerEvents: 'none',
      }}
    >
      <span style={{ opacity: 0.85 }}>🏗 コンテキスト</span>
      <span style={{ opacity: 0.55, margin: '0 6px' }}>›</span>
      <span style={{ fontWeight: 600 }}>{label}</span>
    </Panel>
  );
}
