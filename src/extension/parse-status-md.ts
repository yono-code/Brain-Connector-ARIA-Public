// ============================================================
// parse-status-md.ts — status.md パーサー（チェックボックス逆同期）
// ============================================================
//
// 責務:
// - status.md のタスク行を読み取り、Task の status/title/date を更新する
// - ID アンカーなし行は新規タスクとして Inbox に隔離する
// - 不正 ID は再採番して Inbox に隔離する
//
// ============================================================

import { KanbanTask, TaskStatus } from '../shared/types';

const TASK_ID_PATTERN = /^task-[a-f0-9]{8}$/;
const TASK_LINE_PATTERN = /^\s*-\s*\[( |x|X)\]\s+(.+?)\s*$/;
const TASK_ANCHOR_PATTERN = /^(.*?)\s*<!--\s*task-id-([^\s>]+)\s*-->\s*$/;
const TASK_DATE_TAIL_PATTERN = /^(.*?)(?:\s+📅\s*(\d{4}-\d{2}-\d{2})?\s*〜\s*(\d{4}-\d{2}-\d{2})?)\s*$/u;
const YMD_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ParseStatusMdResult =
  | { ok: true; tasks: Record<string, KanbanTask>; quarantinedCount: number }
  | { ok: false; error: string };

export function parseStatusMd(
  rawMarkdown: string,
  currentTasks: Record<string, KanbanTask>,
): ParseStatusMdResult {
  const cleaned = rawMarkdown.replace(/^\uFEFF/, '');

  if (!cleaned.trim()) {
    return { ok: false, error: 'ファイルが空です' };
  }

  // status.md に存在しないタスクは削除せず保持する（誤編集によるデータ消失を防ぐ）
  const nextTasks: Record<string, KanbanTask> = { ...currentTasks };
  const now = new Date().toISOString();
  let currentStatus: TaskStatus | null = null;
  let quarantinedCount = 0;

  for (const rawLine of cleaned.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const sectionStatus = detectSectionStatus(line);
    if (sectionStatus) {
      currentStatus = sectionStatus;
      continue;
    }

    const taskMatch = TASK_LINE_PATTERN.exec(line);
    if (!taskMatch) {
      continue;
    }

    const isChecked = taskMatch[1].toLowerCase() === 'x';
    const rawTaskContent = taskMatch[2].trim();
    const { taskId, contentWithoutAnchor } = splitTaskAnchor(rawTaskContent);
    const parsedContent = parseTaskContent(contentWithoutAnchor);
    const title = parsedContent.title || '（タイトルなし）';

    if (taskId && TASK_ID_PATTERN.test(taskId)) {
      const previous = nextTasks[taskId];
      const notePatch = previous?.note ? { note: previous.note } : {};
      nextTasks[taskId] = {
        id: taskId,
        status: resolveStatus(currentStatus, isChecked),
        title,
        ...notePatch,
        linkedNodeIds: previous?.linkedNodeIds ?? [],
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        startDate: parsedContent.startDate,
        dueDate: parsedContent.dueDate,
      };
      continue;
    }

    const newTaskId = createTaskId();
    if (taskId && !TASK_ID_PATTERN.test(taskId)) {
      console.warn(
        `ARIA: status.md の不正な task-id "${taskId}" を Inbox に隔離します。新 ID: "${newTaskId}"`
      );
    }

    nextTasks[newTaskId] = {
      id: newTaskId,
      status: 'Inbox',
      title,
      linkedNodeIds: [],
      createdAt: now,
      updatedAt: now,
      startDate: parsedContent.startDate,
      dueDate: parsedContent.dueDate,
    };
    quarantinedCount++;
  }

  return { ok: true, tasks: nextTasks, quarantinedCount };
}

function detectSectionStatus(line: string): TaskStatus | null {
  if (!line.startsWith('##')) {
    return null;
  }

  if (/in progress/i.test(line)) {
    return 'In Progress';
  }
  if (/inbox/i.test(line)) {
    return 'Inbox';
  }
  if (/todo/i.test(line)) {
    return 'Todo';
  }
  if (/done/i.test(line)) {
    return 'Done';
  }
  return null;
}

function splitTaskAnchor(content: string): { taskId?: string; contentWithoutAnchor: string } {
  const anchorMatch = TASK_ANCHOR_PATTERN.exec(content);
  if (!anchorMatch) {
    return { contentWithoutAnchor: content };
  }

  return {
    taskId: anchorMatch[2].trim(),
    contentWithoutAnchor: anchorMatch[1].trim(),
  };
}

function parseTaskContent(contentWithoutAnchor: string): {
  title: string;
  startDate?: string;
  dueDate?: string;
} {
  const trimmed = contentWithoutAnchor.trim();
  const dateMatch = TASK_DATE_TAIL_PATTERN.exec(trimmed);

  if (!dateMatch) {
    return { title: trimmed };
  }

  const title = dateMatch[1].trim();
  const startDate = sanitizeTaskDate(dateMatch[2]);
  const dueDate = sanitizeTaskDate(dateMatch[3]);

  if (!startDate && !dueDate) {
    return { title: trimmed };
  }

  return { title, startDate, dueDate };
}

function resolveStatus(
  sectionStatus: TaskStatus | null,
  isChecked: boolean,
): TaskStatus {
  if (isChecked) {
    return 'Done';
  }

  if (sectionStatus === 'Done') {
    // Done セクション内で [x]→[ ] にした場合は再オープンとして Todo に戻す
    return 'Todo';
  }

  return sectionStatus ?? 'Inbox';
}

function sanitizeTaskDate(rawValue?: string): string | undefined {
  if (typeof rawValue !== 'string') {
    return undefined;
  }
  const value = rawValue.trim();
  if (!value) {
    return undefined;
  }
  return isValidYmdDate(value) ? value : undefined;
}

function isValidYmdDate(value: string): boolean {
  const match = YMD_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function createTaskId(): string {
  const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toLowerCase();
  return `task-${shortId}`;
}
