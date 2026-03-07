import { useState, type CSSProperties } from 'react';
import { useAriaStore } from '../../store/aria-store';
import type { TabId } from '../layout/TabBar';
import { postToExtension } from '../../hooks/use-vscode-bridge';
import { useI18n, type ConfiguredLocale } from '../../i18n/i18n-context';
import {
  createMindmapStateHash,
  exportMindmapMarkdown,
  exportMindmapSvg,
  svgToPngDataUrl,
} from '../mindmap/export/mindmap-export';
import { MermaidImportDialog } from '../mindmap/MermaidImportDialog';

interface AriaToolbarProps {
  activeTab: TabId;
  onOpenRuleGuide: () => void;
  configuredLocale: ConfiguredLocale;
  onLocaleChange: (locale: ConfiguredLocale) => void;
}

export function AriaToolbar({
  activeTab,
  onOpenRuleGuide,
  configuredLocale,
  onLocaleChange,
}: AriaToolbarProps) {
  const { t } = useI18n();
  const addNode = useAriaStore((s) => s.addNode);
  const addContainerNode = useAriaStore((s) => s.addContainerNode);
  const currentLayer = useAriaStore((s) => s.currentLayer);
  const activeContainerId = useAriaStore((s) => s.activeContainerId);
  const breadcrumb = useAriaStore((s) => s.breadcrumb);
  const undoMindmap = useAriaStore((s) => s.undoMindmap);
  const redoMindmap = useAriaStore((s) => s.redoMindmap);
  const canUndoMindmap = useAriaStore((s) => s.canUndoMindmap);
  const canRedoMindmap = useAriaStore((s) => s.canRedoMindmap);
  const snapEnabled = useAriaStore((s) => !!s.mindmapSettings.snapEnabled);
  const setMindmapSnapEnabled = useAriaStore((s) => s.setMindmapSnapEnabled);
  const alignSurface = useAriaStore((s) => s.alignSurface);
  const importMindmapMermaid = useAriaStore((s) => s.importMindmapMermaid);
  const [isExporting, setIsExporting] = useState(false);
  const [showMermaidDialog, setShowMermaidDialog] = useState(false);

  const addC4NodeOnCurrentLayer = (
    type: 'c4-container' | 'c4-component' | 'c4-person' | 'c4-database' | 'c4-module',
    label: string,
  ) => {
    const state = useAriaStore.getState();

    if (currentLayer === 'container' && activeContainerId) {
      const nodes = state.getSurfaceNodes({ kind: 'c4-container', containerId: activeContainerId });
      const offset = nodes.length * 40;
      addContainerNode(
        activeContainerId,
        type,
        { x: 200 + offset, y: 150 + offset },
        label,
      );
      return;
    }

    const c4Nodes = state.nodes.filter((n) => (
      n.type === 'c4-container' ||
      n.type === 'c4-component' ||
      n.type === 'c4-person' ||
      n.type === 'c4-database' ||
      n.type === 'c4-module'
    ));
    const offset = c4Nodes.length * 40;
    addNode(type, { x: 200 + offset, y: 150 + offset }, label);
  };

  const handleAddContainer = () => {
    addC4NodeOnCurrentLayer('c4-container', t('seed.container.new'));
  };

  const handleAddComponent = () => {
    addC4NodeOnCurrentLayer('c4-component', t('seed.component.new'));
  };

  const handleAddPerson = () => {
    addC4NodeOnCurrentLayer('c4-person', t('seed.person.new'));
  };

  const handleAddDatabase = () => {
    addC4NodeOnCurrentLayer('c4-database', t('seed.database.new'));
  };

  const handleAddModule = () => {
    addC4NodeOnCurrentLayer('c4-module', t('seed.module.new'));
  };

  const handleAddMindmap = () => {
    const nodes = useAriaStore.getState().nodes;
    const mmNodes = nodes.filter((n) => n.type === 'mindmap');
    const offset = mmNodes.length * 40;
    addNode('mindmap', { x: 200 + offset, y: 150 + offset }, t('seed.node.mindmap'));
  };

  const handleAlign = () => {
    if (activeTab === 'c4') {
      const surface = currentLayer === 'container' && activeContainerId
        ? { kind: 'c4-container', containerId: activeContainerId } as const
        : { kind: 'c4-context' } as const;
      alignSurface(surface);
      return;
    }
    if (activeTab === 'mindmap') {
      alignSurface({ kind: 'mindmap-root' });
    }
  };

  const handleMindmapExport = async (format: 'markdown' | 'svg' | 'png') => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const state = useAriaStore.getState();
      const ariaState = {
        nodes: state.nodes,
        edges: state.edges,
        tasks: state.tasks,
        adrs: state.adrs,
        containerCanvases: state.containerCanvases,
        mindmapBoundaries: state.mindmapBoundaries,
        mindmapSettings: state.mindmapSettings,
        version: state.version,
        lastModified: state.lastModified,
      };
      const stateHash = await createMindmapStateHash(ariaState);

      if (format === 'markdown') {
        const content = exportMindmapMarkdown(ariaState);
        postToExtension({ type: 'MINDMAP_EXPORT_REQUEST', payload: { format, content, stateHash } });
        return;
      }

      const svg = exportMindmapSvg(ariaState);
      if (format === 'svg') {
        postToExtension({ type: 'MINDMAP_EXPORT_REQUEST', payload: { format, content: svg, stateHash } });
        return;
      }

      const pngDataUrl = await svgToPngDataUrl(svg);
      postToExtension({ type: 'MINDMAP_EXPORT_REQUEST', payload: { format, content: pngDataUrl, stateHash } });
    } catch (error) {
      console.error('[ARIA] mindmap export failed', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{
      height: 40,
      padding: '0 12px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      borderBottom: '1px solid var(--vscode-panel-border, #454545)',
      background: 'var(--vscode-sideBar-background, #252526)',
    }}>
      <span style={{
        fontWeight: 'bold',
        fontSize: 13,
        color: 'var(--vscode-editor-foreground, #d4d4d4)',
        marginRight: 8,
      }}>
        ARIA
      </span>

      {activeTab === 'c4' && (
        <>
          <button
            onClick={handleAddContainer}
            title={currentLayer === 'container'
              ? t('wv.toolbar.title_add_container_inner')
              : t('wv.toolbar.title_add_container_root')}
            style={{
              background: 'var(--vscode-button-background, #0e639c)',
              color: 'var(--vscode-button-foreground, #ffffff)',
              border: 'none',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            {currentLayer === 'container'
              ? t('wv.toolbar.add_container_inner')
              : t('wv.toolbar.add_container_root')}
          </button>

          {currentLayer === 'container' && (
            <>
              <button
                onClick={handleAddComponent}
                title={t('wv.toolbar.title_add_component')}
                style={{
                  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: 'var(--vscode-button-secondaryForeground, #cccccc)',
                  border: '1px solid var(--vscode-panel-border, #454545)',
                  borderRadius: 4,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                {t('wv.toolbar.add_component')}
              </button>

              <span style={{
                fontSize: 10,
                color: 'var(--vscode-descriptionForeground, #9d9d9d)',
                opacity: 0.9,
              }}>
                {t('wv.toolbar.editing', {
                  label: breadcrumb[breadcrumb.length - 1]?.label ?? activeContainerId,
                })}
              </span>
            </>
          )}

          <button
            onClick={handleAddPerson}
            title={t('wv.toolbar.title_add_person')}
            style={secondaryButtonStyle(false)}
          >
            {t('wv.toolbar.add_person')}
          </button>
          <button
            onClick={handleAddDatabase}
            title={t('wv.toolbar.title_add_database')}
            style={secondaryButtonStyle(false)}
          >
            {t('wv.toolbar.add_database')}
          </button>
          <button
            onClick={handleAddModule}
            title={t('wv.toolbar.title_add_module')}
            style={secondaryButtonStyle(false)}
          >
            {t('wv.toolbar.add_module')}
          </button>
          <button
            onClick={handleAlign}
            title={t('wv.toolbar.title_align_surface')}
            style={secondaryButtonStyle(false)}
          >
            {t('wv.toolbar.align_surface')}
          </button>
        </>
      )}

      {activeTab === 'mindmap' && (
        <>
          <button
            onClick={handleAddMindmap}
            title={t('wv.toolbar.title_add_node')}
            style={{
              background: 'var(--vscode-button-background, #0e639c)',
              color: 'var(--vscode-button-foreground, #ffffff)',
              border: 'none',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            {t('wv.toolbar.add_node')}
          </button>
          <button
            onClick={undoMindmap}
            disabled={!canUndoMindmap}
            style={secondaryButtonStyle(!canUndoMindmap)}
            title="Undo (Ctrl+Z)"
          >
            {t('wv.toolbar.undo')}
          </button>
          <button
            onClick={redoMindmap}
            disabled={!canRedoMindmap}
            style={secondaryButtonStyle(!canRedoMindmap)}
            title="Redo (Ctrl+Shift+Z)"
          >
            {t('wv.toolbar.redo')}
          </button>
          <button
            onClick={() => setMindmapSnapEnabled(!snapEnabled)}
            style={secondaryButtonStyle(false)}
            title={t('wv.toolbar.title_snap')}
          >
            {snapEnabled ? t('wv.toolbar.snap_on') : t('wv.toolbar.snap_off')}
          </button>
          <button
            onClick={() => setShowMermaidDialog(true)}
            style={secondaryButtonStyle(false)}
            title={t('wv.toolbar.title_mermaid_import')}
          >
            {t('wv.toolbar.mermaid_import')}
          </button>
          <button
            onClick={handleAlign}
            style={secondaryButtonStyle(false)}
            title={t('wv.toolbar.title_align_surface')}
          >
            {t('wv.toolbar.align_surface')}
          </button>
          <button
            onClick={() => { void handleMindmapExport('markdown'); }}
            style={secondaryButtonStyle(isExporting)}
            disabled={isExporting}
            title={t('wv.toolbar.title_export_md')}
          >
            {t('wv.toolbar.export_md')}
          </button>
          <button
            onClick={() => { void handleMindmapExport('svg'); }}
            style={secondaryButtonStyle(isExporting)}
            disabled={isExporting}
            title={t('wv.toolbar.title_export_svg')}
          >
            {t('wv.toolbar.export_svg')}
          </button>
          <button
            onClick={() => { void handleMindmapExport('png'); }}
            style={secondaryButtonStyle(isExporting)}
            disabled={isExporting}
            title={t('wv.toolbar.title_export_png')}
          >
            {t('wv.toolbar.export_png')}
          </button>
        </>
      )}

      <div style={{ flex: 1 }} />

      <label style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginRight: 8,
        fontSize: 10,
        color: 'var(--vscode-descriptionForeground, #9d9d9d)',
      }}>
        <span>{t('wv.toolbar.language_label')}:</span>
        <select
          value={configuredLocale}
          onChange={(event) => onLocaleChange(event.target.value as ConfiguredLocale)}
          style={{
            height: 22,
            borderRadius: 4,
            border: '1px solid var(--vscode-panel-border, #454545)',
            background: 'var(--vscode-dropdown-background, #3c3c3c)',
            color: 'var(--vscode-dropdown-foreground, #cccccc)',
            fontSize: 11,
            padding: '0 6px',
          }}
        >
          <option value="auto">{t('wv.locale.option.auto')}</option>
          <option value="en">{t('wv.locale.option.en')}</option>
          <option value="ja">{t('wv.locale.option.ja')}</option>
        </select>
      </label>

      <button
        onClick={onOpenRuleGuide}
        title={t('wv.toolbar.title_rule_guide')}
        style={{
          background: 'transparent',
          color: 'var(--vscode-descriptionForeground, #9d9d9d)',
          border: '1px solid var(--vscode-panel-border, #454545)',
          borderRadius: 999,
          padding: '2px 10px',
          cursor: 'pointer',
          fontSize: 10,
          marginRight: 8,
        }}
      >
        {t('wv.toolbar.rule_guide')}
      </button>

      <span style={{
        fontSize: 10,
        color: 'var(--vscode-descriptionForeground, #9d9d9d)',
        opacity: 0.7,
      }}>
        {t('wv.toolbar.shortcut_hint')}
      </span>

      <MermaidImportDialog
        open={showMermaidDialog}
        onClose={() => setShowMermaidDialog(false)}
        onImport={(source) => importMindmapMermaid(source)}
      />
    </div>
  );
}

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
    color: 'var(--vscode-button-secondaryForeground, #cccccc)',
    border: '1px solid var(--vscode-panel-border, #454545)',
    borderRadius: 4,
    padding: '4px 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    fontSize: 11,
  };
}
