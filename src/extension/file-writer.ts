import * as vscode from 'vscode';
import * as path from 'path';
import { AriaState } from '../shared/types';
import { generateStatusMd } from './generators/status-md-generator';
import { generateArchitectureMermaid } from './generators/architecture-generator';
import { generateAdrFiles } from './generators/adr-generator';
import { generateCursorRulesIfNotExists } from './generators/cursorrules-generator';

const encoder = new TextEncoder();

// .ai-context/ 以下の全ファイルを書き出す
export async function writeAllAiContextFiles(
  workspacePath: string,
  state: AriaState,
  markWriteStart: () => void
): Promise<void> {
  const aiContextPath = path.join(workspacePath, '.ai-context');

  // ディレクトリを自動作成する
  await ensureDirectory(aiContextPath);
  await ensureDirectory(path.join(aiContextPath, 'adr'));

  // .cursorrules を初回のみ生成する（既存があれば上書きしない）
  await generateCursorRulesIfNotExists(workspacePath);

  // 書き込み開始をマークする（FileSystemWatcher の誤検知防止）
  markWriteStart();

  // aria-state.json / status.md / architecture.mermaid を並行書き出し
  await Promise.all([
    writeFile(
      path.join(aiContextPath, 'aria-state.json'),
      JSON.stringify(state, null, 2)
    ),
    writeFile(
      path.join(aiContextPath, 'status.md'),
      generateStatusMd(state.tasks)
    ),
    writeFile(
      path.join(aiContextPath, 'architecture.mermaid'),
      generateArchitectureMermaid(state.nodes, state.edges, state.containerCanvases)
    ),
  ]);

  // ADR は個別ファイルのため別処理
  await generateAdrFiles(aiContextPath, state);
}

async function writeFile(filePath: string, content: string): Promise<void> {
  const uri = vscode.Uri.file(filePath);
  await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
}

async function ensureDirectory(dirPath: string): Promise<void> {
  const uri = vscode.Uri.file(dirPath);
  try {
    await vscode.workspace.fs.createDirectory(uri);
  } catch {
    // 既に存在する場合は無視する
  }
}
