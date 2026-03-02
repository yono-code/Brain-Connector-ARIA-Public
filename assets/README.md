# assets/

このディレクトリには拡張機能のアイコン等の静的アセットを配置します。

## 必要なファイル

| ファイル | サイズ | 説明 |
|---------|-------|------|
| `icon.png` | **128×128px PNG** | Marketplace アイコン（必須） |

## アイコン作成ガイド

- デザイン: 「A」をモチーフにした幾何学的デザイン、背景は暗い青系（#1e1e2e）
- 形式: **PNG のみ**（SVG は一部環境で表示されないため使用不可）
- package.json に追加:
  ```json
  "icon": "assets/icon.png"
  ```

## アイコン完成後の作業

1. `assets/icon.png` を配置
2. `package.json` に `"icon": "assets/icon.png"` を追加
3. `npm run build:all && npx vsce package` を再実行
