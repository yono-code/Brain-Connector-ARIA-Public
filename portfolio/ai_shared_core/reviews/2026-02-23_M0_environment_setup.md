# 作業レポート: M0 環境構築

**日付**: 2026-02-23
**担当**: Claude
**ステータス**: M0-1〜M0-4 完了 / M0-5 は手動確認待ち

---

## 実施内容

### M0-1: VS Code Extension 雛形作成

`yo code` が未インストールのため、手動でプロジェクト構造を作成。

**作成ファイル:**
- `package.json` — `aria-vscode@0.1.0`、esbuild/concurrently を devDependencies に含む
- `tsconfig.json` — Extension Host（CJS環境）向けの TypeScript 設定
- `.gitignore` — `node_modules/`、`dist/`、`.ai-context/` を除外
- `.vscodeignore` — Marketplace 公開時の除外設定
- `.vscode/launch.json` — F5 起動設定
- `.vscode/tasks.json` — Build All タスク
- `src/extension.ts` — 最小限の Webview 表示コード
- `src/shared/types.ts` — 全型定義（`KanbanTask`、`ADR`、`AriaState`、postMessage 型）

### M0-2: Webview 用 React プロジェクト設定

`webview/` フォルダには既に Vite 雛形が生成されていたため、設定の上書きのみ実施。

**変更ファイル:**
- `webview/vite.config.ts` — `outDir: dist/webview`、`base: './'`、Tailwind プラグイン追加
- `webview/tsconfig.json` / `tsconfig.app.json` — `@/*` エイリアス追加
- `webview/index.html` — vite.svg アイコン削除、タイトルを ARIA に変更
- `webview/src/App.tsx` — 「Hello ARIA」確認用 UI に置き換え
- `webview/src/App.css` — VS Code テーマ CSS 変数対応のベーススタイルに書き換え
- `webview/src/index.css` — Tailwind v4 import + 最小限スタイルに整理

### M0-3: 依存ライブラリ確定・インストール

| ライブラリ | バージョン | 備考 |
|----------|----------|------|
| `@xyflow/react` | **12.10.1**（固定） | 最新安定版を確認後インストール |
| `zustand` | 最新 | Webview 側の状態管理 |
| `tailwindcss` | v4系（`@tailwindcss/vite` 経由） | shadcn/ui の前提条件 |
| `shadcn/ui` | 最新 | button / card / badge を追加 |

### M0-4: ビルドパイプライン構築

**実行結果:**
```
npm run build:extension → dist/extension.js  2.8kb  ✅
npm run build:webview   → dist/webview/main.js 193.47kb  ✅
npm run build:all       → 両方成功  ✅
```

---

## 発見・修正したバグ

### バグ1: `[extref]` は Rollup の無効なプレースホルダー
- **発生箇所**: `M0_environment_setup.md` スペックキットのコードサンプル
- **症状**: `npm run build:webview` がビルドエラーで終了
- **修正**: `assetFileNames: 'assets/[name][extref]'` → `'assets/[name][extname]'`
- **対象**: `webview/vite.config.ts` と `ai_shared/specs/M0_environment_setup.md` の両方を修正済み

---

## 残タスク

### M0-5: Webview 基本表示確認（手動実施が必要）

VS Code で F5 を押してデバッグ起動し、以下を確認:
1. Extension Development Host ウィンドウが開く
2. コマンドパレット（Ctrl+Shift+P）から「ARIA: Open Panel」を実行
3. パネル内に「ARIA」「AI-driven Requirement & Integration Architecture」が表示される

---

## 次のステップ

M0-5 の手動確認後、M1（Extension Host 基盤）と M2（Webview + React Flow）を並行して着手できる状態。

M1 の最優先タスクは **M1-2（postMessage 型定義）** — `src/shared/types.ts` はすでに M0-1 で作成済みのため、M1-2 は実質完了している。

---

*作成: 2026-02-23*
