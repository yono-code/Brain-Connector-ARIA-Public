# Changelog

All notable changes to Brain Connector ARIA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.2] — 2026-03-07

### Fixed

- C4 の双方向/2本双方向ライン描画を見やすく改善（動的オフセットで重なりを緩和）
- C4 ラベル表示を動的座標補正し、双方向ライン時の重なりを緩和
- セマンティックネットワークのメモマーク（🗒️）hoverで実メモ内容を表示

---

## [0.2.1] — 2026-03-07

### Fixed

- ARIA パネルが空白になるケースを修正（Canvas の store 購読方法を安定化）

---

## [0.2.0] — 2026-03-07

### Added

- C4/Container 用の自動整列 (`dagre`) と、セマンティックネットワーク整列の共通実行導線
- 整列ショートカット `Ctrl/Cmd+Shift+L`（C4/セマンティックネットワーク共通）
- C4 ライン編集UI（種別: 片方向/逆方向/両端/2本双方向、ラベル編集、手動削除）
- C4/セマンティックネットワーク両方のライン右クリック削除導線
- C4 ノード右クリックから「対応 ADR を開く」導線
- VS Code Activity Bar から起動できる ARIA サイドバー導線
- AI JSON編集向け edge サニタイズ/リコンシリエーション/mermaid生成の variant 対応テスト

### Changed

- `AriaEdge` に `variant` / `sourceLabel` / `targetLabel` を追加
- `aria-store` に `updateEdge` / `deleteEdge` / `alignSurface` / `alignCurrentSurface` / `selectAdrByNodeId` を追加
- Canvas の surface 購読方式を修正し、Container layer のノード追加・接続・ドラッグ反映を即時化
- Task 編集フォームに「関連ノード」表示を追加
- README を日本語先頭・英語後半の構成へ再編

---

## [0.1.3] — 2026-03-04

### Fixed

- Mermaid import dialog now opens with an empty input field by default.

---

## [0.1.2] — 2026-03-04

### Fixed

- Mindmap `Align Tree` now anchors layout on the top-most root node instead of selected descendants.
- Sibling nodes in the same generation are aligned vertically in the same column.
- Descendants are laid out farther from the root by generation depth for a standard rooted-tree arrangement.

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
