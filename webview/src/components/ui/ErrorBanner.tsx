// ============================================================
// ErrorBanner.tsx — エラー通知バナー（5秒自動消去）
// ============================================================

import { useEffect } from 'react';
import { useI18n } from '../../i18n/i18n-context';

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function ErrorBanner({ message, onDismiss, autoDismissMs = 5000 }: ErrorBannerProps) {
  const { t } = useI18n();
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs]);

  return (
    <div style={{
      position: 'fixed',
      top: 40,           // ツールバー（height:40）の直下
      left: 0,
      right: 0,
      background: 'var(--vscode-statusBarItem-errorBackground, #c72e0f)',
      color: 'var(--vscode-statusBarItem-errorForeground, #ffffff)',
      padding: '8px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 9999,
      fontSize: 12,
    }}>
      <span>⚠️ {message}</span>
      <button
        onClick={onDismiss}
        title={t('wv.error.close_title')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          fontSize: 16,
          lineHeight: 1,
          padding: '0 4px',
        }}
      >
        ×
      </button>
    </div>
  );
}
