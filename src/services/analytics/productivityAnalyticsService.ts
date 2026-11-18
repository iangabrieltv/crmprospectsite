import { Lead } from '../../types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialPost,
  Task,
} from '../../types/kaizen';
import { FinancialAuditLog, FinancialTransaction } from '../../types/finance';
import { ResourceFile } from '../../types/resources';
import { ResolvedAnalyticsPeriod } from '../../types/analytics';
import {
  buildTimeBucketsForPeriod,
  computeRatioPct,
  extractLocalYmd,
  getBucketKeyForYmd,
} from './periodService';
import { isTaskOverdue } from '../taskService';

export type ProductivityActivityModule =
  | 'tarefas'
  | 'projetos'
  | 'comercial'
  | 'propostas'
  | 'agenda'
  | 'social'
  | 'financeiro'
  | 'materiais';

export interface ProductivityActivityItem {
  id: string;
  dateYmd: string;
  timestampIso: string;
  module: ProductivityActivityModule;
  moduleLabel: string;
  title: string;
  detail?: string;
  clientId?: string;
  clientName?: string;
}

export interface ProductivityTimePoint {
  key: string;
  label: string;
  tasksCompleted: number;
  commercialTouches: number;
  agendaCompleted: number;
  socialPublished: number;
  totalActions: number;
}

export interface ProductivityAnalyticsSnapshot {
  period: ResolvedAnalyticsPeriod;
  tasksCompletedInPeriod: number;
  previousTasksCompletedInPeriod: number;
  tasksCompletedPerDayAvg: number;
  projectsCompletedInPeriod: number;
  agendaCompletedInPeriod: number;
  commercialTouchesInPeriod: number;
  proposalsCreatedOrApprovedInPeriod: number;
  socialPublishedInPeriod: number;
  financialMovementsInPeriod: number;
  materialsUploadedInPeriod: number;
  activeDaysCount: number;
  consistencyRatePct: number;
  openTasksBacklog: number;
  overdueTasksBacklog: number;
  overdueProjectsBacklog: number;
  overdueSocialBacklog: number;
  totalOverdueBacklog: number;
  backlogPressureRatio: number | null;
  timeSeries: ProductivityTimePoint[];
  recentActivities: ProductivityActivityItem[];
  workedHoursAvailable: false;
  workedHoursLimitationNote: string;
}

