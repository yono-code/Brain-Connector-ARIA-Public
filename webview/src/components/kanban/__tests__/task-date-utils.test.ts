import { describe, it, expect } from 'vitest';
import type { KanbanTask } from '../../../../../src/shared/types';
import {
  getLocalTodayYmd,
  isDueDateOverdue,
  shouldHideOldDoneTask,
} from '../task-date-utils';

function makeTask(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 'task-12345678',
    status: 'Done',
    title: 'Test Task',
    linkedNodeIds: [],
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('task-date-utils', () => {
  describe('getLocalTodayYmd', () => {
    it('formats local date as YYYY-MM-DD', () => {
      const date = new Date(2026, 2, 7, 12, 34, 56); // local time: 2026-03-07
      expect(getLocalTodayYmd(date)).toBe('2026-03-07');
    });
  });

  describe('isDueDateOverdue', () => {
    it('returns true only when dueDate is before today', () => {
      expect(isDueDateOverdue('2026-03-09', '2026-03-10')).toBe(true);
      expect(isDueDateOverdue('2026-03-10', '2026-03-10')).toBe(false);
      expect(isDueDateOverdue('2026-03-11', '2026-03-10')).toBe(false);
    });

    it('returns false for invalid date strings', () => {
      expect(isDueDateOverdue('invalid-date', '2026-03-10')).toBe(false);
      expect(isDueDateOverdue('2026-03-09', 'invalid-date')).toBe(false);
      expect(isDueDateOverdue('2026-02-31', '2026-03-10')).toBe(false);
    });
  });

  describe('shouldHideOldDoneTask', () => {
    it('hides done task when dueDate+7 days has passed and filter is enabled', () => {
      const task = makeTask({ status: 'Done', dueDate: '2026-01-01' });
      const now = new Date(2026, 0, 10, 0, 0, 1);
      expect(shouldHideOldDoneTask(task, true, now)).toBe(true);
    });

    it('does not hide task on threshold boundary', () => {
      const task = makeTask({ status: 'Done', dueDate: '2026-01-01' });
      const now = new Date(2026, 0, 8, 0, 0, 0);
      expect(shouldHideOldDoneTask(task, true, now)).toBe(false);
    });

    it('does not hide when filter is disabled', () => {
      const task = makeTask({ status: 'Done', dueDate: '2026-01-01' });
      const now = new Date(2026, 0, 20, 0, 0, 0);
      expect(shouldHideOldDoneTask(task, false, now)).toBe(false);
    });

    it('does not hide non-Done tasks or tasks without dueDate', () => {
      const now = new Date(2026, 0, 20, 0, 0, 0);
      expect(shouldHideOldDoneTask(makeTask({ status: 'Todo', dueDate: '2026-01-01' }), true, now)).toBe(false);
      expect(shouldHideOldDoneTask(makeTask({ status: 'Done', dueDate: undefined }), true, now)).toBe(false);
    });

    it('does not hide invalid dueDate strings (graceful handling)', () => {
      const task = makeTask({ status: 'Done', dueDate: 'invalid-date' });
      const now = new Date(2026, 0, 20, 0, 0, 0);
      expect(shouldHideOldDoneTask(task, true, now)).toBe(false);
    });

    it('does not hide impossible calendar dates', () => {
      const task = makeTask({ status: 'Done', dueDate: '2026-02-31' });
      const now = new Date(2026, 2, 20, 0, 0, 0);
      expect(shouldHideOldDoneTask(task, true, now)).toBe(false);
    });
  });
});
