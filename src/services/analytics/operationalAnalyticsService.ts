import {
  Client,
  Project,
  ProjectStatus,
  ProjectTemplateId,
  Task,
  TaskPriority,
  TaskStatus,
  getProjectStatusMeta,
  getTaskPriorityMeta,
  getTaskStatusMeta,
} from '../../types/kaizen';
import { ResolvedAnalyticsPeriod } from '../../types/analytics';
import { calculateProjectProgress } from '../projectService';
import { isTaskOverdue } from '../taskService';
import { addDaysYmd, diffDaysYmd } from '../finance/money';
import { computeRatioPct, extractLocalYmd, isDateInRange } from './periodService';

export interface ProjectAnalyticsRow {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  serviceType: string;
  templateId: ProjectTemplateId;
  status: ProjectStatus;
  statusLabel: string;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  progressPct: number;
  isOverdue: boolean;
  daysOverdue: number;
  deliveredOnTime: boolean | null;
}

export interface ProjectBreakdownItem {
  key: string;
  label: string;
  count: number;
  activeCount: number;
  completedCount: number;
  avgProgressPct: number;
}

export interface OperationalAnalyticsSnapshot {
  period: ResolvedAnalyticsPeriod;
  // Projetos
  projects: {
    totalBase: number;
    activeCount: number; // nao_iniciado, em_andamento, em_revisao, aguardando_cliente
    inProgressCount: number;
    inReviewCount: number;
    awaitingClientCount: number;
    pausedCount: number;
    cancelledCount: number;
    completedTotal: number;
    completedInPeriod: number;
    previousCompletedInPeriod: number;
    createdInPeriod: number;
    overdueActiveCount: number;
    dueWithin7DaysCount: number;
    avgProgressPct: number;
    onTimeDelivery: {
      onTimeCount: number;
      lateCount: number;
      withoutDueDateCount: number;
      ratePct: number | null;
    };
    avgCompletedDurationDays: {
      valueDays: number | null;
      sampleSize: number;
    };
    byStatus: { status: ProjectStatus; label: string; count: number }[];
    byTemplate: ProjectBreakdownItem[];
    byServiceType: ProjectBreakdownItem[];
    rows: ProjectAnalyticsRow[];
  };
  // Tarefas
  tasks: {
    totalBase: number;
    openCount: number;
    inProgressCount: number;
    inReviewCount: number;
    awaitingCount: number;
    completedTotal: number;
    completedInPeriod: number;
    previousCompletedInPeriod: number;
    createdInPeriod: number;
    overdueOpenCount: number;
    dueTodayCount: number;
    dueWithin7DaysCount: number;
    withoutDueDateCount: number;
    onTimeCompletion: {
      onTimeCount: number;
      lateCount: number;
      withoutDueDateCount: number;
      ratePct: number | null;
    };
    completionRatePct: number | null;
    byStatus: { status: TaskStatus; label: string; count: number }[];
    byPriority: { priority: TaskPriority; label: string; openCount: number; overdueCount: number }[];
    overdueList: {
      id: string;
      title: string;
      projectName: string;
      clientName: string;
      priorityLabel: string;
      dueDate: string;
      daysOverdue: number;
    }[];
  };
  /**
   * Nota explícita de integridade: projetos cancelados nunca são contados como concluídos,
   * e projetos nunca são marcados como concluídos automaticamente ao finalizar tarefas.
   */
  integrityNote: string;
}

const ACTIVE_PROJECT_STATUSES = new Set<ProjectStatus>([
  'nao_iniciado',
  'em_andamento',
  'em_revisao',
  'aguardando_cliente',
]);

const TEMPLATE_LABELS: Record<ProjectTemplateId, string> = {
  kaizen_start: 'Kaizen Start',
  kaizen_performance: 'Kaizen Performance',
  personalizado: 'Personalizado',
};

