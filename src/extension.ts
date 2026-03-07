import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { AriaPanel } from './extension/aria-panel';
import { AriaStateWatcher } from './extension/aria-state-watcher';
import { loadAriaState, DEFAULT_ARIA_STATE } from './extension/persistence';
import { writeAllAiContextFiles } from './extension/file-writer';
import { requireWorkspace } from './extension/utils/workspace';
import { parseAriaState } from './extension/parse-aria-state';
import { parseStatusMd } from './extension/parse-status-md';
import { reconcileState } from './extension/reconcile-state';
import type {
  AriaState,
  MindmapExportRequest,
  RiskLevel,
  WebviewToExtensionMessage,
} from './shared/types';
import {
  CURRENT_TERMS_VERSION,
  evaluateConsentGuard,
  hashWorkspaceId,
  revokeWorkspaceConsent,
} from './extension/consent';
import {
  appendAuditLog,
  type AuditEvent,
  type AuditResult,
  type LayoutDeltaSummary,
} from './extension/audit-log';
import {
  hasLayoutDelta,
  resolveLayoutRisk,
  summarizeMindmapLayoutDelta,
} from './extension/layout-delta';
import {
  getI18nSnapshot,
  setConfiguredLocale,
  tExt,
} from './extension/i18n';

const DEBOUNCE_WRITE_MS = 2000;
const FIRST_LAUNCH_RULE_GUIDE_KEY = 'aria.ruleGuide.firstLaunchShown.v1';

let currentState: AriaState = { ...DEFAULT_ARIA_STATE };
let writeDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let watcher: AriaStateWatcher | undefined;
let activeWorkspacePath: string | null = null;
let extensionContextRef: vscode.ExtensionContext | null = null;
let openRuleGuideOnWebviewReady = false;

class AriaLaunchTreeItem extends vscode.TreeItem {
  constructor() {
    super('Open Brain Connector ARIA', vscode.TreeItemCollapsibleState.None);
    this.command = {
      command: 'aria.openPanel',
      title: 'Open Brain Connector ARIA',
    };
    this.iconPath = new vscode.ThemeIcon('rocket');
    this.contextValue = 'ariaLaunchItem';
  }
}

class AriaLaunchViewProvider implements vscode.TreeDataProvider<AriaLaunchTreeItem> {
  getTreeItem(element: AriaLaunchTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): AriaLaunchTreeItem[] {
    return [new AriaLaunchTreeItem()];
  }
}

