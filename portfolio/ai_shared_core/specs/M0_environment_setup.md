# [M0] 環境構築とプロジェクト骨格 — スペックキット

## 概要

- **目的**: 開発環境を構築し、VS Code Extension 内の Webview に React アプリが表示される最小構成を作る
- **ゴール**: `F5` キー一つで Extension が起動し、Webview 内に React アプリが表示される
- **前提条件**: なし（起点）
- **推定工数**: 1週間
- **依存マイルストーン**: なし

---

## タスク一覧（チェックリスト形式）

- [ ] M0-1: VS Code Extension 雛形作成
- [ ] M0-2: Webview 用 React プロジェクト設定
- [ ] M0-3: 依存ライブラリ確定・インストール
- [ ] M0-4: ビルドパイプライン構築
- [ ] M0-5: Webview 基本表示確認

---

## 技術仕様・実装ガイド

### M0-1: VS Code Extension 雛形作成

```bash
# yeoman と vscode extension generator をインストール
npm install -g yo generator-code

# 拡張機能テンプレートを生成
yo code

# 選択項目:
# - What type of extension: New Extension (TypeScript)
# - Extension name: aria
# - Extension identifier: aria-vscode
# - Description: AI-driven Requirement & Integration Architecture
# - Initialize git: Yes
# - Bundle the source code: Yes (esbuild)
# - Package manager: npm
```

**生成後に確認する `package.json` の設定**:

```json
{
  "name": "aria-vscode",
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "aria.openPanel",
        "title": "ARIA: Open Panel"
      }
    ]
  }
}
```

---

### M0-2: Webview 用 React プロジェクト設定

プロジェクトルートに `webview/` フォルダを作成し、Vite + React + TypeScript を設定する。

```bash
# webview フォルダを作成して Vite プロジェクト初期化
mkdir webview && cd webview
npm create vite@latest . -- --template react-ts
npm install
```

**`webview/vite.config.ts`**:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // VS Code Webview は単一HTMLファイルを要求する
    outDir: path.resolve(__dirname, '../dist/webview'),
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        // チャンク分割を無効化（単一 JS ファイルにする）
        manualChunks: undefined,
        entryFileNames: 'main.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  base: './', // 相対パスで参照するため必須
});
```

---

### M0-3: 依存ライブラリ確定・インストール

```bash
# webview/ フォルダ内で実行
cd webview

# React Flow UI（最新安定版を事前に確認すること）
npm install @xyflow/react

# 状態管理
npm install zustand

# UI コンポーネント（shadcn/ui）
npx shadcn@latest init
# → Style: Default
# → Base color: Slate
# → CSS variables for colors: Yes

# shadcn/ui の初期コンポーネント追加
npx shadcn@latest add button card badge
```

> **重要**: `@xyflow/react` のバージョンを必ず確認する。旧 `reactflow` パッケージとは非互換。
> インストール後、`package.json` のバージョンを `~` なしで固定すること（例: `"@xyflow/react": "12.3.0"`）。

---

### M0-4: ビルドパイプライン構築

ルートの `package.json` に以下のスクリプトを追加する:

```json
{
  "scripts": {
    "vscode:prepublish": "npm run build:all",
    "build:extension": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node",
    "build:webview": "cd webview && npm run build",
    "build:all": "npm run build:extension && npm run build:webview",
    "watch:extension": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node --watch",
    "watch:webview": "cd webview && npm run dev",
    "dev": "concurrently \"npm run watch:extension\" \"npm run watch:webview\""
  }
}
```

```bash
# concurrently のインストール（開発依存）
npm install --save-dev concurrently esbuild
```

**`.vscode/launch.json`** を確認・更新:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

**`.vscode/tasks.json`**:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build All",
      "type": "shell",
      "command": "npm run build:all",
      "group": { "kind": "build", "isDefault": true }
    }
  ]
}
```

---

### M0-5: Webview 基本表示確認

`src/extension.ts` に最小限のWebview表示コードを実装する:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('aria.openPanel', () => {
      const panel = vscode.window.createWebviewPanel(
        'ariaPanel',
        'ARIA',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
          ],
          retainContextWhenHidden: true,
        }
      );

      // dist/webview/index.html を読み込んでWebviewに設定
      const webviewPath = vscode.Uri.joinPath(
        context.extensionUri, 'dist', 'webview', 'index.html'
      );
      let html = fs.readFileSync(webviewPath.fsPath, 'utf-8');

      // VS Code Webview の CSP に合わせてスクリプトソースを書き換える
      const webviewUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')
      );
      html = html.replace(/src="\.\/main\.js"/, `src="${webviewUri}/main.js"`);
      html = html.replace(/href="\.\/assets\//g, `href="${webviewUri}/assets/`);

      panel.webview.html = html;
    })
  );
}

export function deactivate() {}
```

---

## ハマりどころ

### ハマり1: Vite ビルド後の HTML パス問題

Vite が生成する `index.html` のスクリプト参照パスは相対パス（`./main.js`）になる。
VS Code Webview では `vscode-resource:` スキームが必要なため、Extension 側でパスを書き換える必要がある。

上記の `html.replace()` コードで対処できる。

### ハマり2: esbuild の `--external:vscode`

Extension Host のビルドに esbuild を使う場合、`vscode` モジュールは VS Code のランタイムが提供するため、バンドルに含めてはいけない。`--external:vscode` フラグを必ず付けること。

### ハマり3: Webview 内での `process` や `__dirname`

Vite でビルドした Webview のコードには `process.env` や `__dirname` が存在しない（ブラウザ環境）。Extension Host 側のコードと混同しないように注意。

---

## 完了条件（Acceptance Criteria）

1. `npm run build:all` がエラーなく完了する
2. VS Code で F5 キーを押すと Extension Development Host ウィンドウが開く
3. コマンドパレットから「ARIA: Open Panel」を実行するとパネルが開く
4. パネル内に React アプリの何らかのUI（最低限「Hello ARIA」等のテキスト）が表示される
5. `npm run dev` でウォッチモードが起動し、ファイル変更時にリビルドが走る

---

## 参照ファイル

- `ai_shared/plans/phase1_mvp_plan.md` — 全体プラン
- VS Code Extension API ドキュメント: https://code.visualstudio.com/api
- React Flow UI 公式: https://reactflow.dev

---

*最終更新: 2026-02-23 | バージョン: 1.0.0*
