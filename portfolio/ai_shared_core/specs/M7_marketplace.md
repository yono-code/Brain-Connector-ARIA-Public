# [M7] Marketplace 公開準備 — スペックキット

## 概要

- **目的**: VS Code Marketplace への公開に必要な全準備を整える
- **ゴール**: `vsce publish` が成功し、Marketplace で ARIA 拡張機能が公開される
- **前提条件**: M6（UI/UX 仕上げ）完了 + End-to-End テスト全項目パス
- **推定工数**: 1週間

---

## タスク一覧（チェックリスト形式）

- [ ] M7-1: `package.json` メタデータの完成
- [ ] M7-2: Marketplace 向け `README.md` の作成（英語）
- [ ] M7-3: `CHANGELOG.md` の作成
- [ ] M7-4: 拡張機能アイコンの作成（128×128px PNG）
- [ ] M7-5: `.vscodeignore` の最終確認
- [ ] M7-6: `vsce package` でパッケージング
- [ ] M7-7: ローカルインストールテスト（`.vsix` から）
- [ ] M7-8: Publisher アカウント・PAT の準備
- [ ] M7-9: Marketplace への公開

---

## 技術仕様・実装ガイド

### M7-1: package.json 完成版

```json
{
  "name": "aria-vscode",
  "displayName": "ARIA — AI-driven Requirement & Integration Architecture",
  "description": "Automatically generate AI-ready context (Markdown/Mermaid) just by managing your project in the GUI.",
  "version": "0.1.0",
  "publisher": "your-publisher-id",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": [
    "Other",
    "Notebooks",
    "Visualization"
  ],
  "keywords": [
    "ai", "project management", "markdown", "mermaid", "react flow",
    "kanban", "c4 model", "adr", "context", "llm"
  ],
  "icon": "assets/icon.png",
  "galleryBanner": {
    "color": "#1e1e2e",
    "theme": "dark"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/aria-vscode"
  },
  "license": "MIT",
  "activationEvents": [
    "onCommand:aria.openPanel"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "aria.openPanel",
        "title": "ARIA: Open Panel",
        "category": "ARIA",
        "icon": "$(project)"
      },
      {
        "command": "aria.syncNow",
        "title": "ARIA: Sync Now (Force)",
        "category": "ARIA"
      }
    ],
    "keybindings": [
      {
        "command": "aria.openPanel",
        "key": "ctrl+shift+a",
        "mac": "cmd+shift+a",
        "when": "!terminalFocus"
      }
    ],
    "menus": {
      "commandPalette": [
        { "command": "aria.openPanel" },
        { "command": "aria.syncNow" }
      ]
    }
  }
}
```

---

### M7-2: README.md の構成（英語）

Marketplace 向け README は英語で記述する（日本語は内部ドキュメントのみ）。

```markdown
# ARIA — AI-driven Requirement & Integration Architecture

> **Manage your project in the GUI. AI context is auto-generated.**

## Features

- **Visual Canvas**: Design your system architecture using C4 model nodes with React Flow
- **Kanban Board**: Track tasks across Inbox / Todo / In Progress / Done
- **ADR Management**: Record architecture decisions alongside your design
- **Auto-sync**: Every GUI change automatically generates `.ai-context/` files for your AI assistant
- **Reverse Sync**: Changes made by AI to `aria-state.json` are reflected back to the GUI

## Getting Started

1. Install ARIA from the VS Code Marketplace
2. Open a folder/workspace
3. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)
4. Start adding nodes and tasks

## How It Works

[Architecture diagram or GIF here]

The `.ai-context/` directory is automatically created in your workspace:

\`\`\`
.ai-context/
├── aria-state.json        ← Master state (GUI layout + all data)
├── status.md              ← Kanban tasks (AI-readable, bidirectional)
├── architecture.mermaid   ← C4 Context diagram (AI-readable)
└── adr/
    └── ADR-0001-xxxx.md   ← Architecture Decision Records
\`\`\`

## Requirements

- VS Code 1.85.0 or later
- An open workspace folder

## Known Limitations (v0.1.0)

- Local-only (cloud sync coming in Phase 2)
- `architecture.mermaid` is one-way output (GUI → file)

## Feedback

Found a bug? Have a feature request? Please open an issue on GitHub.
```

