import * as vscode from 'vscode';
import { createHash } from 'crypto';
import type {
  ConsentMode,
  ConsentScope,
  RiskLevel,
  WorkspaceConsentRecord,
} from '../shared/types';
import { tExt } from './i18n';

export const CURRENT_TERMS_VERSION = '1.0.0';
export const CONSENT_KEY_PREFIX = 'aria.consent.v1';
const PROMPT_CACHE_KEY_PREFIX = 'aria.consent.prompt-cache.v1';

export type ConsentTrigger =
  | 'none'
  | 'first_time'
  | 'terms_changed'
  | 'scope_expanded'
  | 'manual_revoke';

export interface ConsentGuardResult {
  allow: boolean;
  mode: ConsentMode;
  trigger: ConsentTrigger;
  result: 'allowed' | 'consent_accepted' | 'consent_declined' | 'blocked_needs_reconsent';
  prompted: boolean;
  consent: WorkspaceConsentRecord | null;
}

interface PromptCacheRecord {
  decision: 'accepted' | 'declined';
  at: string;
}

const DEFAULT_SCOPES: ConsentScope[] = [
  'export_compliance_guard',
  'ai_layout_sync_apply',
];

function getConsentStorageKey(workspaceHash: string): string {
  return `${CONSENT_KEY_PREFIX}::${workspaceHash}`;
}

function getPromptCacheStorageKey(
  workspaceHash: string,
  scope: ConsentScope,
  stateHash: string,
): string {
  return `${PROMPT_CACHE_KEY_PREFIX}::${workspaceHash}::${scope}::${stateHash}`;
}

export function hashWorkspaceId(workspacePath: string): string {
  return createHash('sha256').update(workspacePath).digest('hex');
}

