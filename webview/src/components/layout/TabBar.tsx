// ============================================================
// TabBar.tsx — メインコンテンツ タブ切り替えバー
// ============================================================

import { useAriaStore } from '../../store/aria-store';
import { resolveAdrLinkedElementInfo } from '../adr/adr-utils';
import { useI18n } from '../../i18n/i18n-context';

export type TabId = 'c4' | 'mindmap' | 'kanban' | 'adr';

interface TabBarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

const C4_TYPES = ['c4-container', 'c4-component'];

export function TabBar({ activeTab, onChange }: TabBarProps) {
  const { t } = useI18n();
  const nodes    = useAriaStore((s) => s.nodes);
  const tasksMap = useAriaStore((s) => s.tasks);
  const adrsMap  = useAriaStore((s) => s.adrs);
  const containerCanvases = useAriaStore((s) => s.containerCanvases);

  const c4Count   = nodes.filter((n) => C4_TYPES.includes(n.type)).length;
  const mmCount   = nodes.filter((n) => n.type === 'mindmap').length;
  const taskCount = Object.keys(tasksMap).length;
  const adrCount = Object.values(adrsMap).filter((adr) =>
    resolveAdrLinkedElementInfo(adr.linkedNodeId, nodes, containerCanvases).isC4Linked
  ).length;

  const tabs: { id: TabId; label: string; icon: string; count: number }[] = [
    { id: 'c4',      label: t('wv.tab.c4'),      icon: '🏗', count: c4Count   },
    { id: 'adr',     label: t('wv.tab.adr'),     icon: '📄', count: adrCount  },
    { id: 'mindmap', label: t('wv.tab.mindmap'), icon: '🕸', count: mmCount   },
    { id: 'kanban',  label: t('wv.tab.kanban'),  icon: '📋', count: taskCount },
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: 36,
        flexShrink: 0,
        borderBottom: '1px solid var(--vscode-panel-border, #454545)',
        background: 'var(--vscode-editorGroupHeader-tabsBackground, #252526)',
        overflowX: 'auto',
      }}
    >
      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        />
      ))}
    </div>
  );
}

function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: { id: TabId; label: string; icon: string; count: number };
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 16px',
        border: 'none',
        borderBottom: isActive
          ? '2px solid var(--vscode-focusBorder, #007acc)'
          : '2px solid transparent',
        background: 'transparent',
        color: isActive
          ? 'var(--vscode-editor-foreground, #d4d4d4)'
          : 'var(--vscode-tab-inactiveForeground, #969696)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: isActive ? 600 : 400,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'color 0.1s',
      }}
    >
      <span>{tab.icon}</span>
      <span>{tab.label}</span>
      {tab.count > 0 && (
        <span
          style={{
            background: 'var(--vscode-badge-background, #0e639c)',
            color: 'var(--vscode-badge-foreground, #ffffff)',
            borderRadius: 10,
            fontSize: 10,
            padding: '1px 6px',
            minWidth: 16,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          {tab.count}
        </span>
      )}
    </button>
  );
}
