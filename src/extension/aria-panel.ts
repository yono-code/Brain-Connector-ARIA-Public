import * as vscode from 'vscode';
import * as fs from 'fs';
import {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../shared/types';

export class AriaPanel {
  public static currentPanel: AriaPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  // シングルトンパターン：既存パネルがあればフォーカスを当てて返す
  public static createOrShow(
    extensionUri: vscode.Uri,
    onMessage: (message: WebviewToExtensionMessage) => void
  ): AriaPanel {
    const column = vscode.ViewColumn.One;

    if (AriaPanel.currentPanel) {
      AriaPanel.currentPanel._panel.reveal(column);
      return AriaPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'ariaPanel',
      'ARIA',
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
        ],
        retainContextWhenHidden: true,
      }
    );

    AriaPanel.currentPanel = new AriaPanel(panel, extensionUri, onMessage);
    return AriaPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly _onMessage: (msg: WebviewToExtensionMessage) => void
  ) {
    this._panel = panel;
    this._panel.webview.html = this._getHtml(extensionUri);

    // Webview からのメッセージを受信する
    this._panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
        this._onMessage(message);
      },
      null,
      this._disposables
    );

    // パネルが閉じられたときの後処理
    this._panel.onDidDispose(
      () => this.dispose(),
      null,
      this._disposables
    );
  }

  // Webview にメッセージを送信する
  public postMessage(message: ExtensionToWebviewMessage): void {
    this._panel.webview.postMessage(message);
  }

  private _getHtml(extensionUri: vscode.Uri): string {
    const webviewPath = vscode.Uri.joinPath(
      extensionUri, 'dist', 'webview', 'index.html'
    );
    let html = fs.readFileSync(webviewPath.fsPath, 'utf-8');

    const baseUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'webview')
    );

    const cspSource = this._panel.webview.cspSource;

    // 相対パスを VS Code Webview URI に書き換える
    // ※ Vite が出力する <script type="module" crossorigin src="./main.js"> に対応するため
    //   属性の境界を考慮した正規表現を使用する（crossorigin が間に入る場合も対応）
    html = html
      .replace(/(<script[^>]*)\ssrc="\.\/main\.js"/g, `$1 src="${baseUri}/main.js"`)
      .replace(/href="\.\/assets\//g, `href="${baseUri}/assets/`);

    // CSP メタタグを <head> 直後に挿入する
    // script-src: webview.cspSource（vscode-resource: スキーム）と 'unsafe-eval'（Vite chunk eval）
    // style-src: webview.cspSource と 'unsafe-inline'（React Flow インラインスタイル）
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="` +
      `default-src 'none'; ` +
      `img-src ${cspSource} data:; ` +
      `style-src ${cspSource} 'unsafe-inline'; ` +
      `script-src ${cspSource} 'unsafe-eval';` +
      `">`;

    html = html.replace('<head>', `<head>\n    ${cspMeta}`);

    return html;
  }

  public dispose(): void {
    AriaPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }
}
