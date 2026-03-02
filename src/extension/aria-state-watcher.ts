import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

// 自己書き込みループ防止：書き込み後 600ms は Watcher のイベントを無視する
const WRITE_COOLDOWN_MS = 600;
// 連続イベントをまとめるデバウンス時間
const DEBOUNCE_MS = 300;

export class AriaStateWatcher {
  private _ariaStateWatcher: vscode.FileSystemWatcher | undefined;
  private _statusMdWatcher: vscode.FileSystemWatcher | undefined;
  private _isWriting = false;
  private _cooldownTimer: ReturnType<typeof setTimeout> | undefined;
  private _ariaStateDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private _statusMdDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly _workspacePath: string,
    private readonly _onAriaStateChange: (rawJson: string) => Promise<void>,
    private readonly _onStatusMdChange?: (rawMarkdown: string) => Promise<void>
  ) {}

  public start(): void {
    const ariaStatePattern = new vscode.RelativePattern(
      this._workspacePath,
      '.ai-context/aria-state.json'
    );
    this._ariaStateWatcher = vscode.workspace.createFileSystemWatcher(ariaStatePattern);
    this.registerHandlers(
      this._ariaStateWatcher,
      '.ai-context/aria-state.json',
      async (raw) => this._onAriaStateChange(raw),
      'ariaState'
    );

    if (this._onStatusMdChange) {
      const statusMdPattern = new vscode.RelativePattern(
        this._workspacePath,
        '.ai-context/status.md'
      );
      this._statusMdWatcher = vscode.workspace.createFileSystemWatcher(statusMdPattern);
      this.registerHandlers(
        this._statusMdWatcher,
        '.ai-context/status.md',
        async (raw) => this._onStatusMdChange?.(raw),
        'statusMd'
      );
    }
  }

  // ファイル書き込み前に必ず呼ぶ（self-loop 防止）
  public markWriteStart(): void {
    this._isWriting = true;
    if (this._cooldownTimer) {
      clearTimeout(this._cooldownTimer);
    }
    this._cooldownTimer = setTimeout(() => {
      this._isWriting = false;
    }, WRITE_COOLDOWN_MS);
  }

  public dispose(): void {
    this._ariaStateWatcher?.dispose();
    this._statusMdWatcher?.dispose();
    if (this._cooldownTimer) { clearTimeout(this._cooldownTimer); }
    if (this._ariaStateDebounceTimer) { clearTimeout(this._ariaStateDebounceTimer); }
    if (this._statusMdDebounceTimer) { clearTimeout(this._statusMdDebounceTimer); }
  }

  private registerHandlers(
    watcher: vscode.FileSystemWatcher,
    relativePath: string,
    callback: (raw: string) => Promise<void>,
    kind: 'ariaState' | 'statusMd',
  ): void {
    const handleChange = async () => {
      // 自分自身の書き込みによる変更は無視する
      if (this._isWriting) {
        return;
      }
      // 連続イベントをデバウンスする
      const activeTimer =
        kind === 'ariaState' ? this._ariaStateDebounceTimer : this._statusMdDebounceTimer;
      if (activeTimer) {
        clearTimeout(activeTimer);
      }

      const nextTimer = setTimeout(async () => {
        const filePath = path.join(this._workspacePath, ...relativePath.split('/'));
        try {
          const raw = await fs.readFile(filePath, 'utf-8');
          await callback(raw);
        } catch {
          // ファイルが存在しない・読み取り不可の場合は無視する
        }
      }, DEBOUNCE_MS);

      if (kind === 'ariaState') {
        this._ariaStateDebounceTimer = nextTimer;
      } else {
        this._statusMdDebounceTimer = nextTimer;
      }
    };

    watcher.onDidChange(handleChange);
    watcher.onDidCreate(handleChange);
  }
}
