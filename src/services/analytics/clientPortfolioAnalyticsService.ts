import {
  AgendaEvent,
  Client,
  ClientStatus,
  Project,
  ProposalContract,
  Task,
  getClientStatusMeta,
} from '../../types/kaizen';
import { FinancialEntry, FinancialTransaction } from '../../types/finance';
import { ResolvedAnalyticsPeriod } from '../../types/analytics';
import { getTransactionSignedCashCents } from '../finance/cashFlowService';
import {
  getEffectiveEntryStatus,
  getEntryPendingCents,
} from '../finance/entriesService';
import { diffDaysYmd } from '../finance/money';
import { extractLocalYmd, isDateInRange } from './periodService';

export interface ClientPortfolioRow {
  clientId: string;
  companyName: string;
  contactName?: string;
  city?: string;
  status: ClientStatus;
  statusLabel: string;
  monthlyMrr: number;
  activeContractsCount: number;
  realizedRevenueInPeriodCents: number;
  realizedRevenueAllTimeCents: number;
  openReceivablesCents: number;
  overdueReceivablesCents: number;
  activeProjectsCount: number;
  completedProjectsCount: number;
  openTasksCount: number;
  overdueTasksCount: number;
  lastActivityYmd: string | null;
  daysSinceLastActivity: number | null;
  isPotentiallyInactive: boolean;
}

export interface ClientPortfolioAnalyticsSnapshot {
  period: ResolvedAnalyticsPeriod;
  totalClients: number;
  activeCount: number;
  onboardingCount: number;
  pausedCount: number;
  closedCount: number;
  newClientsInPeriod: number;
  previousNewClientsInPeriod: number;
  closedInPeriodCount: number;
  clientsWithOverdueFinanceCount: number;
  clientsWithoutActiveProjectsCount: number;
  potentiallyInactiveClientsCount: number;
  totalActiveContractedMrr: number;
  totalRealizedRevenueFromClientsInPeriodCents: number;
  byStatus: { status: ClientStatus; label: string; count: number }[];
  rows: ClientPortfolioRow[];
  topClientsByRevenue: ClientPortfolioRow[];
  inactiveAlertRows: ClientPortfolioRow[];
  dataLimitationsNote: string;
}

const ACTIVE_PROJ_STATUSES = new Set([
  'nao_iniciado',
  'em_andamento',
  'em_revisao',
  'aguardando_cliente',
]);

