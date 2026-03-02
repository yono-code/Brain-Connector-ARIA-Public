// ============================================================
// use-aria-keyboard.ts — Webview 内キーボードショートカット
// ============================================================
//
// ⚠️ VS Code のグローバルショートカットと競合する操作は
//    DOM keydown リスナーではなく package.json keybindings + VS Code コマンド経由で実装する。
//
// VS Code コマンド経由で実装済みのショートカット:
//   Ctrl+N → aria.addTask コマンド → ADD_TASK メッセージ → App.tsx の addTask()
//   （package.json: when: "activeWebviewPanelId == 'ariaPanel'"）
//
// このフックは現在プレースホルダー。
// VS Code と競合しない追加ショートカットが必要になった場合にここへ追加する。
// ============================================================

export function useAriaKeyboard(): void {
  // 現時点では DOM keydown で処理するショートカットなし
  // App.tsx から呼び出されているが、将来の拡張のためにフックとして残す
}
