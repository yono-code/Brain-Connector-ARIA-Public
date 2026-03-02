# Brain Connector ARIA — AI-driven Requirement & Integration Architecture

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

## Extension Commands

| Command | Description |
|---------|-------------|
| `Brain Connector ARIA: Open Panel` | Open the Brain Connector ARIA GUI panel |
| `Brain Connector ARIA: Sync Now (Force)` | Immediately write all `.ai-context/` files (skip debounce) |

---

## Feedback & Contributing

Found a bug or have a feature request? Please open an issue on [GitHub](https://github.com/yono-code/Brain-Connector-ARIA-Public/issues).

For legal/security/private reports, use the private channel:

- `support@brain-connector-aria.local` (placeholder address; replace before public release)

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
