// ============================================================
// AdrPanel.tsx — ADR 一覧・編集パネル（ADR タブ内）
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import type { ADR } from '../../../../src/shared/types';
import { useAriaStore } from '../../store/aria-store';
import { resolveAdrLinkedElementInfo } from './adr-utils';

export function AdrPanel() {
  const adrsMap = useAriaStore((s) => s.adrs);
  const nodesMap = useAriaStore((s) => s.nodes);
  const containerCanvases = useAriaStore((s) => s.containerCanvases);
  const updateADR = useAriaStore((s) => s.updateADR);
  const selectedAdrId = useAriaStore((s) => s.selectedAdrId);
  const setSelectedAdrId = useAriaStore((s) => s.setSelectedAdrId);

  const adrEntries = useMemo(
    () =>
      Object.values(adrsMap)
        .map((adr) => ({
          adr,
          elementInfo: resolveAdrLinkedElementInfo(adr.linkedNodeId, nodesMap, containerCanvases),
        }))
        .filter((entry) => entry.elementInfo.isC4Linked),
    [adrsMap, nodesMap, containerCanvases],
  );

  useEffect(() => {
    if (adrEntries.length === 0) {
      setSelectedAdrId(null);
      return;
    }
    const hasSelected = selectedAdrId && adrEntries.some((entry) => entry.adr.id === selectedAdrId);
    if (!hasSelected) {
      setSelectedAdrId(adrEntries[0].adr.id);
    }
  }, [adrEntries, selectedAdrId, setSelectedAdrId]);

  const selectedEntry = adrEntries.find((entry) => entry.adr.id === selectedAdrId) ?? null;
  const selectedAdr = selectedEntry?.adr ?? null;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--vscode-editor-background, #1e1e1e)',
    }}>
      {/* 左ペイン: ADR 一覧 */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderRight: '1px solid var(--vscode-panel-border, #454545)',
        overflow: 'auto',
        padding: '8px 0',
        background: 'var(--vscode-sideBar-background, #252526)',
      }}>
        <div style={{
          padding: '4px 12px 8px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--vscode-descriptionForeground, #9d9d9d)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
        }}>
          ADR 一覧
        </div>

        {adrEntries.length === 0 ? (
          <div style={{
            padding: '16px 12px',
            fontSize: 12,
            color: 'var(--vscode-descriptionForeground, #9d9d9d)',
            lineHeight: 1.6,
          }}>
            C4ノードに紐づく ADR はまだありません。<br />
            C4 コンテナ/コンポーネントを追加してください。
          </div>
        ) : (
          adrEntries.map((entry) => (
            <AdrListItem
              key={entry.adr.id}
              adr={entry.adr}
              elementName={entry.elementInfo.elementName}
              nodeLabel={entry.elementInfo.locationLabel}
              isSelected={entry.adr.id === selectedAdrId}
              onClick={() => setSelectedAdrId(entry.adr.id)}
            />
          ))
        )}
      </div>

      {/* 右ペイン: 編集フォーム */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {selectedAdr ? (
          <AdrEditForm
            key={selectedAdr.id}
            adr={selectedAdr}
            nodeLabel={selectedEntry?.elementInfo.locationLabel ?? selectedAdr.linkedNodeId}
            onSave={(patch) => updateADR(selectedAdr.id, patch)}
          />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--vscode-descriptionForeground, #9d9d9d)',
            fontSize: 13,
          }}>
            左の一覧から ADR を選択してください
          </div>
        )}
      </div>
    </div>
  );
}

// ----- ADR リストアイテム -----

