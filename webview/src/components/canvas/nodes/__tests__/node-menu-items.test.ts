import { describe, expect, it, vi } from 'vitest';
import { buildC4ContextMenuItems, buildMindmapContextMenuItems } from '../node-menu-items';

describe('node-menu-items', () => {
  it('shows container transition item only for c4-container on context layer', () => {
    const baseParams = {
      id: 'node-1',
      label: 'API',
      onStartEdit: vi.fn(),
      onAddAdr: vi.fn(),
      hasLinkedAdr: false,
      onOpenLinkedAdr: vi.fn(),
      onEnterContainerLayer: vi.fn(),
      onDelete: vi.fn(),
    };

    const contextContainer = buildC4ContextMenuItems({
      ...baseParams,
      type: 'c4-container',
      currentLayer: 'context',
    });
    expect(contextContainer.some((i) => i.label === 'コンテナレイヤーへ遷移')).toBe(true);

    const contextComponent = buildC4ContextMenuItems({
      ...baseParams,
      type: 'c4-component',
      currentLayer: 'context',
    });
    expect(contextComponent.some((i) => i.label === 'コンテナレイヤーへ遷移')).toBe(false);

    const containerLayer = buildC4ContextMenuItems({
      ...baseParams,
      type: 'c4-container',
      currentLayer: 'container',
    });
    expect(containerLayer.some((i) => i.label === 'コンテナレイヤーへ遷移')).toBe(false);
  });

  it('mindmap menu does not include container transition item', () => {
    const items = buildMindmapContextMenuItems({
      onStartEdit: vi.fn(),
      onAddChild: vi.fn(),
      onAddSibling: vi.fn(),
      onCreateTask: vi.fn(),
      onLinkExistingTask: vi.fn(),
      onDelete: vi.fn(),
    });

    expect(items.some((i) => i.label === 'コンテナレイヤーへ遷移')).toBe(false);
    expect(items.some((i) => i.label === 'タスクへ追加')).toBe(true);
  });

  it('shows linked ADR action only when ADR exists', () => {
    const withAdr = buildC4ContextMenuItems({
      id: 'node-1',
      label: 'API',
      type: 'c4-component',
      currentLayer: 'context',
      hasLinkedAdr: true,
      onStartEdit: vi.fn(),
      onAddAdr: vi.fn(),
      onOpenLinkedAdr: vi.fn(),
      onEnterContainerLayer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(withAdr.some((i) => i.label === '対応 ADR を開く')).toBe(true);

    const withoutAdr = buildC4ContextMenuItems({
      id: 'node-1',
      label: 'API',
      type: 'c4-component',
      currentLayer: 'context',
      hasLinkedAdr: false,
      onStartEdit: vi.fn(),
      onAddAdr: vi.fn(),
      onOpenLinkedAdr: vi.fn(),
      onEnterContainerLayer: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(withoutAdr.some((i) => i.label === '対応 ADR を開く')).toBe(false);
  });
});
