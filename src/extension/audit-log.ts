import * as fs from 'fs/promises';
import * as path from 'path';
import type { ConsentMode, ConsentScope, RiskLevel } from '../shared/types';

export type AuditEvent = 'export' | 'ai_layout_sync' | 'consent' | 'consent_revoke';
export type AuditResult =
  | 'allowed'
  | 'prompt_shown'
  | 'consent_accepted'
  | 'consent_declined'
  | 'blocked_needs_reconsent';

export interface LayoutDeltaSummary {
  movedNodeCount: number;
  addedNodeCount: number;
  removedNodeCount: number;
  edgeChangedCount: number;
  hasHierarchyChange: boolean;
}

export interface AuditLogEntry {
  at: string;
  event: AuditEvent;
  risk: RiskLevel;
  scope: ConsentScope;
  termsVersion: string;
  result: AuditResult;
  workspaceId: string;
  mode: ConsentMode;
  trigger?: 'terms_changed' | 'scope_expanded' | 'manual_revoke' | 'first_time' | 'none';
  delta?: LayoutDeltaSummary;
}

export async function appendAuditLog(
  workspacePath: string,
  entry: AuditLogEntry,
): Promise<void> {
  const aiContextDir = path.join(workspacePath, '.ai-context');
  const logFile = path.join(aiContextDir, 'audit-log.jsonl');
  await fs.mkdir(aiContextDir, { recursive: true });
  await fs.appendFile(logFile, `${JSON.stringify(entry)}\n`, 'utf-8');
}