function AdrListItem({
  adr,
  elementName,
  nodeLabel,
  isSelected,
  onClick,
}: {
  adr: ADR;
  elementName: string;
  nodeLabel: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '8px 12px',
        textAlign: 'left',
        border: 'none',
        background: isSelected
          ? 'var(--vscode-list-activeSelectionBackground, #094771)'
          : 'transparent',
        color: isSelected
          ? 'var(--vscode-list-activeSelectionForeground, #ffffff)'
          : 'var(--vscode-editor-foreground, #d4d4d4)',
        cursor: 'pointer',
        borderLeft: isSelected
          ? '2px solid var(--vscode-focusBorder, #007acc)'
          : '2px solid transparent',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, wordBreak: 'break-all' }}>
        📌 {elementName}
      </div>
      <div style={{
        fontSize: 10,
        marginTop: 2,
        color: isSelected
          ? 'rgba(255,255,255,0.7)'
          : 'var(--vscode-descriptionForeground, #9d9d9d)',
      }}>
        📄 {adr.title || '（タイトルなし）'}
      </div>
      <div style={{
        fontSize: 10,
        marginTop: 2,
        opacity: 0.9,
        color: isSelected
          ? 'rgba(255,255,255,0.7)'
          : 'var(--vscode-descriptionForeground, #9d9d9d)',
      }}>
        🔗 {nodeLabel}
      </div>
    </button>
  );
}

// ----- ADR 編集フォーム -----

type AdrPatch = Partial<Pick<ADR, 'title' | 'decision' | 'rejectedOptions'>>;

function AdrEditForm({
  adr,
  nodeLabel,
  onSave,
}: {
  adr: ADR;
  nodeLabel: string;
  onSave: (patch: AdrPatch) => void;
}) {
  const [title,    setTitle]    = useState(adr.title);
  const [decision, setDecision] = useState(adr.decision);
  const [rejected, setRejected] = useState<string[]>(adr.rejectedOptions);
  const [newOption, setNewOption] = useState('');
  const [saved,    setSaved]    = useState(false);

  const handleSave = () => {
    onSave({ title: title.trim(), decision, rejectedOptions: rejected });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleAddOption = () => {
    const trimmed = newOption.trim();
    if (trimmed && !rejected.includes(trimmed)) {
      setRejected((prev) => [...prev, trimmed]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (opt: string) => {
    setRejected((prev) => prev.filter((o) => o !== opt));
  };

  return (
    <div style={{ maxWidth: 640 }}>
      {/* ヘッダー: ノード情報 */}
      <div style={{
        fontSize: 11,
        color: 'var(--vscode-descriptionForeground, #9d9d9d)',
        marginBottom: 16,
      }}>
        🔗 {nodeLabel}
      </div>

      {/* タイトル */}
      <FormField label="タイトル">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
      </FormField>

      {/* 決定内容 */}
      <FormField label="決定内容">
        <textarea
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          rows={5}
          placeholder="このコンポーネント/システムについてどのような設計決定を行いましたか？"
          style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}
        />
      </FormField>

      {/* 却下した選択肢 */}
      <FormField label="却下した選択肢">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rejected.map((opt) => (
            <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                flex: 1,
                padding: '4px 8px',
                background: 'var(--vscode-input-background, #3c3c3c)',
                border: '1px solid var(--vscode-panel-border, #454545)',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--vscode-editor-foreground, #d4d4d4)',
              }}>
                {opt}
              </span>
              <button
                onClick={() => handleRemoveOption(opt)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--vscode-errorForeground, #f48771)',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '0 4px',
                }}
              >
                ×
              </button>
            </div>
          ))}

          {/* 新規追加 */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(); } }}
              placeholder="却下した選択肢を入力..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleAddOption}
              style={{
                background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                color: 'var(--vscode-button-secondaryForeground, #d4d4d4)',
                border: 'none',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              + 追加
            </button>
          </div>
        </div>
      </FormField>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        style={{
          marginTop: 8,
          background: saved
            ? 'var(--vscode-testing-iconPassed, #4caf50)'
            : 'var(--vscode-button-background, #0e639c)',
          color: 'var(--vscode-button-foreground, #ffffff)',
          border: 'none',
          borderRadius: 4,
          padding: '6px 20px',
          cursor: 'pointer',
          fontSize: 12,
          transition: 'background 0.2s',
        }}
      >
        {saved ? '✓ 保存しました' : '保存'}
      </button>
    </div>
  );
}

// ----- フォームフィールド共通 -----

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--vscode-descriptionForeground, #9d9d9d)',
        marginBottom: 6,
        letterSpacing: '0.03em',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  fontSize: 12,
  background: 'var(--vscode-input-background, #3c3c3c)',
  color: 'var(--vscode-input-foreground, #d4d4d4)',
  border: '1px solid var(--vscode-input-border, #454545)',
  borderRadius: 4,
  outline: 'none',
};
