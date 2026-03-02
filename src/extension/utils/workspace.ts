import * as vscode from 'vscode';
import { tExt } from '../i18n';

// 現在のワークスペースルートパスを取得する
// ワークスペースが開かれていない場合は null を返す
export function getWorkspacePath(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }
  // マルチルートワークスペースの場合は最初のフォルダを使用する
  return folders[0].uri.fsPath;
}

// ワークスペースが開かれていない場合にエラーメッセージを表示して null を返す
export function requireWorkspace(): string | null {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    vscode.window.showErrorMessage(tExt('ext.warn.workspace_open_required'));
    return null;
  }
  return workspacePath;
}