export function loadWorkspaceConsent(
  context: vscode.ExtensionContext,
  workspaceHash: string,
): WorkspaceConsentRecord | null {
  const raw = context.globalState.get<WorkspaceConsentRecord | null>(
    getConsentStorageKey(workspaceHash),
    null,
  );
  if (!raw) {
    return null;
  }

  const mode: ConsentMode =
    raw.mode === 'always_ask' || raw.mode === 'ask_high_risk_only' || raw.mode === 'always_allow'
      ? raw.mode
      : 'always_allow';

  return {
    workspaceIdHash: workspaceHash,
    termsVersion: typeof raw.termsVersion === 'string' ? raw.termsVersion : CURRENT_TERMS_VERSION,
    acceptedAt: typeof raw.acceptedAt === 'string' ? raw.acceptedAt : new Date().toISOString(),
    scopes: Array.isArray(raw.scopes)
      ? raw.scopes.filter((scope): scope is ConsentScope => (
          scope === 'export_compliance_guard' || scope === 'ai_layout_sync_apply'
        ))
      : [...DEFAULT_SCOPES],
    mode,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

export async function saveWorkspaceConsent(
  context: vscode.ExtensionContext,
  record: WorkspaceConsentRecord,
): Promise<void> {
  await context.globalState.update(getConsentStorageKey(record.workspaceIdHash), record);
}

export async function revokeWorkspaceConsent(
  context: vscode.ExtensionContext,
  workspaceHash: string,
): Promise<WorkspaceConsentRecord> {
  const existing = loadWorkspaceConsent(context, workspaceHash);
  const now = new Date().toISOString();
  const revoked: WorkspaceConsentRecord = existing
    ? {
        ...existing,
        scopes: [],
        updatedAt: now,
      }
    : {
        workspaceIdHash: workspaceHash,
        termsVersion: CURRENT_TERMS_VERSION,
        acceptedAt: now,
        scopes: [],
        mode: 'always_allow',
        updatedAt: now,
      };
  await saveWorkspaceConsent(context, revoked);
  return revoked;
}

function resolveTrigger(
  consent: WorkspaceConsentRecord | null,
  requiredScope: ConsentScope,
): ConsentTrigger {
  if (!consent) {
    return 'first_time';
  }
  if (consent.termsVersion !== CURRENT_TERMS_VERSION) {
    return 'terms_changed';
  }
  if (!consent.scopes.includes(requiredScope)) {
    return consent.scopes.length === 0 ? 'manual_revoke' : 'scope_expanded';
  }
  return 'none';
}

function shouldPrompt(
  mode: ConsentMode,
  trigger: ConsentTrigger,
  risk: RiskLevel,
): boolean {
  if (trigger !== 'none') {
    return true;
  }
  if (mode === 'always_ask') {
    return true;
  }
  if (mode === 'ask_high_risk_only' && risk === 'high') {
    return true;
  }
  if (mode === 'always_allow' && risk === 'high') {
    return true;
  }
  return false;
}

async function askConsentMode(): Promise<ConsentMode> {
  const options = [
    {
      value: 'always_allow' as const,
      label: tExt('ext.consent.mode.always_allow.label'),
      description: tExt('ext.consent.mode.always_allow.desc'),
    },
    {
      value: 'ask_high_risk_only' as const,
      label: tExt('ext.consent.mode.ask_high_risk_only.label'),
      description: tExt('ext.consent.mode.ask_high_risk_only.desc'),
    },
    {
      value: 'always_ask' as const,
      label: tExt('ext.consent.mode.always_ask.label'),
      description: tExt('ext.consent.mode.always_ask.desc'),
    },
  ];

  const picked = await vscode.window.showQuickPick(
    options,
    {
      title: tExt('ext.consent.mode_title'),
      canPickMany: false,
      ignoreFocusOut: true,
    },
  );

  if (!picked) {
    return 'always_allow';
  }
  return picked.value;
}

export async function evaluateConsentGuard(params: {
  context: vscode.ExtensionContext;
  workspaceHash: string;
  requiredScope: ConsentScope;
  risk: RiskLevel;
  stateHash: string;
  operationLabel: string;
}): Promise<ConsentGuardResult> {
  const { context, workspaceHash, requiredScope, risk, stateHash, operationLabel } = params;
  const consent = loadWorkspaceConsent(context, workspaceHash);
  const mode: ConsentMode = consent?.mode ?? 'always_allow';
  const trigger = resolveTrigger(consent, requiredScope);

  if (!shouldPrompt(mode, trigger, risk)) {
    return {
      allow: true,
      mode,
      trigger,
      result: 'allowed',
      prompted: false,
      consent,
    };
  }

  const cacheKey = getPromptCacheStorageKey(workspaceHash, requiredScope, stateHash);
  const cached = context.globalState.get<PromptCacheRecord | null>(cacheKey, null);
  if (cached) {
    return {
      allow: cached.decision === 'accepted',
      mode,
      trigger,
      result: cached.decision === 'accepted' ? 'allowed' : 'blocked_needs_reconsent',
      prompted: false,
      consent,
    };
  }

  const detailLines = [
    tExt('ext.consent.detail.operation', { value: operationLabel }),
    tExt('ext.consent.detail.scope', { value: requiredScope }),
    tExt('ext.consent.detail.terms', { value: CURRENT_TERMS_VERSION }),
    tExt('ext.consent.detail.risk', { value: risk }),
    tExt('ext.consent.detail.trigger', { value: trigger }),
  ];
  const acceptLabel = tExt('ext.consent.action.accept');
  const declineLabel = tExt('ext.consent.action.decline');
  const action = await vscode.window.showInformationMessage(
    tExt('ext.consent.prompt'),
    {
      modal: true,
      detail: detailLines.join('\n'),
    },
    acceptLabel,
    declineLabel,
  );

  if (action !== acceptLabel) {
    await context.globalState.update(cacheKey, {
      decision: 'declined',
      at: new Date().toISOString(),
    } satisfies PromptCacheRecord);

    return {
      allow: false,
      mode,
      trigger,
      result: 'consent_declined',
      prompted: true,
      consent,
    };
  }

  const nextMode = await askConsentMode();
  const now = new Date().toISOString();
  const updated: WorkspaceConsentRecord = {
    workspaceIdHash: workspaceHash,
    termsVersion: CURRENT_TERMS_VERSION,
    acceptedAt: now,
    scopes: [...DEFAULT_SCOPES],
    mode: nextMode,
    updatedAt: now,
  };
  await saveWorkspaceConsent(context, updated);
  await context.globalState.update(cacheKey, {
    decision: 'accepted',
    at: now,
  } satisfies PromptCacheRecord);

  return {
    allow: true,
    mode: nextMode,
    trigger,
    result: 'consent_accepted',
    prompted: true,
    consent: updated,
  };
}
