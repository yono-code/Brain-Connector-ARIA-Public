export const CONFIGURED_LOCALES = ['auto', 'en', 'ja'] as const;
export const SUPPORTED_LOCALES = ['en', 'ja'] as const;

export type ConfiguredLocale = (typeof CONFIGURED_LOCALES)[number];
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface I18nSnapshot {
  configuredLocale: ConfiguredLocale;
  resolvedLocale: SupportedLocale;
}

const EN_MESSAGES = {
  'ext.error.panel_open': 'ARIA panel launch error: {{error}}',
  'ext.error.rule_guide_open': 'ARIA rule guide launch error: {{error}}',
  'ext.warn.workspace_not_open': 'ARIA: Workspace is not open.',
  'ext.warn.workspace_open_required': 'ARIA: Open a folder or workspace before using ARIA.',
  'ext.notify.synced': 'ARIA: Files synced ✓',
  'ext.error.sync_failed': 'ARIA: Sync error - {{error}}',
  'ext.notify.consent_revoked': 'ARIA: Consent has been revoked. Re-consent is required on the next operation.',
  'ext.error.activate_failed': 'ARIA activation error: {{error}}',
  'ext.notify.first_launch_guide': 'ARIA: Rule guide for AI environments is available. Review it during initial setup.',
  'ext.action.open_guide': 'Open Guide',
  'ext.action.later': 'Later',
  'ext.error.aria_state_parse': 'Failed to read aria-state.json: {{error}}',
  'ext.warn.tasks_quarantined': 'ARIA: {{count}} tasks were moved to Inbox due to invalid ID or status.',
  'ext.operation.ai_layout_sync_apply': 'Apply AI layout sync',
  'ext.operation.mindmap_export': 'Mindmap {{format}} export',
  'ext.warn.layout_sync_blocked': 'ARIA: AI layout sync changes were held because consent is required.',
  'ext.notify.layout_sync_applied': 'ARIA: AI layout sync changes were applied.',
  'ext.error.status_md_parse': 'Failed to read status.md: {{error}}',
  'ext.warn.status_md_quarantined': 'ARIA: {{count}} tasks were added to Inbox from status.md edits.',
  'ext.error.export_blocked': 'Export was cancelled because consent is not completed.',
  'ext.notify.export_done_path': 'Export completed: {{path}}',
  'ext.notify.export_done': 'ARIA: Export completed ({{format}})',
  'ext.error.export_failed': 'Export failed: {{error}}',
  'ext.error.invalid_png': 'Invalid PNG data.',
  'ext.error.file_write_failed': 'ARIA: Failed to write files - {{error}}',
  'ext.consent.mode_title': 'Select ARIA consent mode',
  'ext.consent.mode.always_allow.label': 'Always Allow',
  'ext.consent.mode.always_allow.desc': 'Recommended: no repeated prompt after initial consent',
  'ext.consent.mode.ask_high_risk_only.label': 'Ask High Risk Only',
  'ext.consent.mode.ask_high_risk_only.desc': 'Prompt only for high-risk operations',
  'ext.consent.mode.always_ask.label': 'Always Ask',
  'ext.consent.mode.always_ask.desc': 'Prompt every time (for verification)',
  'ext.consent.prompt': 'ARIA requires broad consent for this operation. Continue?',
  'ext.consent.detail.operation': 'Operation: {{value}}',
  'ext.consent.detail.scope': 'Scope: {{value}}',
  'ext.consent.detail.terms': 'Terms: {{value}}',
  'ext.consent.detail.risk': 'Risk: {{value}}',
  'ext.consent.detail.trigger': 'Trigger: {{value}}',
  'ext.consent.action.accept': 'Accept',
  'ext.consent.action.decline': 'Decline',
  'ext.generator.cursorrules_created': 'ARIA: .cursorrules was generated at the project root.',
  'wv.tab.c4': 'C4 Architecture',
  'wv.tab.adr': 'ADR',
  'wv.tab.mindmap': 'Semantic Network',
  'wv.tab.kanban': 'Task List',
  'wv.loading.message': 'Loading ARIA...',
  'wv.error.close_title': 'Close',
  'wv.toolbar.add_container_root': '+ Container',
  'wv.toolbar.add_container_inner': '+ Container (Inner)',
  'wv.toolbar.title_add_container_root': 'Add C4 container node',
  'wv.toolbar.title_add_container_inner': 'Add container inside the container layer',
  'wv.toolbar.add_component': '+ Component',
  'wv.toolbar.title_add_component': 'Add component inside the container layer',
  'wv.toolbar.editing': 'Editing: {{label}}',
  'wv.toolbar.add_node': '+ Node',
  'wv.toolbar.title_add_node': 'Add mindmap node',
  'wv.toolbar.undo': 'Undo',
  'wv.toolbar.redo': 'Redo',
  'wv.toolbar.snap_on': 'Snap: ON',
  'wv.toolbar.snap_off': 'Snap: OFF',
  'wv.toolbar.title_snap': 'Toggle snap guide',
  'wv.toolbar.export_md': 'Export MD',
  'wv.toolbar.export_svg': 'Export SVG',
  'wv.toolbar.export_png': 'Export PNG',
  'wv.toolbar.title_export_md': 'Export as Markdown',
  'wv.toolbar.title_export_svg': 'Export as SVG',
  'wv.toolbar.title_export_png': 'Export as PNG',
  'wv.toolbar.rule_guide': 'Rule Guide',
  'wv.toolbar.title_rule_guide': 'Open rule append guide by AI environment',
  'wv.toolbar.shortcut_hint': 'Ctrl+N: Add Task | Right Click: Menu',
  'wv.toolbar.language_label': 'Language',
  'wv.locale.option.auto': 'Auto',
  'wv.locale.option.en': 'English',
  'wv.locale.option.ja': 'Japanese',
  'wv.welcome.title': 'Welcome to ARIA',
  'wv.welcome.description': 'Manage your project in GUI and generate AI-ready context automatically.',
  'wv.welcome.start_sample': 'Start with Sample',
  'wv.welcome.add_node': '+ Add Node',
  'wv.welcome.hint': 'Tip: Use "+ Container" in toolbar or Ctrl+N to add a task',
  'wv.rule_guide.title': 'Project Rule Append Guide',
  'wv.rule_guide.close': 'Close',
  'wv.rule_guide.intro': 'Purpose: append ARIA shared rules to each AI environment project-rule file. Exact save path differs by environment, so confirm with official docs.',
  'wv.rule_guide.step1': 'Copy template for target environment',
  'wv.rule_guide.step2': 'Open the environment project-rule file',
  'wv.rule_guide.step3': 'Keep existing rules and append at the end',
  'wv.rule_guide.step4': 'Restart AI session if needed',
  'wv.rule_guide.copy_common': 'Copy Common Rules',
  'wv.rule_guide.copied': 'Copied',
  'wv.rule_guide.copy_error': 'Failed to copy to clipboard. Please copy manually.',
  'wv.rule_guide.target_prefix': 'Target',
  'wv.rule_guide.copy_env': 'Copy for This Environment',
  'wv.rule_guide.file.cline': 'Environment-specific project rules file',
  'wv.rule_guide.note.cursor': 'Append this block to the end of .cursorrules in project root.',
  'wv.rule_guide.note.copilot': 'Append this block to .github/copilot-instructions.md (create if missing).',
  'wv.rule_guide.note.cline': 'Save location depends on environment settings. Confirm official docs, then append at the end.',
  'seed.task.new': 'New Task',
  'seed.task.first': 'First Task',
  'seed.system.main': 'Main System',
  'seed.system.new': 'New System',
  'seed.container.new': 'New Container',
  'seed.component.new': 'New Component',
  'seed.node.mindmap': 'New Node',
} as const;

