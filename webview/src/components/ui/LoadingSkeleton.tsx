// ============================================================
// LoadingSkeleton.tsx — INIT_STATE 受信前のローディング表示
// ============================================================

import { useI18n } from '../../i18n/i18n-context';

export function LoadingSkeleton() {
  const { t } = useI18n();
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        @keyframes aria-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
      {[160, 220, 140].map((width, i) => (
        <div
          key={i}
          style={{
            width,
            height: 72,
            borderRadius: 8,
            background: 'var(--vscode-editor-inactiveSelectionBackground, #3a3d41)',
            animation: `aria-pulse 1.5s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
      <p style={{
        marginTop: 8,
        fontSize: 12,
        color: 'var(--vscode-descriptionForeground, #9d9d9d)',
        textAlign: 'center',
      }}>
        {t('wv.loading.message')}
      </p>
    </div>
  );
}
