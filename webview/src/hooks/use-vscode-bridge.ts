import { useEffect, useRef } from 'react';
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../../../src/shared/types';

// acquireVsCodeApi() はモジュール内でシングルトンとして保持する
// （複数回呼ぶとランタイムエラーになるため）
type VsCodeApi = { postMessage: (msg: unknown) => void };

function getVsCodeApi(): VsCodeApi {
  if (typeof window !== 'undefined' && 'acquireVsCodeApi' in window) {
    return (
      window as unknown as { acquireVsCodeApi: () => VsCodeApi }
    ).acquireVsCodeApi();
  }
  // Vite dev server 環境ではコンソールにフォールバックする
  return {
    postMessage: (msg: unknown) => {
      console.log('[DEV] postMessage:', msg);
    },
  };
}

const vscode = getVsCodeApi();

// Extension Host へメッセージを送信する
export function postToExtension(message: WebviewToExtensionMessage): void {
  vscode.postMessage(message);
}

// Extension Host からのメッセージを受信するフック
export function useExtensionMessages(
  onMessage: (message: ExtensionToWebviewMessage) => void
): void {
  // ref で最新のコールバックを保持（useEffect の依存配列を空にするため）
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as ExtensionToWebviewMessage;
      onMessageRef.current(message);
    };
    window.addEventListener('message', handler);

    // マウント時に Extension Host へ準備完了を通知する
    postToExtension({ type: 'READY' });

    return () => window.removeEventListener('message', handler);
  }, []);
}