export function computeClientPortfolioAnalytics(params: {
  clients: Client[];
  proposals: ProposalContract[];
  projects: Project[];
  tasks: Task[];
  agendaEvents: AgendaEvent[];
  financialEntries: FinancialEntry[];
  financialTransactions: FinancialTransaction[];
  period: ResolvedAnalyticsPeriod;
  todayStr: string;
  timezone?: string;
}): ClientPortfolioAnalyticsSnapshot {
  const {
    clients,
    proposals,
    projects,
    tasks,
    agendaEvents,
    financialEntries,
    financialTransactions,
    period,
    todayStr,
    timezone,
  } = params;

  const entryById = new Map(financialEntries.map((e) => [e.id, e]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  // Mapear acumulados financeiros por clientId
  const revPeriodCentsByClient = new Map<string, number>();
  const revTotalCentsByClient = new Map<string, number>();
  const openReceivablesByClient = new Map<string, number>();
  const overdueReceivablesByClient = new Map<string, number>();
  const latestActivityByClient = new Map<string, string>();

  const registerActivity = (clientId: string | undefined, dateOrIso?: string) => {
    if (!clientId) return;
    const ymd = extractLocalYmd(dateOrIso, timezone);
    if (!ymd) return;
    const prev = latestActivityByClient.get(clientId);
    if (!prev || ymd > prev) {
      latestActivityByClient.set(clientId, ymd);
    }
  };

  for (const tx of financialTransactions) {
    const entry = entryById.get(tx.entryId);
    if (!entry || !entry.clientId || entry.kind !== 'receita') continue;
    const signed = getTransactionSignedCashCents(tx);
    const netIn = signed.inflowCents - signed.outflowCents;
    if (netIn === 0) continue;

    revTotalCentsByClient.set(
      entry.clientId,
      (revTotalCentsByClient.get(entry.clientId) || 0) + netIn
    );
    if (tx.date >= period.startDate && tx.date <= period.endDate) {
      revPeriodCentsByClient.set(
        entry.clientId,
        (revPeriodCentsByClient.get(entry.clientId) || 0) + netIn
      );
    }
    registerActivity(entry.clientId, tx.date);
  }

  for (const entry of financialEntries) {
    if (!entry.clientId || entry.status === 'cancelada' || entry.kind !== 'receita') continue;
    const pending = getEntryPendingCents(entry);
    if (pending <= 0) continue;
    openReceivablesByClient.set(
      entry.clientId,
      (openReceivablesByClient.get(entry.clientId) || 0) + pending
    );
    if (getEffectiveEntryStatus(entry, todayStr) === 'atrasada') {
      overdueReceivablesByClient.set(
        entry.clientId,
        (overdueReceivablesByClient.get(entry.clientId) || 0) + pending
      );
    }
  }

  const contractsByClient = new Map<string, number>();
  for (const prop of proposals) {
    if (!prop.clientId) continue;
    if (prop.status === 'aprovada' || prop.status === 'assinada') {
      contractsByClient.set(prop.clientId, (contractsByClient.get(prop.clientId) || 0) + 1);
    }
    registerActivity(prop.clientId, prop.signedAt || prop.approvedAt || prop.updatedAt || prop.createdAt);
  }

  const projActiveByClient = new Map<string, number>();
  const projCompletedByClient = new Map<string, number>();
  for (const proj of projects) {
    if (!proj.clientId) continue;
    if (ACTIVE_PROJ_STATUSES.has(proj.status)) {
      projActiveByClient.set(proj.clientId, (projActiveByClient.get(proj.clientId) || 0) + 1);
    } else if (proj.status === 'concluido') {
      projCompletedByClient.set(
        proj.clientId,
        (projCompletedByClient.get(proj.clientId) || 0) + 1
      );
    }
    registerActivity(proj.clientId, proj.updatedAt || proj.createdAt);
  }

  const tasksOpenByClient = new Map<string, number>();
  const tasksOverdueByClient = new Map<string, number>();
  for (const task of tasks) {
    const cid = task.clientId || (task.projectId ? projectById.get(task.projectId)?.clientId : undefined);
    if (!cid) continue;
    registerActivity(cid, task.completedAt || task.updatedAt || task.createdAt);
    if (task.status === 'concluida') continue;
    tasksOpenByClient.set(cid, (tasksOpenByClient.get(cid) || 0) + 1);
    if (task.dueDate && task.dueDate < todayStr) {
      tasksOverdueByClient.set(cid, (tasksOverdueByClient.get(cid) || 0) + 1);
    }
  }

  for (const ev of agendaEvents) {
    if (ev.clientId && ev.status !== 'cancelado') {
      registerActivity(ev.clientId, ev.date);
    }
  }

  let activeCount = 0;
  let onboardingCount = 0;
  let pausedCount = 0;
  let closedCount = 0;
  let newClientsInPeriod = 0;
  let previousNewClientsInPeriod = 0;
  let closedInPeriodCount = 0;
  let clientsWithOverdueFinanceCount = 0;
  let clientsWithoutActiveProjectsCount = 0;
  let potentiallyInactiveClientsCount = 0;
  let totalActiveContractedMrr = 0;
  let totalRealizedRevenueFromClientsInPeriodCents = 0;

  const statusCounts = new Map<ClientStatus, number>();
  const rows: ClientPortfolioRow[] = [];

  for (const client of clients) {
    statusCounts.set(client.status, (statusCounts.get(client.status) || 0) + 1);

    if (client.status === 'ativo') {
      activeCount += 1;
      totalActiveContractedMrr += Number(client.monthlyMrr) || 0;
    } else if (client.status === 'onboarding') {
      onboardingCount += 1;
      totalActiveContractedMrr += Number(client.monthlyMrr) || 0;
    } else if (client.status === 'pausado') {
      pausedCount += 1;
    } else if (client.status === 'encerrado') {
      closedCount += 1;
      if (isDateInRange(client.updatedAt, period.startDate, period.endDate, timezone)) {
        closedInPeriodCount += 1;
      }
    }

    if (isDateInRange(client.createdAt, period.startDate, period.endDate, timezone)) {
      newClientsInPeriod += 1;
    }
    if (
      isDateInRange(
        client.createdAt,
        period.previousStartDate,
        period.previousEndDate,
        timezone
      )
    ) {
      previousNewClientsInPeriod += 1;
    }

    registerActivity(client.id, client.updatedAt || client.createdAt);
    if (Array.isArray(client.timeline)) {
      for (const evt of client.timeline) {
        registerActivity(client.id, evt.date);
      }
    }

    const realizedPeriodCents = revPeriodCentsByClient.get(client.id) || 0;
    const realizedTotalCents = revTotalCentsByClient.get(client.id) || 0;
    const openRecCents = openReceivablesByClient.get(client.id) || 0;
    const overdueRecCents = overdueReceivablesByClient.get(client.id) || 0;
    const activeProj = projActiveByClient.get(client.id) || 0;
    const completedProj = projCompletedByClient.get(client.id) || 0;
    const openTasks = tasksOpenByClient.get(client.id) || 0;
    const overdueTasks = tasksOverdueByClient.get(client.id) || 0;

    totalRealizedRevenueFromClientsInPeriodCents += realizedPeriodCents;

    if (overdueRecCents > 0) clientsWithOverdueFinanceCount += 1;
    if ((client.status === 'ativo' || client.status === 'onboarding') && activeProj === 0) {
      clientsWithoutActiveProjectsCount += 1;
    }

    const lastActivityYmd = latestActivityByClient.get(client.id) || null;
    const daysSinceLastActivity = lastActivityYmd
      ? Math.max(0, diffDaysYmd(todayStr, lastActivityYmd))
      : null;

    const isPotentiallyInactive =
      (client.status === 'ativo' || client.status === 'onboarding') &&
      daysSinceLastActivity !== null &&
      daysSinceLastActivity >= 21 &&
      activeProj === 0 &&
      openTasks === 0;

    if (isPotentiallyInactive) potentiallyInactiveClientsCount += 1;

    rows.push({
      clientId: client.id,
      companyName: client.companyName,
      contactName: client.contactName,
      city: client.city,
      status: client.status,
      statusLabel: getClientStatusMeta(client.status).label,
      monthlyMrr: Number(client.monthlyMrr) || 0,
      activeContractsCount: contractsByClient.get(client.id) || 0,
      realizedRevenueInPeriodCents: realizedPeriodCents,
      realizedRevenueAllTimeCents: realizedTotalCents,
      openReceivablesCents: openRecCents,
      overdueReceivablesCents: overdueRecCents,
      activeProjectsCount: activeProj,
      completedProjectsCount: completedProj,
      openTasksCount: openTasks,
      overdueTasksCount: overdueTasks,
      lastActivityYmd,
      daysSinceLastActivity,
      isPotentiallyInactive,
    });
  }

  rows.sort((a, b) => {
    if (b.realizedRevenueInPeriodCents !== a.realizedRevenueInPeriodCents) {
      return b.realizedRevenueInPeriodCents - a.realizedRevenueInPeriodCents;
    }
    if (b.monthlyMrr !== a.monthlyMrr) return b.monthlyMrr - a.monthlyMrr;
    return a.companyName.localeCompare(b.companyName, 'pt-BR');
  });

  const topClientsByRevenue = rows
    .filter((r) => r.realizedRevenueInPeriodCents > 0 || r.monthlyMrr > 0)
    .slice(0, 8);

  const inactiveAlertRows = rows
    .filter((r) => r.isPotentiallyInactive)
    .sort((a, b) => (b.daysSinceLastActivity || 0) - (a.daysSinceLastActivity || 0));

  const byStatus: { status: ClientStatus; label: string; count: number }[] = (
    ['ativo', 'onboarding', 'pausado', 'encerrado'] as ClientStatus[]
  ).map((st) => ({
    status: st,
    label: getClientStatusMeta(st).label,
    count: statusCounts.get(st) || 0,
  }));

  return {
    period,
    totalClients: clients.length,
    activeCount,
    onboardingCount,
    pausedCount,
    closedCount,
    newClientsInPeriod,
    previousNewClientsInPeriod,
    closedInPeriodCount,
    clientsWithOverdueFinanceCount,
    clientsWithoutActiveProjectsCount,
    potentiallyInactiveClientsCount,
    totalActiveContractedMrr,
    totalRealizedRevenueFromClientsInPeriodCents,
    byStatus,
    rows,
    topClientsByRevenue,
    inactiveAlertRows,
    dataLimitationsNote:
      'A detecção de clientes possivelmente inativos considera exclusivamente registros reais de projetos, tarefas, financeiro, agenda e histórico do cliente (mínimo de 21 dias sem movimentação).',
  };
}
