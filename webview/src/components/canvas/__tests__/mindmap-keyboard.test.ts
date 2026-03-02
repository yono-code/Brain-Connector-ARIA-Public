import { describe, expect, it, vi } from 'vitest';
import type { AriaNode } from '../../../../../src/shared/types';
import { handleMindmapShortcut } from '../mindmap-keyboard';

function makeMindmapNode(id: string, selected = false): AriaNode {
  return {
    id,
    type: 'mindmap',
    position: { x: 0, y: 0 },
    data: { label: id },
    ...(selected ? { selected: true } : {}),
  } as AriaNode;
}

describe('mindmap-keyboard', () => {
  it('ignores shortcuts when canvas is not mindmap', () => {
    const addChild = vi.fn();
    const addSibling = vi.fn();
    const deleteNode = vi.fn();
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    const handled = handleMindmapShortcut({
      canvasType: 'c4',
      nodes: [makeMindmapNode('node-1', true)],
      event: { key: 'Tab', preventDefault, stopPropagation },
      addMindmapChild: addChild,
      addMindmapSibling: addSibling,
      deleteMindmapNode: deleteNode,
      undoMindmap: vi.fn(),
      redoMindmap: vi.fn(),
    });

    expect(handled).toBe(false);
    expect(addChild).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ignores shortcuts while typing in input controls', () => {
    const addChild = vi.fn();
    const handled = handleMindmapShortcut({
      canvasType: 'mindmap',
      nodes: [makeMindmapNode('node-1', true)],
      event: {
        key: 'Tab',
        targetTagName: 'INPUT',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      },
      addMindmapChild: addChild,
      addMindmapSibling: vi.fn(),
      deleteMindmapNode: vi.fn(),
      undoMindmap: vi.fn(),
      redoMindmap: vi.fn(),
    });

    expect(handled).toBe(false);
    expect(addChild).not.toHaveBeenCalled();
  });

  it('Tab adds child node for selected mindmap node', () => {
    const addChild = vi.fn();
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    const handled = handleMindmapShortcut({
      canvasType: 'mindmap',
      nodes: [makeMindmapNode('node-1', true)],
      event: { key: 'Tab', preventDefault, stopPropagation },
      addMindmapChild: addChild,
      addMindmapSibling: vi.fn(),
      deleteMindmapNode: vi.fn(),
      undoMindmap: vi.fn(),
      redoMindmap: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(addChild).toHaveBeenCalledWith('node-1');
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('Enter adds sibling node for selected mindmap node', () => {
    const addSibling = vi.fn();
    const handled = handleMindmapShortcut({
      canvasType: 'mindmap',
      nodes: [makeMindmapNode('node-1', true)],
      event: { key: 'Enter', preventDefault: vi.fn(), stopPropagation: vi.fn() },
      addMindmapChild: vi.fn(),
      addMindmapSibling: addSibling,
      deleteMindmapNode: vi.fn(),
      undoMindmap: vi.fn(),
      redoMindmap: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(addSibling).toHaveBeenCalledWith('node-1');
  });

  it('Delete removes selected mindmap node descendants through store action', () => {
    const deleteNode = vi.fn();
    const handled = handleMindmapShortcut({
      canvasType: 'mindmap',
      nodes: [
        makeMindmapNode('node-1', true),
        makeMindmapNode('node-2', false),
      ],
      event: { key: 'Delete', preventDefault: vi.fn(), stopPropagation: vi.fn() },
      addMindmapChild: vi.fn(),
      addMindmapSibling: vi.fn(),
      deleteMindmapNode: deleteNode,
      undoMindmap: vi.fn(),
      redoMindmap: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(deleteNode).toHaveBeenCalledWith('node-1');
  });

  it('Ctrl+Z triggers undo and Ctrl+Shift+Z triggers redo', () => {
    const undo = vi.fn();
    const redo = vi.fn();

    const undoHandled = handleMindmapShortcut({
      canvasType: 'mindmap',
      nodes: [makeMindmapNode('node-1', true)],
      event: {
        key: 'z',
        ctrlKey: true,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      },
      addMindmapChild: vi.fn(),
      addMindmapSibling: vi.fn(),
      deleteMindmapNode: vi.fn(),
      undoMindmap: undo,
      redoMindmap: redo,
    });

    const redoHandled = handleMindmapShortcut({
      canvasType: 'mindmap',
      nodes: [makeMindmapNode('node-1', true)],
      event: {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      },
      addMindmapChild: vi.fn(),
      addMindmapSibling: vi.fn(),
      deleteMindmapNode: vi.fn(),
      undoMindmap: undo,
      redoMindmap: redo,
    });

    expect(undoHandled).toBe(true);
    expect(redoHandled).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(1);
  });
});
