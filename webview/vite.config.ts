import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // react / react-dom / zustand を必ず1インスタンスに統一する
    // @xyflow/react のネストされた zustand@4.5.7 は物理削除済み
    // → zustand@5.0.11（トップレベル）に統一
    dedupe: ['react', 'react-dom', 'zustand'],
  },
  build: {
    // VS Code Webview のため、Extension Host の dist/webview/ へ出力する
    outDir: path.resolve(__dirname, '../dist/webview'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        // チャンク分割を無効化（VS Code Webview では CSP の関係で複数 JS は扱いにくい）
        manualChunks: undefined,
        entryFileNames: 'main.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  // 相対パスで参照するために必須（vscode-resource: スキームへの書き換えと対応）
  base: './',
});
