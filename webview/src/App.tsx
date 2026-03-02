import { useState, useCallback } from 'react';
import './App.css';
import './styles/theme.css';
import { AriaCanvas }       from './components/canvas/AriaCanvas';
import { KanbanBoard }      from './components/kanban/KanbanBoard';
import { AriaToolbar }      from './components/toolbar/AriaToolbar';
import { TabBar }           from './components/layout/TabBar';
import type { TabId }       from './components/layout/TabBar';
import { AdrPanel }         from './components/adr/AdrPanel';
import { LoadingSkeleton }  from './components/ui/LoadingSkeleton';
import { ErrorBanner }      from './components/ui/ErrorBanner';
import { WelcomeScreen }    from './components/ui/WelcomeScreen';
import { RuleGuideModal }   from './components/ui/RuleGuideModal';
import { ContextMenuProvider } from './components/context-menu/ContextMenu';
import { postToExtension, useExtensionMessages } from './hooks/use-vscode-bridge';
import { I18nProvider } from './i18n/i18n-context';
import { useAriaStore }     from './store/aria-store';
import type { ExtensionToWebviewMessage } from '../../src/shared/types';
import {
  translate,
  type ConfiguredLocale,
  type I18nSnapshot,
} from '../../src/shared/i18n/runtime';

function App() {
  const setState = useAriaStore((s) => s.setState);
  const addTask  = useAriaStore((s) => s.addTask);
  const nodes    = useAriaStore((s) => s.nodes);
  const tasksMap = useAriaStore((s) => s.tasks);

  const [isReady,   setIsReady]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('c4');
  const [isRuleGuideOpen, setRuleGuideOpen] = useState(false);
  const [i18nSnapshot, setI18nSnapshot] = useState<I18nSnapshot>({
    configuredLocale: 'auto',
    resolvedLocale: 'en',
  });

  const dismissError = useCallback(() => setError(null), []);
  const onLocaleChange = useCallback((locale: ConfiguredLocale) => {
    postToExtension({
      type: 'I18N_SET_LOCALE_REQUEST',
      payload: { locale },
    });
  }, []);

  // Extension Host からのメッセージを処理する
  useExtensionMessages((message: ExtensionToWebviewMessage) => {
    console.log(`[ARIA Webview] メッセージ受信: type=${message.type}`);
    switch (message.type) {
      case 'I18N_INIT':
      case 'I18N_LOCALE_CHANGED':
        setI18nSnapshot(message.payload);
        break;
      case 'INIT_STATE':
        console.log('[ARIA Webview] 初期化完了:', {
          taskCount: Object.keys(message.payload.tasks).length,
          nodeCount: message.payload.nodes.length,
        });
        setState(message.payload);
        setIsReady(true);
        break;
      case 'STATE_UPDATED':
        console.log('[ARIA Webview] State 更新:', {
          taskCount: Object.keys(message.payload.tasks).length,
          nodeCount: message.payload.nodes.length,
        });
        setState(message.payload);
        break;
      case 'ERROR':
        console.error('[ARIA Webview] Extension Error:', message.payload.message);
        setError(message.payload.message);
        break;
      case 'ADD_TASK':
        // VS Code キーバインド（Ctrl+N）経由 — DOM keydown リスナーは使わない
        // package.json の keybindings で when: "activeWebviewPanelId == 'ariaPanel'"
        // を指定することで VS Code のグローバルショートカットとの競合を防ぐ
        addTask(translate(i18nSnapshot.resolvedLocale, 'seed.task.new'));
        break;
      case 'MINDMAP_EXPORT_RESULT':
        if (!message.payload.ok) {
          setError(message.payload.message);
        }
        break;
      case 'OPEN_RULE_GUIDE':
        setRuleGuideOpen(true);
        break;
    }
  });

  return (
    <I18nProvider snapshot={i18nSnapshot}>
      {/* ローディング中はスケルトン表示 */}
      {!isReady ? (
        <LoadingSkeleton />
      ) : (
        <ContextMenuProvider>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflow: 'hidden',
            background: 'var(--vscode-editor-background, #1e1e1e)',
            color: 'var(--vscode-editor-foreground, #d4d4d4)',
          }}>
            {/* ツールバー（activeTab に応じてボタン切り替え） */}
            <AriaToolbar
              activeTab={activeTab}
              onOpenRuleGuide={() => setRuleGuideOpen(true)}
              configuredLocale={i18nSnapshot.configuredLocale}
              onLocaleChange={onLocaleChange}
            />

            {/* エラーバナー（5秒自動消去） */}
            {error && <ErrorBanner message={error} onDismiss={dismissError} />}

            {/* メインコンテンツ: データ空 → ウェルカム画面、それ以外 → タブ表示 */}
            {nodes.length === 0 && Object.keys(tasksMap).length === 0 ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <WelcomeScreen />
              </div>
            ) : (
              <>
                {/* タブバー: C4アーキテクチャ / ADR / セマンティックネットワーク / タスクリスト */}
                <TabBar activeTab={activeTab} onChange={setActiveTab} />

                {/* タブコンテンツ: flex:1 で残り全高を占有する */}
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {activeTab === 'c4'      && <AriaCanvas canvasType="c4" />}
                  {activeTab === 'adr'     && <AdrPanel />}
                  {activeTab === 'mindmap' && <AriaCanvas canvasType="mindmap" />}
                  {activeTab === 'kanban'  && <KanbanBoard />}
                </div>
              </>
            )}

            <RuleGuideModal open={isRuleGuideOpen} onClose={() => setRuleGuideOpen(false)} />
          </div>
        </ContextMenuProvider>
      )}
    </I18nProvider>
  );
}

export default App;