---

### M7-4: アイコン仕様

- **サイズ**: 128×128px
- **形式**: PNG（SVGは一部環境で表示されないため不可）
- **配置場所**: `assets/icon.png`
- **デザイン指針**: ARIA の頭文字「A」をモチーフにした幾何学的デザイン、背景は暗い青系

---

### M7-5: .vscodeignore

```
# ソースコード（dist/ のみ含める）
src/
webview/src/
webview/public/
webview/index.html
webview/vite.config.ts
webview/package.json
webview/tsconfig.json
webview/node_modules/

# 開発用設定
.vscode/launch.json
.vscode/tasks.json
.eslintrc.json
.prettierrc
tsconfig.json
esbuild.js
build-extension.mjs

# テスト
**/*.test.ts
**/*.spec.ts
test/

# プロジェクト管理ドキュメント（AI向け）
ai_shared/
DEVELOPMENT_PHILOSOPHY.md
*.docx

# その他
node_modules/
.git/
.gitignore
*.vsix
*.map
```

---

### M7-6〜M7-9: パッケージングと公開手順

```bash
# 1. vsce のインストール（初回のみ）
npm install -g @vscode/vsce

# 2. パッケージング（.vsix ファイル生成）
npm run build:all  # 先にビルドを実行
npx vsce package

# 3. パッケージ内容の確認
npx vsce ls        # 含まれるファイルを一覧表示

# 4. サイズ確認（5MB 以下を目標）
ls -lh *.vsix

# 5. ローカルインストールテスト
# VS Code で「Extensions: Install from VSIX...」から .vsix を選択

# 6. Publisher アカウントへのログイン（PAT が必要）
npx vsce login your-publisher-id

# 7. Marketplace への公開
npx vsce publish
```

**PAT（Personal Access Token）の取得**:
1. https://dev.azure.com にアクセスしてサインイン
2. 右上のユーザーアイコン → Personal access tokens
3. New Token を作成:
   - Organization: All accessible organizations
   - Scopes: Marketplace → Manage
4. トークンをコピー（一度しか表示されない）

---

## End-to-End テスト（公開前に必ず実施）

```
[ ] GUI → AI 方向
    [ ] ノードを追加・接続 → architecture.mermaid が生成される
    [ ] タスクを作成・ステータス変更 → status.md が更新される（IDアンカー付き）
    [ ] .cursorrules と adr/ADR-xxxx.md が自動生成される

[ ] AI → GUI 方向
    [ ] aria-state.json のタスクステータスを手動変更 → カンバンが更新される
    [ ] aria-state.json に不正タスク追加 → Inbox に隔離される

[ ] 永続性
    [ ] VS Code を閉じて再起動 → すべてのデータが復元される
    [ ] 別のフォルダを開いてARIAを起動 → そのフォルダのデータが読み込まれる

[ ] エラー耐性
    [ ] aria-state.json を不正JSONに書き換える → GUIがクラッシュしない
    [ ] ワークスペースなしでARIAを起動 → エラーメッセージが表示される
```

---

## 完了条件（Acceptance Criteria）

1. `vsce package` が警告ゼロで完了する
2. 生成された `.vsix` ファイルのサイズが 5MB 以下である
3. `.vsix` をクリーンな VS Code インスタンスにインストールして動作確認が完了する
4. `README.md` にスクリーンショットまたはデモGIFが含まれている
5. `CHANGELOG.md` に v0.1.0 の内容が記載されている
6. `vsce publish` が成功し、Marketplace ページが表示される

---

## 参照ファイル

- `ai_shared/specs/M6_ux_polish.md` — UI/UX 仕上げ（前提）
- VS Code 公開ガイド: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- vsce ドキュメント: https://github.com/microsoft/vscode-vsce

---

*最終更新: 2026-02-23 | バージョン: 1.0.0*
