import type { KanbanTask } from '../../../../src/shared/types';

export function getLocalTodayYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isDueDateOverdue(
  dueDate: string,
  todayYmd: string = getLocalTodayYmd()
): boolean {
  const due = parseYmdLocalDate(dueDate);
  const today = parseYmdLocalDate(todayYmd);
  if (!due || !today) return false;
  return due < today;
}

export function shouldHideOldDoneTask(
  task: KanbanTask,
  filterEnabled: boolean,
  now: Date = new Date()
): boolean {
  if (!filterEnabled) return false;
  if (task.status !== 'Done') return false;
  if (!task.dueDate) return false;

  const threshold = parseYmdLocalDate(task.dueDate);
  if (!threshold) return false;

  threshold.setDate(threshold.getDate() + 7);
  return now > threshold;
}

function parseYmdLocalDate(ymd: string): Date | null {
  if (!isValidYmdDate(ymd)) return null;

  const [yearStr, monthStr, dayStr] = ymd.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function isValidYmdDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
