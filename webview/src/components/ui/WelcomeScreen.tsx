// ============================================================
// WelcomeScreen.tsx — 初回起動時（データ空）のガイダンス画面
// ============================================================

import { useAriaStore } from '../../store/aria-store';
import { useI18n } from '../../i18n/i18n-context';

export function WelcomeScreen() {
  const { t } = useI18n();
  const addNode = useAriaStore((s) => s.addNode);
  const addTask = useAriaStore((s) => s.addTask);

  const handleGetStarted = () => {
    addNode('c4-container', { x: 200, y: 150 }, t('seed.system.main'));
    addTask(t('seed.task.first'));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 16,
      padding: 32,
      color: 'var(--vscode-descriptionForeground, #9d9d9d)',
    }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🏗️</div>
      <h2 style={{
        color: 'var(--vscode-editor-foreground, #d4d4d4)',
        margin: 0,
        fontSize: 18,
      }}>
        {t('wv.welcome.title')}
      </h2>
      <p style={{
        textAlign: 'center',
        maxWidth: 360,
        lineHeight: 1.7,
        margin: 0,
        fontSize: 12,
      }}>
        {t('wv.welcome.description')}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={handleGetStarted}
          style={{
            background: 'var(--vscode-button-background, #0e639c)',
            color: 'var(--vscode-button-foreground, #ffffff)',
            border: 'none',
            borderRadius: 4,
            padding: '8px 20px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {t('wv.welcome.start_sample')}
        </button>
        <button
          onClick={() => addNode('c4-container', { x: 200, y: 150 }, t('seed.system.new'))}
          style={{
            background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
            color: 'var(--vscode-button-secondaryForeground, #cccccc)',
            border: 'none',
            borderRadius: 4,
            padding: '8px 20px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {t('wv.welcome.add_node')}
        </button>
      </div>
      <p style={{ fontSize: 11, margin: 0, opacity: 0.6 }}>
        {t('wv.welcome.hint')}
      </p>
    </div>
  );
}
