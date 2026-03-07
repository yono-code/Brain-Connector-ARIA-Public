import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// モックの定義 - store が読み込まれる前に定義する必要がある
vi.mock('../../hooks/use-vscode-bridge', () => ({
    postToExtension: vi.fn(),
}));

vi.mock('@xyflow/react', () => ({
    applyNodeChanges: vi.fn((_changes, nodes) => nodes),
    applyEdgeChanges: vi.fn((_changes, edges) => edges),
    addEdge: vi.fn((connection, edges) => [...edges, connection]),
}));

// store の import (内部で上記モックが使われる)
import { useAriaStore } from '../aria-store';
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import { postToExtension } from '../../hooks/use-vscode-bridge';

describe('M11: Semantic Network (Store Logic)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-26T00:00:00.000Z'));
        vi.clearAllMocks();
        // ストアのリセットに近い状態にする（簡易的）
        useAriaStore.setState({
            nodes: [],
            edges: [],
            tasks: {},
            adrs: {},
            containerCanvases: {},
            mindmapBoundaries: {},
            mindmapSettings: { snapEnabled: true },
            mindmapUndoStack: [],
            mindmapRedoStack: [],
            canUndoMindmap: false,
            canRedoMindmap: false,
            currentLayer: 'context',
            activeContainerId: null,
            breadcrumb: [],
            version: '1.0.0',
            lastModified: new Date().toISOString(),
        });
    });

    afterEach(() => {
        // _notifyExtension のデバウンスタイマーがぶら下がらないように掃除する
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('addMindmapChild should add a node and an edge', () => {
        // 既存ノード作成
        const parentNode = useAriaStore.getState().addNode('mindmap', { x: 0, y: 0 }, 'Parent');

        // 子ノード追加
        const childNode = useAriaStore.getState().addMindmapChild(parentNode.id);

        const state = useAriaStore.getState();
        expect(state.nodes).toHaveLength(2);
        expect(state.edges).toHaveLength(1);
        expect(state.edges[0].source).toBe(parentNode.id);
        expect(state.edges[0].target).toBe(childNode.id);
        const selectedNode = state.nodes.find((n) => (n as any).selected);
        expect(selectedNode?.id).toBe(childNode.id);
    });

    it('does not auto-create ADR when adding mindmap nodes', () => {
        const store = useAriaStore.getState();
        store.addNode('mindmap', { x: 0, y: 0 }, 'Mindmap Root');

        const state = useAriaStore.getState();
        expect(Object.keys(state.adrs)).toHaveLength(0);
    });

    it('addMindmapSibling should add sibling node connected to same parent', () => {
        const store = useAriaStore.getState();
        const root = store.addNode('mindmap', { x: 0, y: 0 }, 'Root');
        const firstChild = store.addMindmapChild(root.id);

        const sibling = useAriaStore.getState().addMindmapSibling(firstChild.id);

        expect(sibling).not.toBeNull();
        const state = useAriaStore.getState();
        expect(state.nodes).toHaveLength(3);
        const siblingEdge = state.edges.find((e) => e.target === sibling!.id);
        expect(siblingEdge).toBeDefined();
        expect(siblingEdge?.source).toBe(root.id);
        const selectedNode = state.nodes.find((n) => (n as any).selected);
        expect(selectedNode?.id).toBe(sibling!.id);
    });

    it('addMindmapSibling should return null for root node without parent', () => {
        const store = useAriaStore.getState();
        const root = store.addNode('mindmap', { x: 0, y: 0 }, 'Root');

        const sibling = useAriaStore.getState().addMindmapSibling(root.id);

        expect(sibling).toBeNull();
        const state = useAriaStore.getState();
        expect(state.nodes).toHaveLength(1);
        expect(state.edges).toHaveLength(0);
    });

    it('deleteMindmapNode should delete node and its descendants', () => {
        const store = useAriaStore.getState();

        // 構造作成: Root -> Child -> GrandChild
        const root = store.addNode('mindmap', { x: 0, y: 0 }, 'Root');
        const child = store.addMindmapChild(root.id);
        store.addMindmapChild(child.id);

        expect(useAriaStore.getState().nodes).toHaveLength(3);

        // Child を削除 -> Child と GrandChild が消えるべき
        useAriaStore.getState().deleteMindmapNode(child.id);

        const finalState = useAriaStore.getState();
        expect(finalState.nodes).toHaveLength(1);
        expect(finalState.nodes[0].id).toBe(root.id);
        expect(finalState.edges).toHaveLength(0);
    });

    it('linkTaskToNode should update task link', () => {
        const store = useAriaStore.getState();
        const task = store.addTask('Test Task');
        const node = store.addNode('mindmap', { x: 0, y: 0 }, 'Test Node');

        store.linkTaskToNode(task.id, node.id);

        const updatedTask = useAriaStore.getState().tasks[task.id];
        expect(updatedTask.linkedNodeIds).toContain(node.id);
    });

    it('updateTask should patch dates and refresh updatedAt', () => {
        const store = useAriaStore.getState();
        const task = store.addTask('Task with dates');
        const before = useAriaStore.getState().tasks[task.id];
        expect(before.startDate).toBeUndefined();
        expect(before.dueDate).toBeUndefined();

        vi.setSystemTime(new Date('2026-02-26T00:00:05.000Z'));
        useAriaStore.getState().updateTask(task.id, {
            startDate: '2026-03-01',
            dueDate: '2026-03-10',
        });

        const updated = useAriaStore.getState().tasks[task.id];
        expect(updated.startDate).toBe('2026-03-01');
        expect(updated.dueDate).toBe('2026-03-10');
        expect(updated.updatedAt).not.toBe(before.updatedAt);
        expect(updated.updatedAt).toBe('2026-02-26T00:00:05.000Z');
    });

    it('updateTask should persist note and clear it when blank', () => {
        const store = useAriaStore.getState();
        const task = store.addTask('Task with note');

        store.updateTask(task.id, { note: 'remember this' });
        let updated = useAriaStore.getState().tasks[task.id];
        expect(updated.note).toBe('remember this');

        store.updateTask(task.id, { note: '   ' });
        updated = useAriaStore.getState().tasks[task.id];
        expect(updated.note).toBeUndefined();
    });

    it('deleteMindmapNode should cleanup task links', () => {
        const store = useAriaStore.getState();
        const node = store.addNode('mindmap', { x: 0, y: 0 }, 'Node');
        const task = store.addTask('Task');
        store.linkTaskToNode(task.id, node.id);

        // ノード削除
        store.deleteMindmapNode(node.id);

        const updatedTask = useAriaStore.getState().tasks[task.id];
        expect(updatedTask.linkedNodeIds).not.toContain(node.id);
    });

    it('updateTaskStatus should no-op when task does not exist', () => {
        useAriaStore.getState().updateTaskStatus('task-missing', 'Done');

        const state = useAriaStore.getState();
        expect(state.tasks['task-missing' as keyof typeof state.tasks]).toBeUndefined();
        expect(Object.keys(state.tasks)).toHaveLength(0);
    });

    it('updateTaskTitle should no-op when task does not exist', () => {
        useAriaStore.getState().updateTaskTitle('task-missing', 'Oops');

        const state = useAriaStore.getState();
        expect(state.tasks['task-missing' as keyof typeof state.tasks]).toBeUndefined();
        expect(Object.keys(state.tasks)).toHaveLength(0);
    });

    it('updateADR should no-op when ADR does not exist', () => {
        useAriaStore.getState().updateADR('adr-missing', { title: 'Oops' });

        const state = useAriaStore.getState();
        expect(state.adrs['adr-missing' as keyof typeof state.adrs]).toBeUndefined();
        expect(Object.keys(state.adrs)).toHaveLength(0);
    });

    it('enterContainerLayer and exitContainerLayer should manage navigation state', () => {
        const store = useAriaStore.getState();
        const container = store.addNode('c4-container', { x: 0, y: 0 }, 'API Gateway');

        store.enterContainerLayer(container.id);

        let state = useAriaStore.getState();
        expect(state.currentLayer).toBe('container');
        expect(state.activeContainerId).toBe(container.id);
        expect(state.breadcrumb).toEqual([{ id: container.id, label: 'API Gateway' }]);

        store.exitContainerLayer();

        state = useAriaStore.getState();
        expect(state.currentLayer).toBe('context');
        expect(state.activeContainerId).toBeNull();
        expect(state.breadcrumb).toEqual([]);
    });

    it('addContainerNode should initialize container canvas and be readable via surface API', () => {
        const store = useAriaStore.getState();

        const node = store.addContainerNode('container-1', 'c4-component', { x: 10, y: 20 }, 'Auth Service');

        const state = useAriaStore.getState();
        expect(state.containerCanvases['container-1']).toBeDefined();
        expect(state.containerCanvases['container-1'].nodeId).toBe('container-1');
        expect(state.containerCanvases['container-1'].nodes.map((n) => n.id)).toContain(node.id);

        const surfaceNodes = store.getSurfaceNodes({ kind: 'c4-container', containerId: 'container-1' });
        expect(surfaceNodes).toHaveLength(1);
        expect(surfaceNodes[0].data.label).toBe('Auth Service');
    });

    it('surface-aware React Flow APIs should update container canvas arrays', () => {
        const store = useAriaStore.getState();
        const n1 = store.addContainerNode('container-2', 'c4-component', { x: 0, y: 0 }, 'A');
        const n2 = store.addContainerNode('container-2', 'c4-component', { x: 50, y: 0 }, 'B');

        vi.mocked(addEdge).mockImplementationOnce((connection, edges) => [
            ...edges,
            connection as any,
        ]);
        store.connectOnSurface({ kind: 'c4-container', containerId: 'container-2' }, { source: n1.id, target: n2.id });

        vi.mocked(applyNodeChanges).mockImplementationOnce((_changes, nodes) =>
            nodes.map((node) => node.id === n1.id
                ? { ...node, position: { x: 123, y: 456 } }
                : node)
        );
        store.applyNodeChangesToSurface(
            { kind: 'c4-container', containerId: 'container-2' },
            [{ id: n1.id, type: 'position', position: { x: 123, y: 456 }, dragging: false } as any]
        );

        vi.mocked(applyEdgeChanges).mockImplementationOnce((_changes, edges) =>
            edges.filter((edge) => edge.target !== n2.id)
        );
        store.applyEdgeChangesToSurface(
            { kind: 'c4-container', containerId: 'container-2' },
            [{ id: 'any-edge', type: 'remove' } as any]
        );

        const state = useAriaStore.getState();
        const canvas = state.containerCanvases['container-2'];
        expect(canvas.nodes.find((n) => n.id === n1.id)?.position).toEqual({ x: 123, y: 456 });
        expect(canvas.edges).toHaveLength(0);
    });

    it('updateEdge should patch label and variants on current container surface', () => {
        const store = useAriaStore.getState();
        const n1 = store.addContainerNode('container-6', 'c4-component', { x: 0, y: 0 }, 'A');
        const n2 = store.addContainerNode('container-6', 'c4-component', { x: 120, y: 0 }, 'B');
        store.connectOnSurface(
            { kind: 'c4-container', containerId: 'container-6' },
            { source: n1.id, target: n2.id }
        );
        const edgeId = useAriaStore.getState().containerCanvases['container-6'].edges[0].id;
        useAriaStore.setState({
            currentLayer: 'container',
            activeContainerId: 'container-6',
            breadcrumb: [],
        });

        store.updateEdge(edgeId, {
            label: 'calls',
            variant: 'double-parallel',
            sourceLabel: 'req',
            targetLabel: 'res',
        });

        const updated = useAriaStore.getState().containerCanvases['container-6'].edges[0];
        expect(updated.label).toBe('calls');
        expect(updated.variant).toBe('double-parallel');
        expect(updated.sourceLabel).toBe('req');
        expect(updated.targetLabel).toBe('res');
    });

    it('deleteEdge should remove edge from current surface', () => {
        const store = useAriaStore.getState();

        const rootA = store.addNode('c4-component', { x: 0, y: 0 }, 'Root A');
        const rootB = store.addNode('c4-component', { x: 100, y: 0 }, 'Root B');
        store.connectOnSurface({ kind: 'c4-context' }, { source: rootA.id, target: rootB.id });
        const rootEdgeId = useAriaStore.getState().edges[0].id;
        store.deleteEdge(rootEdgeId);
        expect(useAriaStore.getState().edges).toHaveLength(0);

        const n1 = store.addContainerNode('container-7', 'c4-component', { x: 0, y: 0 }, 'A');
        const n2 = store.addContainerNode('container-7', 'c4-component', { x: 120, y: 0 }, 'B');
        store.connectOnSurface(
            { kind: 'c4-container', containerId: 'container-7' },
            { source: n1.id, target: n2.id }
        );
        const innerEdgeId = useAriaStore.getState().containerCanvases['container-7'].edges[0].id;
        useAriaStore.setState({
            currentLayer: 'container',
            activeContainerId: 'container-7',
            breadcrumb: [],
        });
        store.deleteEdge(innerEdgeId);
        expect(useAriaStore.getState().containerCanvases['container-7'].edges).toHaveLength(0);
    });

    it('alignCurrentSurface should align C4 nodes on context layer', () => {
        const store = useAriaStore.getState();
        const a = store.addNode('c4-container', { x: 10, y: 10 }, 'A');
        const b = store.addNode('c4-component', { x: 500, y: 400 }, 'B');
        const c = store.addNode('c4-component', { x: 200, y: 300 }, 'C');
        store.connectOnSurface({ kind: 'c4-context' }, { source: a.id, target: b.id });
        store.connectOnSurface({ kind: 'c4-context' }, { source: b.id, target: c.id });

        const before = useAriaStore.getState().nodes.map((node) => ({ id: node.id, pos: node.position }));
        const changed = store.alignCurrentSurface();
        const after = useAriaStore.getState().nodes.map((node) => ({ id: node.id, pos: node.position }));
        const posById = Object.fromEntries(after.map((entry) => [entry.id, entry.pos]));

        expect(changed).toBe(true);
        expect(after).not.toEqual(before);
        expect(posById[a.id].y).toBeLessThan(posById[b.id].y);
        expect(posById[b.id].y).toBeLessThan(posById[c.id].y);
    });

    it('selectAdrByNodeId should select ADR id linked to a node', () => {
        const store = useAriaStore.getState();
        const node = store.addNode('c4-container', { x: 0, y: 0 }, 'API');
        const adr = Object.values(useAriaStore.getState().adrs).find((entry) => entry.linkedNodeId === node.id);
        expect(adr).toBeDefined();
        if (!adr) return;

        store.selectAdrByNodeId(node.id);

        expect(useAriaStore.getState().selectedAdrId).toBe(adr.id);
    });

    it('selectAdrByNodeId should not clear selected ADR when node has no linked ADR', () => {
        const store = useAriaStore.getState();
        const node = store.addNode('c4-container', { x: 0, y: 0 }, 'API');
        const adr = Object.values(useAriaStore.getState().adrs).find((entry) => entry.linkedNodeId === node.id);
        expect(adr).toBeDefined();
        if (!adr) return;

        store.setSelectedAdrId(adr.id);
        store.selectAdrByNodeId('node-missing');

        expect(useAriaStore.getState().selectedAdrId).toBe(adr.id);
    });

    it('setState should keep ADR selection by linked node even if ADR id is re-keyed', () => {
        const store = useAriaStore.getState();
        const node = store.addNode('c4-container', { x: 0, y: 0 }, 'API');
        const current = useAriaStore.getState();
        const adr = Object.values(current.adrs).find((entry) => entry.linkedNodeId === node.id);
        expect(adr).toBeDefined();
        if (!adr) return;

        store.selectAdrByNodeId(node.id);
        expect(useAriaStore.getState().selectedAdrId).toBe(adr.id);

        const migratedAdrId = 'adr-deadbeef';
        store.setState({
            nodes: current.nodes,
            edges: current.edges,
            tasks: current.tasks,
            adrs: {
                [migratedAdrId]: {
                    ...adr,
                    id: migratedAdrId,
                },
            },
            containerCanvases: current.containerCanvases,
            mindmapBoundaries: current.mindmapBoundaries,
            mindmapSettings: current.mindmapSettings,
            version: current.version,
            lastModified: '2026-02-26T00:00:00.000Z',
        });

        expect(useAriaStore.getState().selectedAdrId).toBe(migratedAdrId);
    });

    it('deleteContainerNode should cascade descendants and cleanup task links', () => {
        const store = useAriaStore.getState();
        const root = store.addContainerNode('container-3', 'c4-container', { x: 0, y: 0 }, 'Root');
        const child = store.addContainerNode('container-3', 'c4-component', { x: 100, y: 0 }, 'Child');
        const grandChild = store.addContainerNode('container-3', 'c4-component', { x: 200, y: 0 }, 'GrandChild');

        useAriaStore.setState({
            containerCanvases: {
                ...useAriaStore.getState().containerCanvases,
                'container-3': {
                    nodeId: 'container-3',
                    nodes: [root, child, grandChild],
                    edges: [
                        { id: 'e1', source: root.id, target: child.id },
                        { id: 'e2', source: child.id, target: grandChild.id },
                    ],
                },
                [child.id]: { nodeId: child.id, nodes: [], edges: [] },
            },
        });

        const task = store.addTask('linked');
        useAriaStore.setState({
            tasks: {
                ...useAriaStore.getState().tasks,
                [task.id]: {
                    ...useAriaStore.getState().tasks[task.id],
                    linkedNodeIds: [child.id, grandChild.id],
                },
            },
        });

        store.deleteContainerNode('container-3', child.id);

        const state = useAriaStore.getState();
        expect(state.containerCanvases['container-3'].nodes.map((n) => n.id)).toEqual([root.id]);
        expect(state.containerCanvases['container-3'].edges).toHaveLength(0);
        expect(state.containerCanvases[child.id]).toBeUndefined();
        expect(state.tasks[task.id].linkedNodeIds).toEqual([]);
    });

    it('deleteContainerNode should recursively cleanup nested container canvases', () => {
        const store = useAriaStore.getState();
        const childContainer = store.addContainerNode('container-root', 'c4-container', { x: 0, y: 0 }, 'Child Container');
        const sibling = store.addContainerNode('container-root', 'c4-component', { x: 100, y: 0 }, 'Sibling');
        const grandContainer = store.addContainerNode(childContainer.id, 'c4-container', { x: 0, y: 0 }, 'Grand Container');
        const deepNode = store.addContainerNode(grandContainer.id, 'c4-component', { x: 100, y: 0 }, 'Deep Node');

        const task = store.addTask('nested link');
        store.linkTaskToNode(task.id, deepNode.id);

        store.deleteContainerNode('container-root', childContainer.id);

        const state = useAriaStore.getState();
        expect(state.containerCanvases['container-root'].nodes.map((n) => n.id)).toEqual([sibling.id]);
        expect(state.containerCanvases[childContainer.id]).toBeUndefined();
        expect(state.containerCanvases[grandContainer.id]).toBeUndefined();
        expect(state.tasks[task.id].linkedNodeIds).toEqual([]);
    });

    it('applyNodeChangesToSurface should not affect nodes on other root surfaces', () => {
        const store = useAriaStore.getState();
        const c4Node = store.addNode('c4-container', { x: 0, y: 0 }, 'C4');
        const mindmapNode = store.addNode('mindmap', { x: 10, y: 10 }, 'MM');

        vi.mocked(applyNodeChanges).mockImplementationOnce((_changes, nodes) =>
            nodes.map((node) =>
                node.id === c4Node.id ? { ...node, position: { x: 99, y: 88 } } : node
            )
        );
        store.applyNodeChangesToSurface(
            { kind: 'c4-context' },
            [{ id: c4Node.id, type: 'position', position: { x: 99, y: 88 }, dragging: false } as any]
        );

        let state = useAriaStore.getState();
        expect(state.nodes.find((n) => n.id === c4Node.id)?.position).toEqual({ x: 99, y: 88 });
        expect(state.nodes.find((n) => n.id === mindmapNode.id)?.position).toEqual({ x: 10, y: 10 });

        vi.mocked(applyNodeChanges).mockImplementationOnce((_changes, nodes) =>
            nodes.map((node) =>
                node.id === mindmapNode.id ? { ...node, position: { x: 7, y: 6 } } : node
            )
        );
        store.applyNodeChangesToSurface(
            { kind: 'mindmap-root' },
            [{ id: mindmapNode.id, type: 'position', position: { x: 7, y: 6 }, dragging: false } as any]
        );

        state = useAriaStore.getState();
        expect(state.nodes.find((n) => n.id === c4Node.id)?.position).toEqual({ x: 99, y: 88 });
        expect(state.nodes.find((n) => n.id === mindmapNode.id)?.position).toEqual({ x: 7, y: 6 });
    });

    it('dragging parent mindmap node should move descendants with same delta', () => {
        const store = useAriaStore.getState();
        const root = store.addNode('mindmap', { x: 100, y: 100 }, 'Root');
        const child = store.addMindmapChild(root.id);

        vi.mocked(applyNodeChanges).mockImplementationOnce((_changes, nodes) =>
            nodes.map((node) =>
                node.id === root.id ? { ...node, position: { x: 140, y: 135 } } : node
            )
        );

        store.applyNodeChangesToSurface(
            { kind: 'mindmap-root' },
            [{ id: root.id, type: 'position', position: { x: 140, y: 135 }, dragging: true } as any]
        );

        const state = useAriaStore.getState();
        expect(state.nodes.find((n) => n.id === root.id)?.position).toEqual({ x: 140, y: 135 });
        expect(state.nodes.find((n) => n.id === child.id)?.position).toEqual({
            x: child.position.x + 40,
            y: child.position.y + 35,
        });
    });

    it('updateNodeData should update container-layer nodes as well', () => {
        const store = useAriaStore.getState();
        const node = store.addContainerNode('container-4', 'c4-component', { x: 0, y: 0 }, 'Old');

        store.updateNodeData(node.id, { label: 'New' });

        const updated = useAriaStore.getState().containerCanvases['container-4'].nodes.find((n) => n.id === node.id);
        expect(updated?.data.label).toBe('New');
    });

    it('ADR CRUD should work for container-layer nodes', () => {
        const store = useAriaStore.getState();
        const node = store.addContainerNode('container-5', 'c4-component', { x: 0, y: 0 }, 'Inner');
        const adr = store.addADR(node.id, 'Inner ADR');
        expect(adr).not.toBeNull();
        if (!adr) throw new Error('ADR should be created for C4 node');

        let state = useAriaStore.getState();
        expect(state.adrs[adr.id]?.linkedNodeId).toBe(node.id);
        expect(state.adrs[adr.id]?.title).toBe('Inner ADR');

        store.updateADR(adr.id, { decision: 'Use queue' });
        state = useAriaStore.getState();
        expect(state.adrs[adr.id]?.decision).toBe('Use queue');

        store.deleteADR(adr.id);
        state = useAriaStore.getState();
        expect(state.adrs[adr.id]).toBeUndefined();
    });

    it('addADR should reject non-C4 nodes', () => {
        const store = useAriaStore.getState();
        const node = store.addNode('mindmap', { x: 0, y: 0 }, 'Idea');

        const adr = store.addADR(node.id, 'Should not create');
        const state = useAriaStore.getState();

        expect(adr).toBeNull();
        expect(Object.keys(state.adrs)).toHaveLength(0);
    });

    it('should collapse and expand descendants separately from self', () => {
        const store = useAriaStore.getState();
        const root = store.addNode('mindmap', { x: 0, y: 0 }, 'Root');
        const child = store.addMindmapChild(root.id);
        const grandChild = store.addMindmapChild(child.id);

        store.toggleMindmapCollapsed(root.id);
        let state = useAriaStore.getState();
        expect(state.nodes.find((n) => n.id === root.id)?.data.collapsed).toBe(true);

        store.setMindmapDescendantsCollapsed(root.id, true);
        state = useAriaStore.getState();
        expect(state.nodes.find((n) => n.id === child.id)?.data.collapsed).toBe(true);
        expect(state.nodes.find((n) => n.id === grandChild.id)?.data.collapsed).toBe(true);
    });

    it('should persist note updates and clear empty notes', () => {
        const store = useAriaStore.getState();
        const node = store.addNode('mindmap', { x: 0, y: 0 }, 'With note');

        store.updateMindmapNote(node.id, 'hello');
        let state = useAriaStore.getState();
        expect(state.nodes.find((n) => n.id === node.id)?.data.note).toBe('hello');

        store.updateMindmapNote(node.id, '   ');
        state = useAriaStore.getState();
        expect(state.nodes.find((n) => n.id === node.id)?.data.note).toBeUndefined();
    });

    it('reparentMindmapNode should rewire parent edge and reject cycles', () => {
        const store = useAriaStore.getState();
        const root = store.addNode('mindmap', { x: 0, y: 0 }, 'Root');
        const childA = store.addMindmapChild(root.id);
        const childB = store.addMindmapChild(root.id);

        const ok = store.reparentMindmapNode(childB.id, childA.id);
        expect(ok).toBe(true);
        let state = useAriaStore.getState();
        expect(state.edges.some((e) => e.source === childA.id && e.target === childB.id)).toBe(true);

        const blocked = store.reparentMindmapNode(root.id, childB.id);
        expect(blocked).toBe(false);
        state = useAriaStore.getState();
        expect(state.edges.some((e) => e.source === childB.id && e.target === root.id)).toBe(false);
    });

    it('alignMindmapTree should use the root as anchor even when a descendant is selected', () => {
        const store = useAriaStore.getState();
        const root = store.addNode('mindmap', { x: 320, y: 180 }, 'Root');
        const childA = store.addMindmapChild(root.id);
        const childB = store.addMindmapChild(root.id);
        store.addMindmapChild(childA.id);
        store.selectMindmapNode(childB.id);

        const changed = store.alignMindmapTree();
        expect(changed).toBe(true);

        const state = useAriaStore.getState();
        const rootNode = state.nodes.find((n) => n.id === root.id)!;
        const aNode = state.nodes.find((n) => n.id === childA.id)!;
        const bNode = state.nodes.find((n) => n.id === childB.id)!;

        expect(rootNode.position).toEqual({ x: 320, y: 180 });
        expect(aNode.position.x).toBeGreaterThan(rootNode.position.x);
        expect(bNode.position.x).toBeGreaterThan(rootNode.position.x);
        expect(aNode.position.x).toBe(bNode.position.x);
    });

    it('importMindmapMermaid should replace mindmap nodes and select imported core node', () => {
        const store = useAriaStore.getState();
        const oldRoot = store.addNode('mindmap', { x: 0, y: 0 }, 'Old');
        store.addMindmapChild(oldRoot.id);

        const result = store.importMindmapMermaid(`mindmap
  New Root
    Child 1
    Child 2`);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.importedNodeCount).toBe(3);

        const state = useAriaStore.getState();
        const labels = state.nodes.filter((n) => n.type === 'mindmap').map((n) => n.data.label);
        expect(labels).toContain('New Root');
        expect(labels).toContain('Child 1');
        expect(labels).toContain('Child 2');
        expect(labels).not.toContain('Old');
        expect(state.nodes.some((n) => n.type === 'mindmap' && n.selected)).toBe(true);
    });

    it('selectMindmapNode should keep single selected node', () => {
        const store = useAriaStore.getState();
        const first = store.addNode('mindmap', { x: 0, y: 0 }, 'First');
        const second = store.addNode('mindmap', { x: 100, y: 0 }, 'Second');

        store.selectMindmapNode(second.id);

        const state = useAriaStore.getState();
        expect(state.nodes.find((n) => n.id === first.id)?.selected).toBe(false);
        expect(state.nodes.find((n) => n.id === second.id)?.selected).toBe(true);
    });

    it('toggleMindmapBoundary should create and toggle visibility', () => {
        const store = useAriaStore.getState();
        const root = store.addNode('mindmap', { x: 0, y: 0 }, 'Root');

        store.toggleMindmapBoundary(root.id);
        let state = useAriaStore.getState();
        const boundary = state.mindmapBoundaries[`boundary-${root.id}`];
        expect(boundary).toBeDefined();
        expect(boundary.visible).toBe(true);

        store.toggleMindmapBoundary(root.id);
        state = useAriaStore.getState();
        expect(state.mindmapBoundaries[`boundary-${root.id}`].visible).toBe(false);
    });

    it('undoMindmap and redoMindmap should restore mindmap-only changes', () => {
        const store = useAriaStore.getState();
        const node = store.addNode('mindmap', { x: 0, y: 0 }, 'Node');

        store.setMindmapNodeColor(node.id, '#1F6FEB');
        store.setMindmapNodeColor(node.id, '#0F766E');
        expect(useAriaStore.getState().nodes.find((n) => n.id === node.id)?.data.color).toBe('#0F766E');

        store.undoMindmap();
        expect(useAriaStore.getState().nodes.find((n) => n.id === node.id)?.data.color).toBe('#1F6FEB');

        store.redoMindmap();
        expect(useAriaStore.getState().nodes.find((n) => n.id === node.id)?.data.color).toBe('#0F766E');
    });

    it('setState should not notify extension (reverse sync loop prevention)', () => {
        const callsBefore = vi.mocked(postToExtension).mock.calls.length;

        useAriaStore.getState().setState({
            nodes: [],
            edges: [],
            tasks: {},
            adrs: {},
            containerCanvases: {},
            mindmapBoundaries: {},
            mindmapSettings: { snapEnabled: true },
            version: '1.0.0',
            lastModified: '2026-02-26T00:00:00.000Z',
        });

        vi.runOnlyPendingTimers();
        const callsAfter = vi.mocked(postToExtension).mock.calls.length;
        expect(callsAfter).toBe(callsBefore);
    });

    it('AI layout sync setState should not loop, but next local edit should notify once', () => {
        const store = useAriaStore.getState();
        const root = store.addNode('mindmap', { x: 0, y: 0 }, 'Root');
        vi.runOnlyPendingTimers();
        vi.mocked(postToExtension).mockClear();

        useAriaStore.getState().setState({
            nodes: [
                {
                    ...root,
                    position: { x: 420, y: 240 },
                },
            ],
            edges: [],
            tasks: {},
            adrs: {},
            containerCanvases: {},
            mindmapBoundaries: {},
            mindmapSettings: { snapEnabled: true },
            version: '1.0.0',
            lastModified: '2026-02-26T00:00:00.000Z',
        });

        vi.runOnlyPendingTimers();
        expect(useAriaStore.getState().nodes.find((n) => n.id === root.id)?.position).toEqual({ x: 420, y: 240 });
        expect(vi.mocked(postToExtension)).not.toHaveBeenCalled();

        useAriaStore.getState().toggleMindmapCollapsed(root.id);
        vi.runOnlyPendingTimers();
        expect(vi.mocked(postToExtension)).toHaveBeenCalledTimes(1);
    });
});
