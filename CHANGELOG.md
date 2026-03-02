# Changelog

All notable changes to Brain Connector ARIA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-02-25

### Initial Release (Phase 1 MVP)

#### Added

- **Visual Canvas** — React Flow-based canvas for designing C4 model container architecture
- **Kanban Board** — Task management across Inbox / Todo / In Progress / Done
- **ADR Auto-generation** — Architecture Decision Records automatically created when adding nodes
- **GUI → File sync** — All state changes written to `.ai-context/` with 2-second debounce
  - `aria-state.json` (master state)
  - `status.md` (kanban tasks with ID anchors, AI-readable)
  - `architecture.mermaid` (Mermaid C4 diagram)
  - `.cursorrules` (AI behavior rules, write-once)
  - `adr/ADR-XXXX-*.md` (Architecture Decision Records)
- **Reverse sync** — FileSystemWatcher detects AI edits to `aria-state.json` and updates the canvas
- **State-First Reconciliation** — Node positions preserved when AI edits task data
- **Guard System** — Malformed IDs/statuses quarantined to Inbox; BOM-prefixed UTF-8 supported
- **Self-write loop prevention** — `isWriting` flag + 600ms cooldown prevents false trigger cycles
- **Loading skeleton** — Smooth loading state before initial data is received
- **Error banner** — Auto-dismissing error notification (5 seconds)
- **Welcome screen** — Shown on first launch with sample data button
- **Inbox approval workflow** — Link incoming tasks to canvas nodes before promoting to Todo
- **Inline title editing** — Double-click any task card to edit its title in place
- **Keyboard shortcuts**:
  - `Ctrl+N` (ARIA panel focused) — Add new task
  - `Ctrl+Shift+A` / `Cmd+Shift+A` — Open ARIA panel
- **Force sync command** — `ARIA: Sync Now (Force)` to immediately write all context files

---

*For upcoming features planned in Phase 2 (cloud sync, Stripe, GitHub integration), see the [project roadmap](https://github.com/yono-code/Brain-Connector-ARIA-Public).*
