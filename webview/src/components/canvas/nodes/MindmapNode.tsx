import { useMemo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useAriaStore } from '../../../store/aria-store';
import { useContextMenu } from '../../context-menu/ContextMenu';
import { TaskLinkPicker } from '../../kanban/TaskLinkPicker';
import { buildMindmapContextMenuItems } from './node-menu-items';
import { NoteDialog } from '../../mindmap/NoteDialog';
import { ColorPickerDialog } from '../../mindmap/ColorPickerDialog';
import { M13_COLOR_PRESETS, MINDMAP_STYLE_TOKENS } from '../../mindmap/mindmap-style';
import type { ContextMenuItem } from '../../context-menu/ContextMenu';
import type { MindmapStyleRole } from '../../../../../src/shared/types';

interface MindmapData {
  label: string;
  note?: string;
  collapsed?: boolean;
  checkboxEnabled?: boolean;
  checked?: boolean;
  styleRole?: MindmapStyleRole;
  color?: string;
  boundaryId?: string;
  [key: string]: unknown;
}

function getRole(data: MindmapData): MindmapStyleRole {
  if (data.styleRole === 'top' || data.styleRole === 'helper' || data.styleRole === 'standard') {
    return data.styleRole;
  }
  return 'standard';
}

export function MindmapNode({ id, data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const d = data as MindmapData;
  const role = getRole(d);
  const styleToken = MINDMAP_STYLE_TOKENS[role];
  const nodeColor = d.color ?? M13_COLOR_PRESETS[0];

  const deleteMindmapNode = useAriaStore((s) => s.deleteMindmapNode);
  const updateNodeData = useAriaStore((s) => s.updateNodeData);
  const addNode = useAriaStore((s) => s.addNode);
  const addTask = useAriaStore((s) => s.addTask);
  const linkTaskToNode = useAriaStore((s) => s.linkTaskToNode);
  const edges = useAriaStore((s) => s.edges);
  const boundaries = useAriaStore((s) => s.mindmapBoundaries);
  const toggleMindmapCollapsed = useAriaStore((s) => s.toggleMindmapCollapsed);
  const setMindmapDescendantsCollapsed = useAriaStore((s) => s.setMindmapDescendantsCollapsed);
  const updateMindmapNote = useAriaStore((s) => s.updateMindmapNote);
  const setMindmapCheckboxEnabled = useAriaStore((s) => s.setMindmapCheckboxEnabled);
  const setMindmapSubtreeCheckboxEnabled = useAriaStore((s) => s.setMindmapSubtreeCheckboxEnabled);
  const toggleMindmapChecked = useAriaStore((s) => s.toggleMindmapChecked);
  const toggleMindmapBoundary = useAriaStore((s) => s.toggleMindmapBoundary);
  const setMindmapNodeColor = useAriaStore((s) => s.setMindmapNodeColor);
  const setMindmapNodeStyleRole = useAriaStore((s) => s.setMindmapNodeStyleRole);
  const { openContextMenu } = useContextMenu();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(d.label);
  const [showDelete, setShowDelete] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showColorDialog, setShowColorDialog] = useState(false);

  const hasChildren = useMemo(
    () => edges.some((edge) => edge.source === id),
    [edges, id],
  );

  const boundaryVisible = useMemo(() => {
    const boundaryId = typeof d.boundaryId === 'string' ? d.boundaryId : `boundary-${id}`;
    const boundary = boundaries[boundaryId];
    return !!boundary?.visible;
  }, [boundaries, d.boundaryId, id]);

  const startEdit = () => {
    setEditValue(d.label);
    setIsEditing(true);
  };

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== d.label) {
      updateNodeData(id, { label: trimmed });
    } else {
      setEditValue(d.label);
    }
  };

  const cancelEdit = () => {
    setEditValue(d.label);
    setIsEditing(false);
  };

  const colorMenuItems: ContextMenuItem[] = [
    ...M13_COLOR_PRESETS.map((hex) => ({
      icon: '●',
      label: hex,
      onClick: () => setMindmapNodeColor(id, hex),
    })),
    { separator: true, label: '', onClick: () => {} },
    {
      icon: '🎛️',
      label: 'カスタムカラー...',
      onClick: () => setShowColorDialog(true),
    },
  ];

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const parentEdge = edges.find((edge) => edge.target === id);
    const parentId = parentEdge?.source;

    openContextMenu(
      e.clientX,
      e.clientY,
      buildMindmapContextMenuItems({
        collapsed: !!d.collapsed,
        hasChildren,
        checkboxEnabled: !!d.checkboxEnabled,
        checked: !!d.checked,
        boundaryVisible,
        styleRole: role,
        colorItems: colorMenuItems,
        onStartEdit: startEdit,
        onEditNote: () => setShowNoteDialog(true),
        onToggleCollapse: () => toggleMindmapCollapsed(id),
        onCollapseDescendants: () => setMindmapDescendantsCollapsed(id, true),
        onExpandDescendants: () => setMindmapDescendantsCollapsed(id, false),
        onAddChild: () => addNode(
          'mindmap',
          { x: positionAbsoluteX + 220, y: positionAbsoluteY },
          '新しいノード',
          id,
        ),
        onAddSibling: () => addNode(
          'mindmap',
          { x: positionAbsoluteX, y: positionAbsoluteY + 80 },
          '新しいノード',
          parentId,
        ),
        onToggleCheckboxEnabled: () => setMindmapCheckboxEnabled(id, !d.checkboxEnabled),
        onToggleSubtreeCheckboxEnabled: () => setMindmapSubtreeCheckboxEnabled(id, !d.checkboxEnabled),
        onToggleChecked: () => toggleMindmapChecked(id, false),
        onToggleSubtreeChecked: () => toggleMindmapChecked(id, true),
        onToggleBoundary: () => toggleMindmapBoundary(id),
        onSetStyleRole: (nextRole) => setMindmapNodeStyleRole(id, nextRole),
        onCreateTask: () => {
          const newTask = addTask(d.label);
          linkTaskToNode(newTask.id, id);
        },
        onLinkExistingTask: () => setShowPicker(true),
        onDelete: () => deleteMindmapNode(id),
      }),
    );
  };

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setShowDelete(true)}
        onMouseLeave={() => setShowDelete(false)}
        style={{
          position: 'relative',
          padding: `${styleToken.paddingY}px ${styleToken.paddingX}px`,
          borderRadius: styleToken.borderRadius,
          border: `${styleToken.borderWidth}px solid ${selected
            ? 'var(--vscode-focusBorder, #007acc)'
            : 'rgba(255,255,255,0.38)'}`,
          background: nodeColor,
          color: 'var(--vscode-badge-foreground, #ffffff)',
          fontWeight: styleToken.fontWeight,
          fontSize: 12,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          opacity: d.checkboxEnabled && d.checked ? 0.64 : 1,
          minWidth: 82,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {showDelete && !isEditing && (
          <button
            className="nopan nodrag nowheel"
            onClick={(e) => { e.stopPropagation(); deleteMindmapNode(id); }}
            title="削除"
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
              color: 'var(--vscode-errorForeground, #f48771)',
              border: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            ×
          </button>
        )}

        <Handle type="target" position={Position.Left} />

        {d.checkboxEnabled && (
          <input
            type="checkbox"
            checked={!!d.checked}
            className="nopan nodrag nowheel"
            onChange={() => toggleMindmapChecked(id, false)}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'pointer' }}
          />
        )}

        {isEditing ? (
          <input
            autoFocus
            className="nopan nodrag"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            style={{
              fontSize: 12,
              fontWeight: styleToken.fontWeight,
              background: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: 3,
              padding: '1px 4px',
              outline: 'none',
              minWidth: 80,
            }}
          />
        ) : (
          <span
            onDoubleClick={startEdit}
            title="ダブルクリックで編集 / 右クリックでメニュー"
            style={{
              textDecoration: d.checkboxEnabled && d.checked ? 'line-through' : 'none',
            }}
          >
            {d.label}
          </span>
        )}

        {d.note && <span title="メモあり">🗒️</span>}
        {d.collapsed && hasChildren && <span title="折りたたみ中">▶</span>}

        <Handle type="source" position={Position.Right} />
      </div>
      {showPicker && <TaskLinkPicker nodeId={id} onClose={() => setShowPicker(false)} />}
      {showNoteDialog && (
        <NoteDialog
          initialValue={d.note ?? ''}
          onClose={() => setShowNoteDialog(false)}
          onSave={(value) => {
            updateMindmapNote(id, value);
            setShowNoteDialog(false);
          }}
        />
      )}
      {showColorDialog && (
        <ColorPickerDialog
          initialColor={d.color}
          onClose={() => setShowColorDialog(false)}
          onSave={(hex) => {
            setMindmapNodeColor(id, hex);
            setShowColorDialog(false);
          }}
        />
      )}
    </>
  );
}
