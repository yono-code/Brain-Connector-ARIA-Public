import { afterEach, describe, expect, it, vi } from 'vitest';
import { KanbanTask } from '../../shared/types';
import { parseStatusMd } from '../parse-status-md';

describe('parseStatusMd', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks anchored tasks as Done when checkbox is checked', () => {
    const currentTasks: Record<string, KanbanTask> = {
      'task-11111111': {
        id: 'task-11111111',
        status: 'Todo',
        title: 'Old Title',
        linkedNodeIds: ['node-1'],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
    };
    const markdown = `
## 📋 Todo
- [x] Updated Title <!-- task-id-task-11111111 -->
`;

    const result = parseStatusMd(markdown, currentTasks);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const task = result.tasks['task-11111111'];
    expect(task.status).toBe('Done');
    expect(task.title).toBe('Updated Title');
    expect(task.linkedNodeIds).toEqual(['node-1']);
    expect(task.createdAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('adds tasks without anchors to Inbox with a generated ID', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');

    const markdown = `
## 📋 Todo
- [ ] New Task From Markdown
`;

    const result = parseStatusMd(markdown, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.quarantinedCount).toBe(1);
    expect(result.tasks['task-aaaaaaaa']).toMatchObject({
      id: 'task-aaaaaaaa',
      status: 'Inbox',
      title: 'New Task From Markdown',
    });
  });

  it('reassigns invalid anchor IDs to Inbox', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('bbbbbbbb-1111-2222-3333-444444444444');

    const markdown = `
## ✅ Done
- [x] Bad Anchor <!-- task-id-task-not-valid -->
`;

    const result = parseStatusMd(markdown, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.quarantinedCount).toBe(1);
    expect(result.tasks['task-bbbbbbbb']).toMatchObject({
      status: 'Inbox',
      title: 'Bad Anchor',
    });
  });

  it('parses date tails without polluting task title', () => {
    const markdown = `
## 📋 Todo
- [ ] Date Task 📅 2026-03-01〜2026-03-10 <!-- task-id-task-22222222 -->
`;

    const result = parseStatusMd(markdown, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.tasks['task-22222222']).toMatchObject({
      title: 'Date Task',
      startDate: '2026-03-01',
      dueDate: '2026-03-10',
      status: 'Todo',
    });
  });

  it('keeps existing tasks when they are absent from status.md', () => {
    const currentTasks: Record<string, KanbanTask> = {
      'task-33333333': {
        id: 'task-33333333',
        status: 'Inbox',
        title: 'Keep Me',
        linkedNodeIds: [],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
      'task-44444444': {
        id: 'task-44444444',
        status: 'Todo',
        title: 'Update Me',
        linkedNodeIds: [],
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
    };
    const markdown = `
## 📋 Todo
- [x] Updated <!-- task-id-task-44444444 -->
`;

    const result = parseStatusMd(markdown, currentTasks);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.tasks['task-33333333'].title).toBe('Keep Me');
    expect(result.tasks['task-44444444'].status).toBe('Done');
  });
});

