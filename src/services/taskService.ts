import {
  Task,
  TaskPriority,
  TaskStatus,
  TASK_PRIORITY_OPTIONS,
} from '../types/kaizen';
import { getTodayIsoDate } from './projectService';

export type TaskQueueView =
  | 'todas'
  | 'hoje'
  | 'proximas'
  | 'atrasadas'
  | 'concluidas'
  | 'sem_prazo';

export function generateTaskId(): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `task-${Date.now()}-${rand}`;
}

export function generateTaskChecklistId(): string {
  const rand = Math.random().toString(36).substring(2, 6);
  return `chk-${Date.now()}-${rand}`;
}

export function isTaskOverdue(
  task: Task,
  todayStr: string = getTodayIsoDate()
): boolean {
  if (!task.dueDate || task.status === 'concluida') return false;
  return task.dueDate < todayStr;
}

export function isTaskDueToday(
  task: Task,
  todayStr: string = getTodayIsoDate()
): boolean {
  if (!task.dueDate) return false;
  return task.dueDate === todayStr;
}

export function isTaskUpcoming(
  task: Task,
  todayStr: string = getTodayIsoDate()
): boolean {
  if (!task.dueDate || task.status === 'concluida') return false;
  return task.dueDate > todayStr;
}

export interface TaskFilterOptions {
  queue?: TaskQueueView;
  projectId?: string;
  clientId?: string;
  priority?: TaskPriority | 'all';
  status?: TaskStatus | 'all';
  searchTerm?: string;
  todayStr?: string;
}

function getPriorityWeight(priority: TaskPriority): number {
  return TASK_PRIORITY_OPTIONS.find((p) => p.id === priority)?.weight || 2;
}

export function filterTasks(
  tasks: Task[],
  options: TaskFilterOptions = {}
): Task[] {
  const todayStr = options.todayStr || getTodayIsoDate();
  const query = (options.searchTerm || '').trim().toLowerCase();

  return tasks
    .filter((task) => {
      if (options.queue === 'hoje') {
        if (task.status === 'concluida' || !isTaskDueToday(task, todayStr)) {
          return false;
        }
      } else if (options.queue === 'proximas') {
        if (!isTaskUpcoming(task, todayStr)) {
          return false;
        }
      } else if (options.queue === 'atrasadas') {
        if (!isTaskOverdue(task, todayStr)) {
          return false;
        }
      } else if (options.queue === 'concluidas') {
        if (task.status !== 'concluida') {
          return false;
        }
      } else if (options.queue === 'sem_prazo') {
        if (Boolean(task.dueDate) || task.status === 'concluida') {
          return false;
        }
      }

      if (options.projectId && options.projectId !== 'all') {
        if (options.projectId === 'unlinked') {
          if (task.projectId) return false;
        } else if (task.projectId !== options.projectId) {
          return false;
        }
      }

      if (options.clientId && options.clientId !== 'all') {
        if (task.clientId !== options.clientId) return false;
      }

      if (options.priority && options.priority !== 'all') {
        if (task.priority !== options.priority) return false;
      }

      if (options.status && options.status !== 'all') {
        if (task.status !== options.status) return false;
      }

      if (query) {
        const haystack = [
          task.title,
          task.description || '',
          task.phaseLabel || '',
          task.notes || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Completed tasks always sink to bottom when mixed in 'todas'
      const aDone = a.status === 'concluida' ? 1 : 0;
      const bDone = b.status === 'concluida' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      // Overdue tasks first
      const aOver = isTaskOverdue(a, todayStr) ? 0 : 1;
      const bOver = isTaskOverdue(b, todayStr) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;

      // Then earliest dueDate (tasks with dueDate before tasks without)
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      // Then highest priority
      const weightDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
      if (weightDiff !== 0) return weightDiff;

      return b.createdAt.localeCompare(a.createdAt);
    });
}

export function transitionTaskStatus(task: Task, nextStatus: TaskStatus): Task {
  const nowIso = new Date().toISOString();
  const isDone = nextStatus === 'concluida';
  return {
    ...task,
    status: nextStatus,
    completedAt: isDone ? task.completedAt || nowIso : undefined,
    updatedAt: nowIso,
  };
}

export interface TaskQueueSummary {
  total: number;
  openCount: number;
  todayCount: number;
  upcomingCount: number;
  overdueCount: number;
  completedCount: number;
  noDueDateCount: number;
}

export function computeTaskSummary(
  tasks: Task[],
  todayStr: string = getTodayIsoDate()
): TaskQueueSummary {
  let openCount = 0;
  let todayCount = 0;
  let upcomingCount = 0;
  let overdueCount = 0;
  let completedCount = 0;
  let noDueDateCount = 0;

  for (const t of tasks) {
    if (t.status === 'concluida') {
      completedCount += 1;
      continue;
    }
    openCount += 1;
    if (!t.dueDate) {
      noDueDateCount += 1;
    } else if (t.dueDate < todayStr) {
      overdueCount += 1;
    } else if (t.dueDate === todayStr) {
      todayCount += 1;
    } else {
      upcomingCount += 1;
    }
  }

  return {
    total: tasks.length,
    openCount,
    todayCount,
    upcomingCount,
    overdueCount,
    completedCount,
    noDueDateCount,
  };
}