export type I18nKey = keyof typeof EN_MESSAGES;

const JA_MESSAGES: Record<I18nKey, string> = {
  'ext.error.panel_open': 'ARIA パネル起動エラー: {{error}}',
  'ext.error.rule_guide_open': 'ARIA ルールガイド起動エラー: {{error}}',
  'ext.warn.workspace_not_open': 'ARIA: ワークスペースが開かれていません。',
  'ext.warn.workspace_open_required': 'ARIA: フォルダまたはワークスペースを開いてから使用してください。',
  'ext.notify.synced': 'ARIA: ファイルを同期しました ✓',
  'ext.error.sync_failed': 'ARIA: 同期エラー - {{error}}',
  'ext.notify.consent_revoked': 'ARIA: 包括同意を撤回しました。次回操作時に再同意が必要です。',
  'ext.error.activate_failed': 'ARIA 起動エラー: {{error}}',
  'ext.notify.first_launch_guide': 'ARIA: AI環境別のプロジェクトルール追記ガイドを用意しています。初期セットアップ時に確認してください。',
  'ext.action.open_guide': 'ガイドを開く',
  'ext.action.later': '後で',
  'ext.error.aria_state_parse': 'aria-state.json の読み込みに失敗しました: {{error}}',
  'ext.warn.tasks_quarantined': 'ARIA: {{count}} 件のタスクが不正なIDまたはステータスのため Inbox に移動されました。',
  'ext.operation.ai_layout_sync_apply': 'AI同期レイアウト反映',
  'ext.operation.mindmap_export': 'Mindmap {{format}} export',
  'ext.warn.layout_sync_blocked': 'ARIA: AI同期レイアウト変更は同意が必要なため保留しました。',
  'ext.notify.layout_sync_applied': 'ARIA: AI同期レイアウト変更を反映しました。',
  'ext.error.status_md_parse': 'status.md の読み込みに失敗しました: {{error}}',
  'ext.warn.status_md_quarantined': 'ARIA: status.md の編集により {{count}} 件のタスクを Inbox に追加しました。',
  'ext.error.export_blocked': '同意が未完了のためエクスポートを中止しました。',
  'ext.notify.export_done_path': 'Export完了: {{path}}',
  'ext.notify.export_done': 'ARIA: Export完了 ({{format}})',
  'ext.error.export_failed': 'Exportに失敗しました: {{error}}',
  'ext.error.invalid_png': 'PNGデータが不正です',
  'ext.error.file_write_failed': 'ARIA: ファイル書き込みに失敗しました - {{error}}',
  'ext.consent.mode_title': 'ARIA 同意モードを選択',
  'ext.consent.mode.always_allow.label': '常に許可',
  'ext.consent.mode.always_allow.desc': '通常運用: 初回同意後は再確認なし（推奨）',
  'ext.consent.mode.ask_high_risk_only.label': '高リスク時のみ確認',
  'ext.consent.mode.ask_high_risk_only.desc': '高リスク操作のみ再確認',
  'ext.consent.mode.always_ask.label': '毎回確認',
  'ext.consent.mode.always_ask.desc': '毎回確認（検証向け）',
  'ext.consent.prompt': 'ARIAの包括同意が必要です。この操作を続行しますか？',
  'ext.consent.detail.operation': '対象: {{value}}',
  'ext.consent.detail.scope': 'スコープ: {{value}}',
  'ext.consent.detail.terms': '規約版: {{value}}',
  'ext.consent.detail.risk': 'リスク: {{value}}',
  'ext.consent.detail.trigger': 'トリガー: {{value}}',
  'ext.consent.action.accept': '同意する',
  'ext.consent.action.decline': '拒否する',
  'ext.generator.cursorrules_created': 'ARIA: .cursorrules をプロジェクトルートに生成しました。',
  'wv.tab.c4': 'C4アーキテクチャ',
  'wv.tab.adr': 'ADR',
  'wv.tab.mindmap': 'セマンティックネットワーク',
  'wv.tab.kanban': 'タスクリスト',
  'wv.loading.message': 'ARIA を読み込み中...',
  'wv.error.close_title': '閉じる',
  'wv.toolbar.add_container_root': '+ コンテナ',
  'wv.toolbar.add_container_inner': '+ コンテナ（内部）',
  'wv.toolbar.title_add_container_root': 'C4 コンテナノードを追加',
  'wv.toolbar.title_add_container_inner': 'コンテナレイヤー内にコンテナを追加',
  'wv.toolbar.add_component': '+ コンポーネント',
  'wv.toolbar.title_add_component': 'コンテナレイヤー内にコンポーネントを追加',
  'wv.toolbar.editing': '編集中: {{label}}',
  'wv.toolbar.add_node': '+ ノード',
  'wv.toolbar.title_add_node': 'マインドマップノードを追加',
  'wv.toolbar.undo': 'Undo',
  'wv.toolbar.redo': 'Redo',
  'wv.toolbar.snap_on': 'Snap: ON',
  'wv.toolbar.snap_off': 'Snap: OFF',
  'wv.toolbar.title_snap': 'スナップガイド切替',
  'wv.toolbar.export_md': 'Export MD',
  'wv.toolbar.export_svg': 'Export SVG',
  'wv.toolbar.export_png': 'Export PNG',
  'wv.toolbar.title_export_md': 'Markdown エクスポート',
  'wv.toolbar.title_export_svg': 'SVG エクスポート',
  'wv.toolbar.title_export_png': 'PNG エクスポート',
  'wv.toolbar.rule_guide': 'ルールガイド',
  'wv.toolbar.title_rule_guide': 'AI環境別のルール追記ガイドを表示',
  'wv.toolbar.shortcut_hint': 'Ctrl+N: タスク追加 | 右クリック: メニュー',
  'wv.toolbar.language_label': '言語',
  'wv.locale.option.auto': '自動',
  'wv.locale.option.en': '英語',
  'wv.locale.option.ja': '日本語',
  'wv.welcome.title': 'ARIA へようこそ',
  'wv.welcome.description': 'GUI でプロジェクト管理するだけで、AI 向けのコンテキストが自動生成されます。',
  'wv.welcome.start_sample': 'サンプルで始める',
  'wv.welcome.add_node': '+ ノードを追加',
  'wv.welcome.hint': 'ヒント: ツールバーの「+ コンテナ」または Ctrl+N でタスクを追加できます',
  'wv.rule_guide.title': 'プロジェクトルール追記ガイド',
  'wv.rule_guide.close': '閉じる',
  'wv.rule_guide.intro': '目的: ARIA の共通ルールを各AI環境のプロジェクトルール末尾に追記します。操作や保存先は環境ごとに異なるため、最終手順は各環境の公式ドキュメントを確認してください。',
  'wv.rule_guide.step1': '対象環境のテンプレートをコピー',
  'wv.rule_guide.step2': '対象のプロジェクトルールファイルを開く',
  'wv.rule_guide.step3': '既存ルールを残したまま末尾に追記して保存',
  'wv.rule_guide.step4': '必要なら AI セッションを再開始して反映確認',
  'wv.rule_guide.copy_common': '共通ルールのみコピー',
  'wv.rule_guide.copied': 'コピーしました',
  'wv.rule_guide.copy_error': 'クリップボードへのコピーに失敗しました。手動でコピーしてください。',
  'wv.rule_guide.target_prefix': '対象',
  'wv.rule_guide.copy_env': 'この環境向けをコピー',
  'wv.rule_guide.file.cline': '環境ごとの Project Rules ファイル',
  'wv.rule_guide.note.cursor': 'プロジェクトルートの .cursorrules の末尾に追記してください。',
  'wv.rule_guide.note.copilot': '既存ファイルがなければ .github/copilot-instructions.md を作成し、末尾に追記してください。',
  'wv.rule_guide.note.cline': '保存先は環境設定に依存します。公式ドキュメントで保存場所を確認して末尾追記してください。',
  'seed.task.new': '新しいタスク',
  'seed.task.first': '最初のタスク',
  'seed.system.main': 'メインシステム',
  'seed.system.new': '新しいシステム',
  'seed.container.new': '新しいコンテナ',
  'seed.component.new': '新しいコンポーネント',
  'seed.node.mindmap': '新しいノード',
};

const MESSAGES: Record<SupportedLocale, Record<I18nKey, string>> = {
  en: EN_MESSAGES,
  ja: JA_MESSAGES,
};

export function normalizeConfiguredLocale(raw: unknown): ConfiguredLocale {
  if (raw === 'en' || raw === 'ja' || raw === 'auto') {
    return raw;
  }
  return 'auto';
}

export function resolveLocale(
  configuredLocale: ConfiguredLocale,
  languageTag: string | undefined,
): SupportedLocale {
  if (configuredLocale !== 'auto') {
    return configuredLocale;
  }
  const normalized = (languageTag ?? '').toLowerCase();
  if (normalized.startsWith('ja')) {
    return 'ja';
  }
  return 'en';
}

export function translate(
  locale: SupportedLocale,
  key: I18nKey,
  params?: Record<string, string | number>,
): string {
  const template = MESSAGES[locale]?.[key] ?? EN_MESSAGES[key] ?? key;
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? '' : String(value);
  });
}