export async function activate(context: vscode.ExtensionContext) {
  extensionContextRef = context;
  console.log('[ARIA] activate() 開始');
  try {
    const workspacePath = requireWorkspace();
    activeWorkspacePath = workspacePath;

    if (workspacePath) {
      const loadResult = await loadAriaState(workspacePath);
      currentState = loadResult.state;
      if (loadResult.warning) {
        vscode.window.showWarningMessage(loadResult.warning);
      }

      watcher = new AriaStateWatcher(
        workspacePath,
        async (rawJson: string) => {
          await handleExternalAriaStateChange(rawJson);
        },
        async (rawMarkdown: string) => {
          await handleExternalStatusMdChange(rawMarkdown);
        },
      );
      watcher.start();
      context.subscriptions.push({ dispose: () => watcher?.dispose() });
    }

    const openAriaPanel = (workspacePath: string): AriaPanel => {
      const panel = AriaPanel.createOrShow(
        context.extensionUri,
        (message: WebviewToExtensionMessage) => {
          void handleWebviewMessage(message, workspacePath);
        },
      );
      panel.postMessage({ type: 'INIT_STATE', payload: currentState });
      panel.postMessage({ type: 'I18N_INIT', payload: getI18nSnapshot() });
      return panel;
    };

    context.subscriptions.push(
      vscode.commands.registerCommand('aria.openPanel', async () => {
        try {
          const ws = requireWorkspace();
          if (!ws) {
            return;
          }
          openAriaPanel(ws);
        } catch (cmdErr) {
          console.error('[ARIA] aria.openPanel エラー:', cmdErr);
          vscode.window.showErrorMessage(
            tExt('ext.error.panel_open', { error: String(cmdErr) }),
          );
        }
      }),
    );

    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('aria.launchView', new AriaLaunchViewProvider()),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('aria.openRuleGuide', async () => {
        try {
          const ws = requireWorkspace();
          if (!ws) {
            return;
          }
          const panelAlreadyOpen = !!AriaPanel.currentPanel;
          if (!panelAlreadyOpen) {
            openRuleGuideOnWebviewReady = true;
          }
          const panel = openAriaPanel(ws);
          if (panelAlreadyOpen) {
            panel.postMessage({ type: 'OPEN_RULE_GUIDE' });
          }
        } catch (cmdErr) {
          console.error('[ARIA] aria.openRuleGuide エラー:', cmdErr);
          vscode.window.showErrorMessage(
            tExt('ext.error.rule_guide_open', { error: String(cmdErr) }),
          );
        }
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('aria.addTask', () => {
        AriaPanel.currentPanel?.postMessage({ type: 'ADD_TASK' });
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('aria.syncNow', async () => {
        const ws = requireWorkspace();
        if (!ws) {
          vscode.window.showWarningMessage(tExt('ext.warn.workspace_not_open'));
          return;
        }
        try {
          if (writeDebounceTimer) {
            clearTimeout(writeDebounceTimer);
            writeDebounceTimer = undefined;
          }
          await writeAllAiContextFiles(ws, currentState, () => watcher?.markWriteStart());
          vscode.window.showInformationMessage(tExt('ext.notify.synced'));
        } catch (err) {
          vscode.window.showErrorMessage(
            tExt('ext.error.sync_failed', { error: String(err) }),
          );
        }
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('aria.revokeConsent', async () => {
        const ws = requireWorkspace();
        if (!ws || !extensionContextRef) {
          vscode.window.showWarningMessage(tExt('ext.warn.workspace_not_open'));
          return;
        }
        const workspaceHash = hashWorkspaceId(ws);
        await revokeWorkspaceConsent(extensionContextRef, workspaceHash);
        await appendAuditLogSafe(ws, {
          at: new Date().toISOString(),
          event: 'consent_revoke',
          risk: 'high',
          scope: 'export_compliance_guard',
          termsVersion: CURRENT_TERMS_VERSION,
          result: 'blocked_needs_reconsent',
          workspaceId: workspaceHash,
          mode: 'always_allow',
          trigger: 'manual_revoke',
        });
        vscode.window.showInformationMessage(tExt('ext.notify.consent_revoked'));
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('aria.locale')) {
          AriaPanel.currentPanel?.postMessage({
            type: 'I18N_LOCALE_CHANGED',
            payload: getI18nSnapshot(),
          });
        }
      }),
    );

    await maybeShowFirstLaunchRuleGuide(context);

    console.log('[ARIA] activate() 完了 — コマンド登録済み');
  } catch (err) {
    console.error('[ARIA] activate() で予期しないエラー:', err);
    vscode.window.showErrorMessage(
      tExt('ext.error.activate_failed', { error: String(err) }),
    );
  }
}

async function maybeShowFirstLaunchRuleGuide(context: vscode.ExtensionContext): Promise<void> {
  if (!activeWorkspacePath) {
    return;
  }
  const alreadyShown = context.workspaceState.get<boolean>(FIRST_LAUNCH_RULE_GUIDE_KEY, false);
  if (alreadyShown) {
    return;
  }

  await context.workspaceState.update(FIRST_LAUNCH_RULE_GUIDE_KEY, true);

  const action = await vscode.window.showInformationMessage(
    tExt('ext.notify.first_launch_guide'),
    tExt('ext.action.open_guide'),
    tExt('ext.action.later'),
  );
  if (action === tExt('ext.action.open_guide')) {
    await vscode.commands.executeCommand('aria.openRuleGuide');
  }
}

async function handleExternalAriaStateChange(rawJson: string): Promise<void> {
  const result = parseAriaState(rawJson);

  if (!result.ok) {
    console.error(`ARIA: aria-state.json のパースエラー: ${result.error}`);
    AriaPanel.currentPanel?.postMessage({
      type: 'ERROR',
      payload: {
        message: tExt('ext.error.aria_state_parse', { error: result.error }),
        code: 'PARSE_ERROR',
      },
    });
    return;
  }

  if (result.quarantinedCount > 0) {
    vscode.window.showWarningMessage(
      tExt('ext.warn.tasks_quarantined', { count: result.quarantinedCount }),
    );
  }

  const workspacePath = activeWorkspacePath;
  const context = extensionContextRef;
  const delta = summarizeMindmapLayoutDelta(result.state, currentState);
  const hasDelta = hasLayoutDelta(delta);
  let allowMindmapLayoutUpdate = false;

  if (workspacePath && context && hasDelta) {
    const workspaceHash = hashWorkspaceId(workspacePath);
    const stateHash = hashDeltaSummary(delta);
    const risk = resolveLayoutRisk(delta, false);
    const guard = await evaluateConsentGuard({
      context,
      workspaceHash,
      requiredScope: 'ai_layout_sync_apply',
      risk,
      stateHash,
      operationLabel: tExt('ext.operation.ai_layout_sync_apply'),
    });

    await logConsentTransition(workspacePath, workspaceHash, 'ai_layout_sync_apply', risk, guard, delta);

    if (!guard.allow) {
      await appendAuditLogSafe(workspacePath, {
        at: new Date().toISOString(),
        event: 'ai_layout_sync',
        risk,
        scope: 'ai_layout_sync_apply',
        termsVersion: CURRENT_TERMS_VERSION,
        result: 'blocked_needs_reconsent',
        workspaceId: workspaceHash,
        mode: guard.mode,
        trigger: guard.trigger,
        delta,
      });
      vscode.window.showWarningMessage(
        tExt('ext.warn.layout_sync_blocked'),
      );
      return;
    }

    allowMindmapLayoutUpdate = true;
    await appendAuditLogSafe(workspacePath, {
      at: new Date().toISOString(),
      event: 'ai_layout_sync',
      risk,
      scope: 'ai_layout_sync_apply',
      termsVersion: CURRENT_TERMS_VERSION,
      result: 'allowed',
      workspaceId: workspaceHash,
      mode: guard.mode,
      trigger: guard.trigger,
      delta,
    });
    vscode.window.showInformationMessage(tExt('ext.notify.layout_sync_applied'));
  }

  const reconciledState = reconcileState(result.state, currentState, {
    preserveNodePositions: true,
    preserveMindmapLayout: !allowMindmapLayoutUpdate,
  });
  currentState = reconciledState;

  AriaPanel.currentPanel?.postMessage({
    type: 'STATE_UPDATED',
    payload: currentState,
  });
}

async function handleExternalStatusMdChange(rawMarkdown: string): Promise<void> {
  const result = parseStatusMd(rawMarkdown, currentState.tasks);

  if (!result.ok) {
    console.error(`ARIA: status.md のパースエラー: ${result.error}`);
    AriaPanel.currentPanel?.postMessage({
      type: 'ERROR',
      payload: {
        message: tExt('ext.error.status_md_parse', { error: result.error }),
        code: 'PARSE_ERROR',
      },
    });
    return;
  }

  currentState = {
    ...currentState,
    tasks: result.tasks,
    lastModified: new Date().toISOString(),
  };

  if (result.quarantinedCount > 0) {
    vscode.window.showWarningMessage(
      tExt('ext.warn.status_md_quarantined', { count: result.quarantinedCount }),
    );
  }

  AriaPanel.currentPanel?.postMessage({
    type: 'STATE_UPDATED',
    payload: currentState,
  });

  if (activeWorkspacePath) {
    scheduleWrite(activeWorkspacePath);
  }
}

async function handleWebviewMessage(
  message: WebviewToExtensionMessage,
  workspacePath: string,
): Promise<void> {
  console.log(`[ARIA] handleWebviewMessage: type=${message.type}`);
  switch (message.type) {
    case 'READY':
      AriaPanel.currentPanel?.postMessage({
        type: 'INIT_STATE',
        payload: currentState,
      });
      AriaPanel.currentPanel?.postMessage({
        type: 'I18N_INIT',
        payload: getI18nSnapshot(),
      });
      if (openRuleGuideOnWebviewReady) {
        AriaPanel.currentPanel?.postMessage({ type: 'OPEN_RULE_GUIDE' });
        openRuleGuideOnWebviewReady = false;
      }
      break;

    case 'I18N_SET_LOCALE_REQUEST':
      await setConfiguredLocale(message.payload.locale);
      AriaPanel.currentPanel?.postMessage({
        type: 'I18N_LOCALE_CHANGED',
        payload: getI18nSnapshot(),
      });
      break;

    case 'STATE_CHANGED':
      currentState = message.payload;
      scheduleWrite(workspacePath);
      break;

    case 'MINDMAP_EXPORT_REQUEST':
      await handleMindmapExportRequest(workspacePath, message.payload);
      break;
  }
}

async function handleMindmapExportRequest(
  workspacePath: string,
  request: MindmapExportRequest,
): Promise<void> {
  const context = extensionContextRef;
  if (!context) {
    return;
  }
  const workspaceHash = hashWorkspaceId(workspacePath);
  const risk: RiskLevel = 'low';
  const guard = await evaluateConsentGuard({
    context,
    workspaceHash,
    requiredScope: 'export_compliance_guard',
    risk,
    stateHash: request.stateHash,
    operationLabel: tExt('ext.operation.mindmap_export', {
      format: request.format.toUpperCase(),
    }),
  });

  await logConsentTransition(workspacePath, workspaceHash, 'export_compliance_guard', risk, guard);

  if (!guard.allow) {
    await appendAuditLogSafe(workspacePath, {
      at: new Date().toISOString(),
      event: 'export',
      risk,
      scope: 'export_compliance_guard',
      termsVersion: CURRENT_TERMS_VERSION,
      result: 'blocked_needs_reconsent',
      workspaceId: workspaceHash,
      mode: guard.mode,
      trigger: guard.trigger,
    });
    AriaPanel.currentPanel?.postMessage({
      type: 'MINDMAP_EXPORT_RESULT',
      payload: {
        ok: false,
        message: tExt('ext.error.export_blocked'),
      },
    });
    return;
  }

  try {
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = request.format === 'markdown' ? 'md' : request.format;
    const defaultUri = vscode.Uri.file(`${workspacePath}\\mindmap-export-${now}.${extension}`);
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      saveLabel: 'Export',
      filters: getExportFilters(request.format),
    });

    if (!saveUri) {
      return;
    }

    const fileBytes = request.format === 'png'
      ? decodePngDataUrl(request.content)
      : Buffer.from(request.content, 'utf-8');
    await vscode.workspace.fs.writeFile(saveUri, fileBytes);

    await appendAuditLogSafe(workspacePath, {
      at: new Date().toISOString(),
      event: 'export',
      risk,
      scope: 'export_compliance_guard',
      termsVersion: CURRENT_TERMS_VERSION,
      result: 'allowed',
      workspaceId: workspaceHash,
      mode: guard.mode,
      trigger: guard.trigger,
    });

    AriaPanel.currentPanel?.postMessage({
      type: 'MINDMAP_EXPORT_RESULT',
      payload: {
        ok: true,
        message: tExt('ext.notify.export_done_path', { path: saveUri.fsPath }),
      },
    });
    vscode.window.showInformationMessage(
      tExt('ext.notify.export_done', { format: request.format.toUpperCase() }),
    );
  } catch (error) {
    console.error('[ARIA] export failed', error);
    AriaPanel.currentPanel?.postMessage({
      type: 'MINDMAP_EXPORT_RESULT',
      payload: {
        ok: false,
        message: tExt('ext.error.export_failed', { error: String(error) }),
      },
    });
  }
}

function getExportFilters(format: MindmapExportRequest['format']): Record<string, string[]> {
  if (format === 'markdown') {
    return { Markdown: ['md'] };
  }
  if (format === 'svg') {
    return { SVG: ['svg'] };
  }
  return { PNG: ['png'] };
}

function decodePngDataUrl(dataUrl: string): Uint8Array {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    throw new Error(tExt('ext.error.invalid_png'));
  }
  return Buffer.from(match[1], 'base64');
}

async function logConsentTransition(
  workspacePath: string,
  workspaceHash: string,
  scope: 'export_compliance_guard' | 'ai_layout_sync_apply',
  risk: RiskLevel,
  guard: Awaited<ReturnType<typeof evaluateConsentGuard>>,
  delta?: LayoutDeltaSummary,
): Promise<void> {
  if (!guard.prompted) {
    return;
  }

  await appendAuditLogSafe(workspacePath, {
    at: new Date().toISOString(),
    event: 'consent',
    risk,
    scope,
    termsVersion: CURRENT_TERMS_VERSION,
    result: 'prompt_shown',
    workspaceId: workspaceHash,
    mode: guard.mode,
    trigger: guard.trigger,
    delta,
  });

  if (guard.result === 'consent_accepted' || guard.result === 'consent_declined') {
    await appendAuditLogSafe(workspacePath, {
      at: new Date().toISOString(),
      event: 'consent',
      risk,
      scope,
      termsVersion: CURRENT_TERMS_VERSION,
      result: guard.result,
      workspaceId: workspaceHash,
      mode: guard.mode,
      trigger: guard.trigger,
      delta,
    });
  }
}

async function appendAuditLogSafe(
  workspacePath: string,
  entry: {
    at: string;
    event: AuditEvent;
    risk: RiskLevel;
    scope: 'export_compliance_guard' | 'ai_layout_sync_apply';
    termsVersion: string;
    result: AuditResult;
    workspaceId: string;
    mode: 'always_allow' | 'ask_high_risk_only' | 'always_ask';
    trigger?: 'terms_changed' | 'scope_expanded' | 'manual_revoke' | 'first_time' | 'none';
    delta?: LayoutDeltaSummary;
  },
): Promise<void> {
  try {
    await appendAuditLog(workspacePath, entry);
  } catch (error) {
    console.error('[ARIA] audit log append failed', error);
  }
}

function hashDeltaSummary(delta: LayoutDeltaSummary): string {
  const raw = JSON.stringify(delta);
  return createHash('sha256').update(raw).digest('hex');
}

function scheduleWrite(workspacePath: string): void {
  if (writeDebounceTimer) {
    clearTimeout(writeDebounceTimer);
  }
  writeDebounceTimer = setTimeout(async () => {
    try {
      await writeAllAiContextFiles(
        workspacePath,
        currentState,
        () => watcher?.markWriteStart(),
      );
    } catch (err) {
      console.error('[ARIA] writeAllAiContextFiles エラー:', err);
      vscode.window.showErrorMessage(
        tExt('ext.error.file_write_failed', { error: String(err) }),
      );
    }
  }, DEBOUNCE_WRITE_MS);
}

export function deactivate() {
  watcher?.dispose();
  if (writeDebounceTimer) {
    clearTimeout(writeDebounceTimer);
  }
}