export function computeProductivityAnalytics(params: {
  tasks: Task[];
  projects: Project[];
  leads: Lead[];
  proposals: ProposalContract[];
  agendaEvents: AgendaEvent[];
  socialPosts: SocialPost[];
  financialTransactions: FinancialTransaction[];
  financialAuditLogs: FinancialAuditLog[];
  resourceFiles: ResourceFile[];
  clients: Client[];
  period: ResolvedAnalyticsPeriod;
  todayStr: string;
  timezone?: string;
}): ProductivityAnalyticsSnapshot {
  const {
    tasks,
    projects,
    leads,
    proposals,
    agendaEvents,
    socialPosts,
    financialTransactions,
    resourceFiles,
    clients,
    period,
    todayStr,
    timezone,
  } = params;

  const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));
  const buckets = buildTimeBucketsForPeriod(period);
  const seriesMap = new Map<string, ProductivityTimePoint>();
  for (const b of buckets) {
    seriesMap.set(b.key, {
      key: b.key,
      label: b.label,
      tasksCompleted: 0,
      commercialTouches: 0,
      agendaCompleted: 0,
      socialPublished: 0,
      totalActions: 0,
    });
  }

  const activeDaysSet = new Set<string>();
  const activities: ProductivityActivityItem[] = [];

  const inRange = (ymd: string | null): ymd is string =>
    Boolean(ymd && ymd >= period.startDate && ymd <= period.endDate);

  const inPrevRange = (ymd: string | null): boolean =>
    Boolean(ymd && ymd >= period.previousStartDate && ymd <= period.previousEndDate);

  const recordPoint = (
    ymd: string,
    field: 'tasksCompleted' | 'commercialTouches' | 'agendaCompleted' | 'socialPublished'
  ) => {
    activeDaysSet.add(ymd);
    const key = getBucketKeyForYmd(ymd, buckets);
    if (!key || !seriesMap.has(key)) return;
    const pt = seriesMap.get(key)!;
    pt[field] += 1;
    pt.totalActions += 1;
  };

  let tasksCompletedInPeriod = 0;
  let previousTasksCompletedInPeriod = 0;
  let openTasksBacklog = 0;
  let overdueTasksBacklog = 0;

  for (const task of tasks) {
    if (task.status === 'concluida') {
      const doneIso = task.completedAt || task.updatedAt;
      const doneYmd = extractLocalYmd(doneIso, timezone);
      if (inRange(doneYmd)) {
        tasksCompletedInPeriod += 1;
        recordPoint(doneYmd, 'tasksCompleted');
        activities.push({
          id: `act-task-${task.id}`,
          dateYmd: doneYmd,
          timestampIso: doneIso || `${doneYmd}T12:00:00`,
          module: 'tarefas',
          moduleLabel: 'Tarefas',
          title: `Tarefa concluída: ${task.title}`,
          detail: task.phaseLabel || undefined,
          clientId: task.clientId,
          clientName: task.clientId ? clientMap.get(task.clientId) : undefined,
        });
      } else if (inPrevRange(doneYmd)) {
        previousTasksCompletedInPeriod += 1;
      }
    } else {
      openTasksBacklog += 1;
      if (isTaskOverdue(task, todayStr)) {
        overdueTasksBacklog += 1;
      }
    }
  }

  let projectsCompletedInPeriod = 0;
  let overdueProjectsBacklog = 0;
  for (const proj of projects) {
    if (proj.status === 'concluido') {
      const doneIso = proj.completedAt || proj.updatedAt;
      const doneYmd = extractLocalYmd(doneIso, timezone);
      if (inRange(doneYmd)) {
        projectsCompletedInPeriod += 1;
        activeDaysSet.add(doneYmd);
        activities.push({
          id: `act-proj-${proj.id}`,
          dateYmd: doneYmd,
          timestampIso: doneIso || `${doneYmd}T12:00:00`,
          module: 'projetos',
          moduleLabel: 'Projetos',
          title: `Projeto concluído: ${proj.name}`,
          detail: proj.serviceType,
          clientId: proj.clientId,
          clientName: clientMap.get(proj.clientId),
        });
      }
    } else if (
      proj.status !== 'cancelado' &&
      proj.status !== 'pausado' &&
      proj.dueDate &&
      proj.dueDate < todayStr
    ) {
      overdueProjectsBacklog += 1;
    }
  }

  let commercialTouchesInPeriod = 0;
  for (const lead of leads) {
    const touchIso = lead.lastContactDate || (lead.stage !== 'leads_sem_contato' ? lead.updatedAt : undefined);
    const touchYmd = extractLocalYmd(touchIso, timezone);
    if (inRange(touchYmd)) {
      commercialTouchesInPeriod += 1;
      recordPoint(touchYmd, 'commercialTouches');
      activities.push({
        id: `act-lead-${lead.id}`,
        dateYmd: touchYmd,
        timestampIso: touchIso || `${touchYmd}T12:00:00`,
        module: 'comercial',
        moduleLabel: 'CRM / Comercial',
        title: `Abordagem comercial: ${lead.companyName}`,
        detail: lead.city || undefined,
      });
    }
  }

  let proposalsCreatedOrApprovedInPeriod = 0;
  for (const prop of proposals) {
    const refIso = prop.signedAt || prop.approvedAt || prop.sentAt || prop.createdAt;
    const refYmd = extractLocalYmd(refIso, timezone);
    if (inRange(refYmd)) {
      proposalsCreatedOrApprovedInPeriod += 1;
      activeDaysSet.add(refYmd);
      activities.push({
        id: `act-prop-${prop.id}`,
        dateYmd: refYmd,
        timestampIso: refIso || `${refYmd}T12:00:00`,
        module: 'propostas',
        moduleLabel: 'Propostas & Contratos',
        title: `${prop.kind === 'contrato' ? 'Contrato' : 'Proposta'} ${prop.code}: ${prop.title}`,
        detail: `${prop.recipientCompany} · Status: ${prop.status}`,
        clientId: prop.clientId,
        clientName: prop.clientId ? clientMap.get(prop.clientId) : prop.recipientCompany,
      });
    }
  }

  let agendaCompletedInPeriod = 0;
  for (const ev of agendaEvents) {
    if (ev.status === 'concluido') {
      const evYmd = extractLocalYmd(ev.date, timezone);
      if (inRange(evYmd)) {
        agendaCompletedInPeriod += 1;
        recordPoint(evYmd, 'agendaCompleted');
        activities.push({
          id: `act-ev-${ev.id}`,
          dateYmd: evYmd,
          timestampIso: ev.updatedAt || `${evYmd}T${ev.startTime || '12:00'}:00`,
          module: 'agenda',
          moduleLabel: 'Agenda',
          title: `Compromisso concluído: ${ev.title}`,
          clientId: ev.clientId,
          clientName: ev.clientId ? clientMap.get(ev.clientId) : undefined,
        });
      }
    }
  }

  let socialPublishedInPeriod = 0;
  let overdueSocialBacklog = 0;
  for (const post of socialPosts) {
    if (post.status === 'publicado') {
      const pubIso = post.publishedAt || post.updatedAt || post.plannedDate;
      const pubYmd = extractLocalYmd(pubIso, timezone);
      if (inRange(pubYmd)) {
        socialPublishedInPeriod += 1;
        recordPoint(pubYmd, 'socialPublished');
        activities.push({
          id: `act-soc-${post.id}`,
          dateYmd: pubYmd,
          timestampIso: pubIso || `${pubYmd}T12:00:00`,
          module: 'social',
          moduleLabel: 'Redes Sociais',
          title: `Publicação confirmada: ${post.title}`,
          clientId: post.clientId,
          clientName:
            post.ownerType === 'kaizen'
              ? 'Agência Kaizen'
              : post.clientId
              ? clientMap.get(post.clientId)
              : undefined,
        });
      }
    } else if (post.plannedDate && post.plannedDate < todayStr) {
      overdueSocialBacklog += 1;
    }
  }

  let financialMovementsInPeriod = 0;
  for (const tx of financialTransactions) {
    if (tx.date >= period.startDate && tx.date <= period.endDate) {
      financialMovementsInPeriod += 1;
      activeDaysSet.add(tx.date);
      activities.push({
        id: `act-fin-${tx.id}`,
        dateYmd: tx.date,
        timestampIso: tx.createdAt || `${tx.date}T12:00:00`,
        module: 'financeiro',
        moduleLabel: 'Financeiro',
        title:
          tx.kind === 'recebimento'
            ? 'Recebimento financeiro registrado'
            : tx.kind === 'pagamento'
            ? 'Pagamento financeiro registrado'
            : 'Estorno / Ajuste financeiro',
        detail: tx.notes || `R$ ${(tx.amountCents / 100).toFixed(2).replace('.', ',')}`,
      });
    }
  }

  let materialsUploadedInPeriod = 0;
  for (const file of resourceFiles) {
    const upYmd = extractLocalYmd(file.uploadedAt, timezone);
    if (inRange(upYmd)) {
      materialsUploadedInPeriod += 1;
      activeDaysSet.add(upYmd);
      activities.push({
        id: `act-res-${file.id}`,
        dateYmd: upYmd,
        timestampIso: file.uploadedAt,
        module: 'materiais',
        moduleLabel: 'Materiais',
        title: `Material cadastrado: ${file.name}`,
        clientId: file.clientId,
        clientName: file.clientId ? clientMap.get(file.clientId) : undefined,
      });
    }
  }

  activities.sort((a, b) => {
    if (b.dateYmd !== a.dateYmd) return b.dateYmd.localeCompare(a.dateYmd);
    return b.timestampIso.localeCompare(a.timestampIso);
  });

  const activeDaysCount = activeDaysSet.size;
  const consistencyRatePct =
    computeRatioPct(activeDaysCount, period.daysCount) ?? 0;
  const totalOverdueBacklog =
    overdueTasksBacklog + overdueProjectsBacklog + overdueSocialBacklog;

  return {
    period,
    tasksCompletedInPeriod,
    previousTasksCompletedInPeriod,
    tasksCompletedPerDayAvg: Number(
      (tasksCompletedInPeriod / Math.max(1, period.daysCount)).toFixed(2)
    ),
    projectsCompletedInPeriod,
    agendaCompletedInPeriod,
    commercialTouchesInPeriod,
    proposalsCreatedOrApprovedInPeriod,
    socialPublishedInPeriod,
    financialMovementsInPeriod,
    materialsUploadedInPeriod,
    activeDaysCount,
    consistencyRatePct,
    openTasksBacklog,
    overdueTasksBacklog,
    overdueProjectsBacklog,
    overdueSocialBacklog,
    totalOverdueBacklog,
    backlogPressureRatio:
      tasksCompletedInPeriod > 0
        ? Number((totalOverdueBacklog / tasksCompletedInPeriod).toFixed(2))
        : totalOverdueBacklog > 0
        ? totalOverdueBacklog
        : null,
    timeSeries: Array.from(seriesMap.values()),
    recentActivities: activities,
    workedHoursAvailable: false,
    workedHoursLimitationNote:
      'O sistema atual não possui cronômetro nem apontamento manual de horas trabalhadas por tarefa/projeto. Os indicadores de produtividade medem estritamente entregas concluídas, dias ativos e cumprimento de prazos.',
  };
}