export function computeOperationalAnalytics(params: {
  projects: Project[];
  tasks: Task[];
  clients: Client[];
  period: ResolvedAnalyticsPeriod;
  todayStr: string;
  timezone?: string;
}): OperationalAnalyticsSnapshot {
  const { projects, tasks, clients, period, todayStr, timezone } = params;
  const next7Days = addDaysYmd(todayStr, 7);

  const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // ---------------- PROJETOS ----------------
  let activeProjCount = 0;
  let inProgressProjCount = 0;
  let inReviewProjCount = 0;
  let awaitingClientProjCount = 0;
  let pausedProjCount = 0;
  let cancelledProjCount = 0;
  let completedProjTotal = 0;
  let completedProjInPeriod = 0;
  let previousCompletedProjInPeriod = 0;
  let createdProjInPeriod = 0;
  let overdueActiveProjCount = 0;
  let dueWithin7DaysProjCount = 0;

  let onTimeProjCount = 0;
  let lateProjCount = 0;
  let noDueDateCompletedProjCount = 0;
  const completedProjDurations: number[] = [];

  const projStatusCounts = new Map<ProjectStatus, number>();
  const projTemplateAgg = new Map<
    ProjectTemplateId,
    { count: number; activeCount: number; completedCount: number; progressSum: number }
  >();
  const projServiceAgg = new Map<
    string,
    { count: number; activeCount: number; completedCount: number; progressSum: number }
  >();

  const projectRows: ProjectAnalyticsRow[] = [];

  for (const project of projects) {
    projStatusCounts.set(project.status, (projStatusCounts.get(project.status) || 0) + 1);

    const progress = calculateProjectProgress(project, tasks, todayStr);
    const isActive = ACTIVE_PROJECT_STATUSES.has(project.status);
    const isCompleted = project.status === 'concluido';
    const isCancelled = project.status === 'cancelado';

    if (isActive) activeProjCount += 1;
    if (project.status === 'em_andamento') inProgressProjCount += 1;
    if (project.status === 'em_revisao') inReviewProjCount += 1;
    if (project.status === 'aguardando_cliente') awaitingClientProjCount += 1;
    if (project.status === 'pausado') pausedProjCount += 1;
    if (isCancelled) cancelledProjCount += 1;

    if (isDateInRange(project.createdAt, period.startDate, period.endDate, timezone)) {
      createdProjInPeriod += 1;
    }

    const isOverdue =
      isActive && Boolean(project.dueDate) && (project.dueDate as string) < todayStr;
    const daysOverdue = isOverdue
      ? Math.max(0, diffDaysYmd(todayStr, project.dueDate as string))
      : 0;

    if (isOverdue) overdueActiveProjCount += 1;
    if (
      isActive &&
      project.dueDate &&
      project.dueDate >= todayStr &&
      project.dueDate <= next7Days
    ) {
      dueWithin7DaysProjCount += 1;
    }

    let deliveredOnTime: boolean | null = null;

    if (isCompleted) {
      completedProjTotal += 1;
      const doneYmd = extractLocalYmd(project.completedAt || project.updatedAt, timezone);
      if (doneYmd && doneYmd >= period.startDate && doneYmd <= period.endDate) {
        completedProjInPeriod += 1;
      }
      if (
        doneYmd &&
        doneYmd >= period.previousStartDate &&
        doneYmd <= period.previousEndDate
      ) {
        previousCompletedProjInPeriod += 1;
      }

      if (doneYmd && project.dueDate) {
        if (doneYmd <= project.dueDate) {
          onTimeProjCount += 1;
          deliveredOnTime = true;
        } else {
          lateProjCount += 1;
          deliveredOnTime = false;
        }
      } else {
        noDueDateCompletedProjCount += 1;
      }

      const startYmd = extractLocalYmd(project.startDate || project.createdAt, timezone);
      if (startYmd && doneYmd) {
        const dur = diffDaysYmd(doneYmd, startYmd);
        if (dur >= 0) completedProjDurations.push(dur);
      }
    }

    // Template aggregation (exclui cancelados da média de progresso ativo/concluído)
    const tmplKey = project.templateId || 'personalizado';
    const curTmpl = projTemplateAgg.get(tmplKey) || {
      count: 0,
      activeCount: 0,
      completedCount: 0,
      progressSum: 0,
    };
    curTmpl.count += 1;
    if (isActive) curTmpl.activeCount += 1;
    if (isCompleted) curTmpl.completedCount += 1;
    if (!isCancelled) curTmpl.progressSum += progress.percent;
    projTemplateAgg.set(tmplKey, curTmpl);

    // Service Type aggregation
    const svcKey = (project.serviceType || 'Não especificado').trim();
    const curSvc = projServiceAgg.get(svcKey) || {
      count: 0,
      activeCount: 0,
      completedCount: 0,
      progressSum: 0,
    };
    curSvc.count += 1;
    if (isActive) curSvc.activeCount += 1;
    if (isCompleted) curSvc.completedCount += 1;
    if (!isCancelled) curSvc.progressSum += progress.percent;
    projServiceAgg.set(svcKey, curSvc);

    projectRows.push({
      id: project.id,
      name: project.name,
      clientId: project.clientId,
      clientName: clientMap.get(project.clientId) || 'Cliente não vinculado',
      serviceType: project.serviceType,
      templateId: tmplKey,
      status: project.status,
      statusLabel: getProjectStatusMeta(project.status).label,
      startDate: project.startDate,
      dueDate: project.dueDate,
      completedAt: project.completedAt,
      totalTasks: progress.totalTasks,
      completedTasks: progress.completedTasks,
      overdueTasks: progress.overdueTasks,
      progressPct: progress.percent,
      isOverdue,
      daysOverdue,
      deliveredOnTime,
    });
  }

  projectRows.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.progressPct - a.progressPct;
  });

  const nonCancelledProjects = projectRows.filter((p) => p.status !== 'cancelado');
  const avgProgressPct =
    nonCancelledProjects.length > 0
      ? Math.round(
          nonCancelledProjects.reduce((sum, p) => sum + p.progressPct, 0) /
            nonCancelledProjects.length
        )
      : 0;

  const byTemplate: ProjectBreakdownItem[] = (
    Object.keys(TEMPLATE_LABELS) as ProjectTemplateId[]
  ).map((tid) => {
    const agg = projTemplateAgg.get(tid) || {
      count: 0,
      activeCount: 0,
      completedCount: 0,
      progressSum: 0,
    };
    const nonCancelCount = projects.filter(
      (p) => (p.templateId || 'personalizado') === tid && p.status !== 'cancelado'
    ).length;
    return {
      key: tid,
      label: TEMPLATE_LABELS[tid],
      count: agg.count,
      activeCount: agg.activeCount,
      completedCount: agg.completedCount,
      avgProgressPct:
        nonCancelCount > 0 ? Math.round(agg.progressSum / nonCancelCount) : 0,
    };
  });

  const byServiceType: ProjectBreakdownItem[] = Array.from(projServiceAgg.entries())
    .map(([label, agg]) => {
      const nonCancelCount = projects.filter(
        (p) =>
          (p.serviceType || 'Não especificado').trim() === label &&
          p.status !== 'cancelado'
      ).length;
      return {
        key: label,
        label,
        count: agg.count,
        activeCount: agg.activeCount,
        completedCount: agg.completedCount,
        avgProgressPct:
          nonCancelCount > 0 ? Math.round(agg.progressSum / nonCancelCount) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  const byProjectStatus: { status: ProjectStatus; label: string; count: number }[] = (
    [
      'nao_iniciado',
      'em_andamento',
      'em_revisao',
      'aguardando_cliente',
      'concluido',
      'pausado',
      'cancelado',
    ] as ProjectStatus[]
  ).map((st) => ({
    status: st,
    label: getProjectStatusMeta(st).label,
    count: projStatusCounts.get(st) || 0,
  }));

  // ---------------- TAREFAS ----------------
  let openTasks = 0;
  let inProgressTasks = 0;
  let inReviewTasks = 0;
  let awaitingTasks = 0;
  let completedTasksTotal = 0;
  let completedTasksInPeriod = 0;
  let previousCompletedTasksInPeriod = 0;
  let createdTasksInPeriod = 0;
  let overdueOpenTasks = 0;
  let dueTodayTasks = 0;
  let dueWithin7DaysTasks = 0;
  let withoutDueDateTasks = 0;

  let onTimeTaskCount = 0;
  let lateTaskCount = 0;
  let noDueDateCompletedTaskCount = 0;

  const taskStatusCounts = new Map<TaskStatus, number>();
  const taskPriorityMap = new Map<TaskPriority, { openCount: number; overdueCount: number }>();
  const overdueTaskRows: OperationalAnalyticsSnapshot['tasks']['overdueList'] = [];

  for (const task of tasks) {
    taskStatusCounts.set(task.status, (taskStatusCounts.get(task.status) || 0) + 1);

    if (isDateInRange(task.createdAt, period.startDate, period.endDate, timezone)) {
      createdTasksInPeriod += 1;
    }

    if (task.status === 'concluida') {
      completedTasksTotal += 1;
      const doneYmd = extractLocalYmd(task.completedAt || task.updatedAt, timezone);
      if (doneYmd && doneYmd >= period.startDate && doneYmd <= period.endDate) {
        completedTasksInPeriod += 1;
      }
      if (
        doneYmd &&
        doneYmd >= period.previousStartDate &&
        doneYmd <= period.previousEndDate
      ) {
        previousCompletedTasksInPeriod += 1;
      }

      if (doneYmd && task.dueDate) {
        if (doneYmd <= task.dueDate) onTimeTaskCount += 1;
        else lateTaskCount += 1;
      } else {
        noDueDateCompletedTaskCount += 1;
      }
      continue;
    }

    openTasks += 1;
    if (task.status === 'em_andamento') inProgressTasks += 1;
    if (task.status === 'em_revisao') inReviewTasks += 1;
    if (task.status === 'aguardando') awaitingTasks += 1;

    const prio = task.priority || 'media';
    const prioCur = taskPriorityMap.get(prio) || { openCount: 0, overdueCount: 0 };
    prioCur.openCount += 1;

    const overdue = isTaskOverdue(task, todayStr);
    if (overdue) {
      overdueOpenTasks += 1;
      prioCur.overdueCount += 1;
      const proj = task.projectId ? projectMap.get(task.projectId) : undefined;
      const cId = task.clientId || proj?.clientId;
      overdueTaskRows.push({
        id: task.id,
        title: task.title,
        projectName: proj?.name || 'Tarefa avulsa',
        clientName: cId ? clientMap.get(cId) || 'Cliente' : 'Interno / Kaizen',
        priorityLabel: getTaskPriorityMeta(prio).label,
        dueDate: task.dueDate as string,
        daysOverdue: Math.max(1, diffDaysYmd(todayStr, task.dueDate as string)),
      });
    } else if (!task.dueDate) {
      withoutDueDateTasks += 1;
    } else if (task.dueDate === todayStr) {
      dueTodayTasks += 1;
      dueWithin7DaysTasks += 1;
    } else if (task.dueDate <= next7Days) {
      dueWithin7DaysTasks += 1;
    }

    taskPriorityMap.set(prio, prioCur);
  }

  overdueTaskRows.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const byTaskStatus: { status: TaskStatus; label: string; count: number }[] = (
    ['a_fazer', 'em_andamento', 'em_revisao', 'aguardando', 'concluida'] as TaskStatus[]
  ).map((st) => ({
    status: st,
    label: getTaskStatusMeta(st).label,
    count: taskStatusCounts.get(st) || 0,
  }));

  const byTaskPriority = (['urgente', 'alta', 'media', 'baixa'] as TaskPriority[]).map(
    (prio) => {
      const val = taskPriorityMap.get(prio) || { openCount: 0, overdueCount: 0 };
      return {
        priority: prio,
        label: getTaskPriorityMeta(prio).label,
        openCount: val.openCount,
        overdueCount: val.overdueCount,
      };
    }
  );

  return {
    period,
    projects: {
      totalBase: projects.length,
      activeCount: activeProjCount,
      inProgressCount: inProgressProjCount,
      inReviewCount: inReviewProjCount,
      awaitingClientCount: awaitingClientProjCount,
      pausedCount: pausedProjCount,
      cancelledCount: cancelledProjCount,
      completedTotal: completedProjTotal,
      completedInPeriod: completedProjInPeriod,
      previousCompletedInPeriod: previousCompletedProjInPeriod,
      createdInPeriod: createdProjInPeriod,
      overdueActiveCount: overdueActiveProjCount,
      dueWithin7DaysCount: dueWithin7DaysProjCount,
      avgProgressPct,
      onTimeDelivery: {
        onTimeCount: onTimeProjCount,
        lateCount: lateProjCount,
        withoutDueDateCount: noDueDateCompletedProjCount,
        ratePct: computeRatioPct(onTimeProjCount, onTimeProjCount + lateProjCount),
      },
      avgCompletedDurationDays: {
        valueDays:
          completedProjDurations.length > 0
            ? Number(
                (
                  completedProjDurations.reduce((s, d) => s + d, 0) /
                  completedProjDurations.length
                ).toFixed(1)
              )
            : null,
        sampleSize: completedProjDurations.length,
      },
      byStatus: byProjectStatus,
      byTemplate,
      byServiceType,
      rows: projectRows,
    },
    tasks: {
      totalBase: tasks.length,
      openCount: openTasks,
      inProgressCount: inProgressTasks,
      inReviewCount: inReviewTasks,
      awaitingCount: awaitingTasks,
      completedTotal: completedTasksTotal,
      completedInPeriod: completedTasksInPeriod,
      previousCompletedInPeriod: previousCompletedTasksInPeriod,
      createdInPeriod: createdTasksInPeriod,
      overdueOpenCount: overdueOpenTasks,
      dueTodayCount: dueTodayTasks,
      dueWithin7DaysCount: dueWithin7DaysTasks,
      withoutDueDateCount: withoutDueDateTasks,
      onTimeCompletion: {
        onTimeCount: onTimeTaskCount,
        lateCount: lateTaskCount,
        withoutDueDateCount: noDueDateCompletedTaskCount,
        ratePct: computeRatioPct(onTimeTaskCount, onTimeTaskCount + lateTaskCount),
      },
      completionRatePct: computeRatioPct(completedTasksTotal, tasks.length),
      byStatus: byTaskStatus,
      byPriority: byTaskPriority,
      overdueList: overdueTaskRows,
    },
    integrityNote:
      'Projetos cancelados não são contabilizados como concluídos. O percentual de execução dos projetos reflete estritamente tarefas vinculadas concluídas sem encerramento automático.',
  };
}
