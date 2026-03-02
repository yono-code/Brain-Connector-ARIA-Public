import { describe, it, expect } from 'vitest';
import { parseAriaState } from '../parse-aria-state';
import { generateStatusMd } from '../generators/status-md-generator';
import { KanbanTask } from '../../shared/types';

describe('M12: Task Dates & Filters (Extension Logic)', () => {
    describe('parseAriaState', () => {
        it('should correctly parse startDate and dueDate', () => {
            const rawJson = JSON.stringify({
                nodes: [],
                edges: [],
                adrs: {},
                tasks: {
                    'task-12345678': {
                        id: 'task-12345678',
                        status: 'Todo',
                        title: 'Test Task',
                        linkedNodeIds: [],
                        createdAt: '2026-02-26T00:00:00Z',
                        updatedAt: '2026-02-26T00:00:00Z',
                        startDate: '2026-03-01',
                        dueDate: '2026-03-10'
                    }
                },
                version: '1.0.0'
            });

            const result = parseAriaState(rawJson);
            expect(result.ok).toBe(true);
            if (result.ok) {
                const task = result.state.tasks['task-12345678'];
                expect(task.startDate).toBe('2026-03-01');
                expect(task.dueDate).toBe('2026-03-10');
            }
        });

        it('should handle missing date fields gracefully', () => {
            const rawJson = JSON.stringify({
                nodes: [],
                edges: [],
                adrs: {},
                tasks: {
                    'task-12345678': {
                        id: 'task-12345678',
                        status: 'Todo',
                        title: 'Test Task',
                        linkedNodeIds: [],
                        createdAt: '2026-02-26T00:00:00Z',
                        updatedAt: '2026-02-26T00:00:00Z'
                    }
                }
            });

            const result = parseAriaState(rawJson);
            expect(result.ok).toBe(true);
            if (result.ok) {
                const task = result.state.tasks['task-12345678'];
                expect(task.startDate).toBeUndefined();
                expect(task.dueDate).toBeUndefined();
            }
        });

        it('should sanitize non-string date fields to undefined', () => {
            const rawJson = JSON.stringify({
                nodes: [],
                edges: [],
                adrs: {},
                tasks: {
                    'task-12345678': {
                        id: 'task-12345678',
                        status: 'Todo',
                        title: 'Test Task',
                        linkedNodeIds: [],
                        createdAt: '2026-02-26T00:00:00Z',
                        updatedAt: '2026-02-26T00:00:00Z',
                        startDate: 20260301,
                        dueDate: { bad: true },
                    }
                }
            });

            const result = parseAriaState(rawJson);
            expect(result.ok).toBe(true);
            if (result.ok) {
                const task = result.state.tasks['task-12345678'];
                expect(task.startDate).toBeUndefined();
                expect(task.dueDate).toBeUndefined();
            }
        });

        it('should sanitize invalid date strings to undefined', () => {
            const rawJson = JSON.stringify({
                nodes: [],
                edges: [],
                adrs: {},
                tasks: {
                    'task-12345678': {
                        id: 'task-12345678',
                        status: 'Todo',
                        title: 'Test Task',
                        linkedNodeIds: [],
                        createdAt: '2026-02-26T00:00:00Z',
                        updatedAt: '2026-02-26T00:00:00Z',
                        dueDate: 'invalid-date',
                    }
                }
            });

            const result = parseAriaState(rawJson);
            expect(result.ok).toBe(true);
            if (result.ok) {
                const task = result.state.tasks['task-12345678'];
                expect(task.dueDate).toBeUndefined();
            }
        });

        it('should sanitize impossible calendar dates to undefined', () => {
            const rawJson = JSON.stringify({
                nodes: [],
                edges: [],
                adrs: {},
                tasks: {
                    'task-12345678': {
                        id: 'task-12345678',
                        status: 'Todo',
                        title: 'Test Task',
                        linkedNodeIds: [],
                        createdAt: '2026-02-26T00:00:00Z',
                        updatedAt: '2026-02-26T00:00:00Z',
                        startDate: '2026-02-31',
                    }
                }
            });

            const result = parseAriaState(rawJson);
            expect(result.ok).toBe(true);
            if (result.ok) {
                const task = result.state.tasks['task-12345678'];
                expect(task.startDate).toBeUndefined();
            }
        });
    });

    describe('generateStatusMd', () => {
        it('should include date range in markdown output', () => {
            const tasks: Record<string, KanbanTask> = {
                'task-1': {
                    id: 'task-1',
                    status: 'Todo',
                    title: 'Dated Task',
                    linkedNodeIds: [],
                    createdAt: '',
                    updatedAt: '',
                    startDate: '2026-03-01',
                    dueDate: '2026-03-10'
                }
            };

            const markdown = generateStatusMd(tasks);
            expect(markdown).toContain('Dated Task 📅 2026-03-01〜2026-03-10');
            expect(markdown).toMatch(/^- \[ \] Dated Task 📅 2026-03-01〜2026-03-10 <!-- task-id-task-1 -->$/m);
        });

        it('should include single date in markdown output', () => {
            const tasks: Record<string, KanbanTask> = {
                'task-1': {
                    id: 'task-1',
                    status: 'Todo',
                    title: 'Only Due',
                    linkedNodeIds: [],
                    createdAt: '',
                    updatedAt: '',
                    dueDate: '2026-03-10'
                }
            };

            const markdown = generateStatusMd(tasks);
            expect(markdown).toContain('Only Due 📅 〜2026-03-10');
            expect(markdown).toMatch(/^- \[ \] Only Due 📅 〜2026-03-10 <!-- task-id-task-1 -->$/m);
        });

        it('should keep task id anchor at end of line when only startDate exists', () => {
            const tasks: Record<string, KanbanTask> = {
                'task-1': {
                    id: 'task-1',
                    status: 'Todo',
                    title: 'Only Start',
                    linkedNodeIds: [],
                    createdAt: '',
                    updatedAt: '',
                    startDate: '2026-03-01'
                }
            };

            const markdown = generateStatusMd(tasks);
            expect(markdown).toMatch(/^- \[ \] Only Start 📅 2026-03-01〜 <!-- task-id-task-1 -->$/m);
        });
    });
});
