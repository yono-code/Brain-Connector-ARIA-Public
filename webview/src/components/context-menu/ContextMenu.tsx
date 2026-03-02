// ============================================================
// ContextMenu.tsx — 共通コンテキストメニュー（React Context 経由）
// ============================================================

import { createContext, useContext, useState, useEffect, useRef } from 'react';

// ----- 型定義 -----

export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  /** true の場合この行はセパレータとして描画される */
  separator?: boolean;
  /** サブメニュー項目 */
  children?: ContextMenuItem[];
}

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface ContextMenuCtx {
  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  closeContextMenu: () => void;
}

// ----- Context -----

const ContextMenuContext = createContext<ContextMenuCtx | null>(null);

/** コンテキストメニューを開く/閉じるフックを返す */
export function useContextMenu(): ContextMenuCtx {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error('useContextMenu は ContextMenuProvider の内側で使用してください');
  return ctx;
}

// ----- Provider -----

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const openContextMenu = (x: number, y: number, items: ContextMenuItem[]) => {
    setMenu({ x, y, items });
  };

  const closeContextMenu = () => setMenu(null);

  // Escape キーで閉じる
  useEffect(() => {
    if (!menu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menu]);

  return (
    <ContextMenuContext.Provider value={{ openContextMenu, closeContextMenu }}>
      {children}
      {menu && (
        <ContextMenuUI
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={closeContextMenu}
        />
      )}
    </ContextMenuContext.Provider>
  );
}

// ----- UI コンポーネント -----

function ContextMenuUI({
  x,
  y,
  items,
  onClose,
}: ContextMenuState & { onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 画面端補正: メニューが画面外にはみ出ないよう座標を調整する
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const newX = rect.right > vw ? Math.max(0, x - rect.width) : x;
    const newY = rect.bottom > vh ? Math.max(0, y - rect.height) : y;
    setAdjustedPos({ x: newX, y: newY });
  }, [x, y]);

  return (
    <>
      {/* バックドロップ: クリックで閉じる */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />

      {/* メニュー本体 */}
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          left: adjustedPos.x,
          top: adjustedPos.y,
          zIndex: 1000,
          background: 'var(--vscode-menu-background, #252526)',
          border: '1px solid var(--vscode-menu-border, #454545)',
          borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          minWidth: 168,
          padding: '4px 0',
          fontSize: 12,
          userSelect: 'none',
        }}
      >
        {items.map((item, i) =>
          item.separator ? (
            <div
              key={i}
              style={{
                height: 1,
                background: 'var(--vscode-menu-separatorBackground, #454545)',
                margin: '3px 0',
              }}
            />
          ) : (
            <MenuItemButton key={i} item={item} onClose={onClose} depth={0} />
          )
        )}
      </div>
    </>
  );
}

function MenuItemButton({
  item,
  onClose,
  depth,
}: {
  item: ContextMenuItem;
  onClose: () => void;
  depth: number;
}) {
  const [hovered, setHovered] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative' }}
    >
      <button
        onClick={(e) => {
          if (hasChildren) {
            e.stopPropagation();
          } else {
            item.onClick?.();
            onClose();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '6px 12px',
          border: 'none',
          background: hovered
            ? 'var(--vscode-list-activeSelectionBackground, #094771)'
            : 'transparent',
          color: item.danger
            ? 'var(--vscode-errorForeground, #f48771)'
            : 'var(--vscode-menu-foreground, #d4d4d4)',
          cursor: hasChildren ? 'default' : 'pointer',
          textAlign: 'left',
          fontSize: 12,
        }}
      >
        {item.icon && (
          <span style={{ width: 16, textAlign: 'center' }}>{item.icon}</span>
        )}
        <span style={{ flex: 1 }}>{item.label}</span>
        {hasChildren && <span style={{ opacity: 0.5 }}>▶</span>}
      </button>

      {/* サブメニューの描画 */}
      {hasChildren && hovered && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '100%',
            background: 'var(--vscode-menu-background, #252526)',
            border: '1px solid var(--vscode-menu-border, #454545)',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            minWidth: 168,
            padding: '4px 0',
            zIndex: 1000 + depth + 1,
          }}
        >
          {item.children!.map((child, i) =>
            child.separator ? (
              <div
                key={i}
                style={{
                  height: 1,
                  background: 'var(--vscode-menu-separatorBackground, #454545)',
                  margin: '3px 0',
                }}
              />
            ) : (
              <MenuItemButton
                key={i}
                item={child}
                onClose={onClose}
                depth={depth + 1}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
