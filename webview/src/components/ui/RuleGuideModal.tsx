import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/i18n-context';

interface RuleGuideModalProps {
  open: boolean;
  onClose: () => void;
}

interface RuleTarget {
  id: string;
  title: string;
  filePath: string;
  filePathKey?: 'wv.rule_guide.file.cline';
  noteKey:
    | 'wv.rule_guide.note.cursor'
    | 'wv.rule_guide.note.copilot'
    | 'wv.rule_guide.note.cline';
  snippet: string;
}

const ARIA_COMMON_RULE_BLOCK = `## ARIA Shared Rules (Append)
- Keep existing project rules. Always append this block at the end.
- Treat ".ai-context/aria-state.json" as the source of truth.
- Read ".ai-context/status.md" before implementation and after edits.
- Never remove task anchors: <!-- task-id-task-XXXXXXXX -->.
- Valid task status values: "Todo", "In Progress", "Done", "Inbox".
- Do not manually edit ".ai-context/architecture.mermaid" (auto-generated).
- If requirements are ambiguous, add a task to Inbox instead of guessing.
`;

const RULE_TARGETS: RuleTarget[] = [
  {
    id: 'cursor',
    title: 'Cursor',
    filePath: '.cursorrules',
    noteKey: 'wv.rule_guide.note.cursor',
    snippet: `# ARIA Rule Pack (Cursor)
# Append this block to the end of your existing .cursorrules.

${ARIA_COMMON_RULE_BLOCK}`,
  },
  {
    id: 'copilot',
    title: 'GitHub Copilot',
    filePath: '.github/copilot-instructions.md',
    noteKey: 'wv.rule_guide.note.copilot',
    snippet: `# ARIA Rule Pack (Copilot)
# Append this block to the end of your existing copilot-instructions.md.

${ARIA_COMMON_RULE_BLOCK}`,
  },
  {
    id: 'cline',
    title: 'Cline / Windsurf',
    filePath: '',
    filePathKey: 'wv.rule_guide.file.cline',
    noteKey: 'wv.rule_guide.note.cline',
    snippet: `# ARIA Rule Pack (Cline/Windsurf)
# Append this block to your environment's project rule file.

${ARIA_COMMON_RULE_BLOCK}`,
  },
];

export function RuleGuideModal({ open, onClose }: RuleGuideModalProps) {
  const { t } = useI18n();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedId) {
      return;
    }
    const timer = window.setTimeout(() => setCopiedId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  if (!open) {
    return null;
  }

  const copyText = async (id: string, text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!ok) {
          throw new Error('copy_failed');
        }
      }
      setCopiedId(id);
      setCopyError(null);
    } catch {
      setCopyError(t('wv.rule_guide.copy_error'));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(920px, 100%)',
          maxHeight: 'min(88vh, 100%)',
          overflowY: 'auto',
          borderRadius: 8,
          border: '1px solid var(--vscode-panel-border, #454545)',
          background: 'var(--vscode-editor-background, #1e1e1e)',
          color: 'var(--vscode-editor-foreground, #d4d4d4)',
          padding: 16,
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{t('wv.rule_guide.title')}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--vscode-panel-border, #454545)',
              color: 'var(--vscode-editor-foreground, #d4d4d4)',
              borderRadius: 4,
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {t('wv.rule_guide.close')}
          </button>
        </div>

        <p style={{ margin: '0 0 10px 0', fontSize: 12, lineHeight: 1.6, color: 'var(--vscode-descriptionForeground, #9d9d9d)' }}>
          {t('wv.rule_guide.intro')}
        </p>

        <ol style={{ margin: '0 0 14px 18px', fontSize: 12, lineHeight: 1.7 }}>
          <li>{t('wv.rule_guide.step1')}</li>
          <li>{t('wv.rule_guide.step2')}</li>
          <li>{t('wv.rule_guide.step3')}</li>
          <li>{t('wv.rule_guide.step4')}</li>
        </ol>

        <div style={{ marginBottom: 10 }}>
          <button
            onClick={() => { void copyText('common', ARIA_COMMON_RULE_BLOCK); }}
            style={{
              background: 'var(--vscode-button-background, #0e639c)',
              color: 'var(--vscode-button-foreground, #ffffff)',
              border: 'none',
              borderRadius: 4,
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {t('wv.rule_guide.copy_common')}
          </button>
          {copiedId === 'common' && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--vscode-testing-iconPassed, #89d185)' }}>
              {t('wv.rule_guide.copied')}
            </span>
          )}
        </div>

        {copyError && (
          <div style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 4,
            border: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
            color: 'var(--vscode-errorForeground, #f48771)',
            fontSize: 12,
          }}>
            {copyError}
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {RULE_TARGETS.map((target) => (
            <section
              key={target.id}
              style={{
                border: '1px solid var(--vscode-panel-border, #454545)',
                borderRadius: 6,
                padding: 10,
                background: 'var(--vscode-editor-inactiveSelectionBackground, rgba(120,120,120,0.12))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{target.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>
                    {t('wv.rule_guide.target_prefix')}: {target.filePathKey ? t(target.filePathKey) : target.filePath}
                  </div>
                </div>
                <button
                  onClick={() => { void copyText(target.id, target.snippet); }}
                  style={{
                    background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                    color: 'var(--vscode-button-secondaryForeground, #cccccc)',
                    border: '1px solid var(--vscode-panel-border, #454545)',
                    borderRadius: 4,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('wv.rule_guide.copy_env')}
                </button>
              </div>

              <p style={{ margin: '6px 0 8px 0', fontSize: 11, color: 'var(--vscode-descriptionForeground, #9d9d9d)' }}>
                {t(target.noteKey)}
              </p>

              <pre style={{
                margin: 0,
                padding: 8,
                fontSize: 11,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'var(--vscode-textCodeBlock-background, rgba(120,120,120,0.12))',
                borderRadius: 4,
                border: '1px solid var(--vscode-panel-border, #454545)',
                maxHeight: 180,
                overflowY: 'auto',
              }}>
                {target.snippet}
              </pre>

              {copiedId === target.id && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--vscode-testing-iconPassed, #89d185)' }}>
                  {t('wv.rule_guide.copied')}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
