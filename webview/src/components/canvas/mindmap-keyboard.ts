import type { AriaNode } from '../../../../src/shared/types';

export interface MindmapShortcutEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  targetTagName?: string;
  preventDefault: () => void;
  stopPropagation: () => void;
}

export interface MindmapShortcutContext {
  canvasType: 'c4' | 'mindmap';
  nodes: AriaNode[];
  event: MindmapShortcutEvent;
  addMindmapChild: (nodeId: string) => AriaNode;
  addMindmapSibling: (nodeId: string) => AriaNode | null;
  focusMindmapNode: (nodeId: string) => void;
  deleteMindmapNode: (nodeId: string) => void;
  undoMindmap: () => void;
  redoMindmap: () => void;
}

export function handleMindmapShortcut(ctx: MindmapShortcutContext): boolean {
  if (ctx.canvasType !== 'mindmap') return false;

  const tagName = ctx.event.targetTagName?.toUpperCase();
  if (tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) {
    return false;
  }

  const selectedMindmapNode = ctx.nodes.find((node) => {
    const selected = (node as AriaNode & { selected?: boolean }).selected;
    return node.type === 'mindmap' && selected === true;
  });

  const withModifier = !!ctx.event.ctrlKey || !!ctx.event.metaKey;
  if (withModifier) {
    const normalizedKey = ctx.event.key.toLowerCase();
    if (normalizedKey === 'z' && ctx.event.shiftKey) {
      ctx.event.preventDefault();
      ctx.event.stopPropagation();
      ctx.redoMindmap();
      return true;
    }
    if (normalizedKey === 'z') {
      ctx.event.preventDefault();
      ctx.event.stopPropagation();
      ctx.undoMindmap();
      return true;
    }
  }

  if (!selectedMindmapNode) return false;

  switch (ctx.event.key) {
    case 'Tab':
      ctx.event.preventDefault();
      ctx.event.stopPropagation();
      {
        const created = ctx.addMindmapChild(selectedMindmapNode.id);
        ctx.focusMindmapNode(created.id);
      }
      return true;
    case 'Enter':
      ctx.event.preventDefault();
      ctx.event.stopPropagation();
      {
        const created = ctx.addMindmapSibling(selectedMindmapNode.id);
        if (created) {
          ctx.focusMindmapNode(created.id);
        }
      }
      return true;
    case 'Delete':
    case 'Backspace':
      ctx.deleteMindmapNode(selectedMindmapNode.id);
      return true;
    default:
      return false;
  }
}
