# Brain Connector ARIA

## 日本語ガイド

> **GUIで管理すると、AI向けコンテキストが自動生成されます。**

Brain Connector ARIA は、プロジェクト管理と AI 支援開発をつなぐ VS Code 拡張です。  
ノード追加、タスク更新、ADR編集などの操作は `.ai-context/` に即時反映され、AI が読める形式で保持されます。

### 主な機能

- C4 アーキテクチャ編集（Context / Container）
- セマンティックネットワーク編集（マインドマップ）
- Kanban（Inbox / Todo / In Progress / Done）
- ADR 管理（C4 ノード追加時に自動生成）
- 双方向同期（GUI -> ファイル / ファイル -> GUI）
- C4 / セマンティックネットワークの整列（`Ctrl/Cmd+Shift+L`）
- C4 ライン編集（種別・ラベル・削除）

### クイックスタート

1. VS Code Marketplace から **Brain Connector ARIA** をインストール
2. フォルダまたはワークスペースを開く
3. `Ctrl+Shift+A`（Mac: `Cmd+Shift+A`）で ARIA パネルを開く
4. `+ Container` で最初のノードを追加
5. `.ai-context/` に `aria-state.json`, `status.md`, `architecture.mermaid` が生成されることを確認

### 補足

- `architecture.mermaid` は `aria-state.json` から生成される派生ファイルです
- Local-First 方針により、外部ネットワーク依存は標準では追加しません

---

## English

> **Manage your project in the GUI. AI-ready context is auto-generated.**

Brain Connector ARIA is a VS Code extension that bridges the gap between human project management and AI-assisted development. Every action you take in the GUI — adding nodes, updating tasks, making architecture decisions — is automatically reflected in machine-readable files that your AI assistant can instantly understand.

---

## Features

- **Visual Canvas**: Design your system architecture using C4 model containers with React Flow
- **Kanban Board**: Track tasks across **Inbox / Todo / In Progress / Done** columns
- **ADR Management**: Architecture Decision Records are auto-generated when you add a node
- **Auto-sync (GUI → Files)**: Every GUI change is debounced and written to `.ai-context/` within 2 seconds
- **Reverse Sync (Files → GUI)**: AI edits to `aria-state.json` and task edits in `status.md` are reflected back to the canvas in real time
- **Guard System**: Malformed data is automatically quarantined to the Inbox instead of crashing the UI
- **Keyboard Shortcuts**: `Ctrl+N` to add a task, `Ctrl+Shift+A` to open the panel

---

## Getting Started

1. Install **Brain Connector ARIA** from the VS Code Marketplace
2. Open a folder or workspace (`File > Open Folder...`)
3. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac) to open the Brain Connector ARIA panel
4. Click **"+ Container"** to add your first architecture node
5. Tasks and ADRs appear automatically — check `.ai-context/` in your workspace

---

## How It Works

Brain Connector ARIA automatically creates and maintains a `.ai-context/` directory in your workspace:

```
.ai-context/
├── aria-state.json        ← Master state (GUI layout + all data)
├── status.md              ← Kanban tasks (AI-readable, bidirectional sync)
├── architecture.mermaid   ← C4 Context diagram (generated from canvas)
├── .cursorrules           ← AI behavior rules (auto-generated, write-once)
└── adr/
    └── ADR-0001-xxxx.md   ← Architecture Decision Records
```

### Bidirectional Sync

```
You (GUI)  ──► aria-state.json ──► status.md / architecture.mermaid / ADRs
                     ▲
Your AI  ────────────┘  (Brain Connector ARIA detects changes and updates the canvas)
```

**State-First Reconciliation**: When an AI edits `aria-state.json`, Brain Connector ARIA merges the changes while preserving your node positions on the canvas.
Task checkbox/title edits in `status.md` are also parsed and synced back to `aria-state.json`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+A` / `Cmd+Shift+A` | Open Brain Connector ARIA panel |
| `Ctrl+N` (Brain Connector ARIA panel focused) | Add new task |

---

## Requirements

- VS Code **1.85.0** or later
- An open workspace folder (Brain Connector ARIA needs a folder to write `.ai-context/`)

---

## Known Limitations (v0.1.0)

- **Local only** — external sync/network transport is intentionally out of scope in this release line
- `architecture.mermaid` is one-way output (GUI → file); reverse parse is not yet supported
- Single workspace only (multi-root workspace support planned)

---

## Core Build Docs

Public portfolio docs for core feature construction are available in:

- `portfolio/ai_shared_core/`

This slice excludes legal/FTO and medium-or-higher risk records.

---

## Extension Commands

| Command | Description |
|---------|-------------|
| `Brain Connector ARIA: Open Panel` | Open the Brain Connector ARIA GUI panel |
| `Brain Connector ARIA: Sync Now (Force)` | Immediately write all `.ai-context/` files (skip debounce) |

---

## Feedback & Contributing

Found a bug or have a feature request? Please open an issue on [GitHub](https://github.com/yono-code/Brain-Connector-ARIA-Public/issues).

For legal/security/private reports, use the private channel:

- `yonogames.dev@gmail.com`

Do not post personal data or confidential details in public issues.

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
AI agent entry point: [AGENTS.md](AGENTS.md).

---

## Legal & Policy

- Software license: [Apache License 2.0](LICENSE)
- Usage policy (Japanese): [TERMS.ja.md](TERMS.ja.md)

---

## License

[Apache License 2.0](LICENSE)
