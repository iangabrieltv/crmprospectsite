import { Lead, normalizeStageId } from '../types/crm';
import { Client } from '../types/kaizen';
import { FinancialEntry, FinancialTransaction } from '../types/finance';
import { isInactiveOver48h } from './phone';
import { getTransactionSignedCashCents } from '../services/finance/cashFlowService';
import { getEffectiveEntryStatus, getEntryPendingCents } from '../services/finance/entriesService';

export interface DashboardKpiSummary {
  contactedToday: number;
  totalContacted: number;
  interestedLeads: number;
  scheduledMeetings: number;
  closedDeals: number;
  activeClientsConfigured: boolean;
  activeClientsCount: number | null;
  onboardingClientsCount: number;
  activeClientsMrr: number;
  monthlyRevenueMrr: number;
  totalSetupRevenue: number;
  financialModuleConfigured: boolean;
  monthlyRealizedRevenueCents: number;
  openReceivablesCents: number;
  overdueReceivablesCount: number;
  pendingFollowUps: number;
  pendingCallbacksToday: number;
  pendingCallbacksOverdue: number;
  inactiveOver48hCount: number;
  responseRatePercent: string;
}

export interface PendingActivityItem {
  id: string;
  lead: Lead;
  kind: 'callback_overdue' | 'callback_today' | 'callback_upcoming' | 'inactive_48h';
  title: string;
  subtitle: string;
  dateLabel?: string;
}

export interface UpcomingMeetingItem {
  id: string;
  lead: Lead;
  date: string;
  time: string;
  status: string;
  notes?: string;
  link?: string;
  isToday: boolean;
  isOverdue: boolean;
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(isoOrDateStr: string | undefined, todayLocalStr: string): boolean {
  if (!isoOrDateStr) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDateStr)) {
    return isoOrDateStr === todayLocalStr;
  }
  const parsed = new Date(isoOrDateStr);
  if (isNaN(parsed.getTime())) return false;
  return toLocalDateString(parsed) === todayLocalStr;
}

export function computeDashboardMetrics(
  leads: Lead[],
  referenceDate: Date = new Date(),
  clients?: Client[],
  financialEntries?: FinancialEntry[],
  financialTransactions?: FinancialTransaction[]
): {
  kpis: DashboardKpiSummary;
  pendingActivities: PendingActivityItem[];
  upcomingMeetings: UpcomingMeetingItem[];
} {
  const todayStr = toLocalDateString(referenceDate);

  let contactedToday = 0;
  let totalContacted = 0;
  let interestedLeads = 0;
  let scheduledMeetings = 0;
  let closedDeals = 0;
  let unconvertedCrmMrr = 0;
  let totalSetupRevenue = 0;
  let pendingFollowUps = 0;
  let pendingCallbacksToday = 0;
  let pendingCallbacksOverdue = 0;
  let inactiveOver48hCount = 0;
  let respondedCount = 0;

  const convertedLeadIds = new Set(
    (clients || []).map((c) => c.originLeadId).filter((id): id is string => Boolean(id))
  );

  const pendingActivities: PendingActivityItem[] = [];
  const upcomingMeetings: UpcomingMeetingItem[] = [];

  for (const lead of leads) {
    const stage = normalizeStageId(lead.stage);
    const hasContact = stage !== 'leads_sem_contato' || Boolean(lead.lastContactDate);

    if (hasContact) {
      totalContacted += 1;
    }

    if (isSameLocalDay(lead.lastContactDate, todayStr)) {
      contactedToday += 1;
    }

    if (
      stage === 'follow_up_1' ||
      stage === 'follow_up_2' ||
      stage === 'reuniao_marcada' ||
      lead.stage === 'interessado'
    ) {
      interestedLeads += 1;
    }

    if (
      stage === 'follow_up_1' ||
      stage === 'follow_up_2' ||
      stage === 'reuniao_marcada' ||
      stage === 'fechado' ||
      lead.stage === 'interessado'
    ) {
      respondedCount += 1;
    }

    const hasActiveMeeting =
      Boolean(lead.meetingDate) &&
      lead.meetingStatus !== 'cancelada' &&
      lead.meetingStatus !== 'realizada';

    if (stage === 'reuniao_marcada' || hasActiveMeeting) {
      scheduledMeetings += 1;
    }

    if (lead.meetingDate && lead.meetingStatus !== 'cancelada' && lead.meetingStatus !== 'realizada') {
      upcomingMeetings.push({
        id: lead.id,
        lead,
        date: lead.meetingDate,
        time: lead.meetingTime || '09:00',
        status: lead.meetingStatus || 'agendada',
        notes: lead.meetingNotes,
        link: lead.meetingLink,
        isToday: lead.meetingDate === todayStr,
        isOverdue: lead.meetingDate < todayStr,
      });
    }

    if (stage === 'fechado') {
      closedDeals += 1;
      if (!convertedLeadIds.has(lead.id)) {
        unconvertedCrmMrr += lead.monthlyMrr || 0;
      }
      totalSetupRevenue += lead.creationValue || 0;
    }

    const hasPendingCallback =
      Boolean(lead.callbackDate) &&
      lead.callbackStatus !== 'realizado' &&
      lead.callbackStatus !== 'cancelado';

    if (hasPendingCallback && lead.callbackDate) {
      if (lead.callbackDate < todayStr) {
        pendingCallbacksOverdue += 1;
        pendingActivities.push({
          id: `cb-${lead.id}`,
          lead,
          kind: 'callback_overdue',
          title: `Retorno atrasado: ${lead.companyName}`,
          subtitle: lead.callbackNotes || 'Lead aguardando retorno agendado.',
          dateLabel: `${lead.callbackDate.split('-').reverse().join('/')}${
            lead.callbackTime ? ` às ${lead.callbackTime}` : ''
          }`,
        });
      } else if (lead.callbackDate === todayStr) {
        pendingCallbacksToday += 1;
        pendingActivities.push({
          id: `cb-${lead.id}`,
          lead,
          kind: 'callback_today',
          title: `Retorno hoje: ${lead.companyName}`,
          subtitle: lead.callbackNotes || 'Retorno comercial previsto para hoje.',
          dateLabel: lead.callbackTime ? `Hoje às ${lead.callbackTime}` : 'Hoje',
        });
      } else {
        pendingActivities.push({
          id: `cb-${lead.id}`,
          lead,
          kind: 'callback_upcoming',
          title: `Retorno agendado: ${lead.companyName}`,
          subtitle: lead.callbackNotes || 'Retorno futuro programado.',
          dateLabel: `${lead.callbackDate.split('-').reverse().join('/')}${
            lead.callbackTime ? ` às ${lead.callbackTime}` : ''
          }`,
        });
      }
    }

    const isInFollowUpStage = stage === 'follow_up_1' || stage === 'follow_up_2';
    const inactive =
      stage !== 'fechado' &&
      stage !== 'leads_sem_contato' &&
      isInactiveOver48h(lead.lastContactDate, lead.createdAt);

    if (inactive) {
      inactiveOver48hCount += 1;
      if (!hasPendingCallback) {
        pendingActivities.push({
          id: `inact-${lead.id}`,
          lead,
          kind: 'inactive_48h',
          title: `Sem resposta +48h: ${lead.companyName}`,
          subtitle: 'Lead em andamento sem atualização há mais de 48 horas.',
          dateLabel: lead.city || undefined,
        });
      }
    }

    if (hasPendingCallback || isInFollowUpStage) {
      pendingFollowUps += 1;
    }
  }

  const kindPriority: Record<PendingActivityItem['kind'], number> = {
    callback_overdue: 0,
    callback_today: 1,
    inactive_48h: 2,
    callback_upcoming: 3,
  };

  pendingActivities.sort((a, b) => kindPriority[a.kind] - kindPriority[b.kind]);
  upcomingMeetings.sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  );

  const responseRatePercent =
    totalContacted > 0 ? ((respondedCount / totalContacted) * 100).toFixed(1) : '0.0';

  const activeClientsConfigured = Array.isArray(clients);
  let activeClientsCount: number | null = null;
  let onboardingClientsCount = 0;
  let activeClientsMrr = 0;

  if (Array.isArray(clients)) {
    activeClientsCount = clients.filter((c) => c.status === 'ativo').length;
    onboardingClientsCount = clients.filter((c) => c.status === 'onboarding').length;
    activeClientsMrr = clients
      .filter((c) => c.status === 'ativo' || c.status === 'onboarding')
      .reduce((sum, c) => sum + (c.monthlyMrr || 0), 0);
  }

  const monthlyRevenueMrr = activeClientsMrr + unconvertedCrmMrr;
  const currentMonthPrefix = todayStr.slice(0, 7);

  let monthlyRealizedRevenueCents = 0;
  for (const tx of financialTransactions || []) {
    if (
      tx.entryKind === 'receita' &&
      tx.date.startsWith(currentMonthPrefix)
    ) {
      const signed = getTransactionSignedCashCents(tx);
      monthlyRealizedRevenueCents += signed.inflowCents - signed.outflowCents;
    }
  }

  let openReceivablesCents = 0;
  let overdueReceivablesCount = 0;
  for (const entry of financialEntries || []) {
    if (entry.kind !== 'receita') continue;
    const pending = getEntryPendingCents(entry);
    if (pending > 0) {
      openReceivablesCents += pending;
      if (getEffectiveEntryStatus(entry, todayStr) === 'atrasada') {
        overdueReceivablesCount += 1;
      }
    }
  }

  return {
    kpis: {
      contactedToday,
      totalContacted,
      interestedLeads,
      scheduledMeetings,
      closedDeals,
      activeClientsConfigured,
      activeClientsCount,
      onboardingClientsCount,
      activeClientsMrr,
      monthlyRevenueMrr,
      totalSetupRevenue,
      financialModuleConfigured: true,
      monthlyRealizedRevenueCents,
      openReceivablesCents,
      overdueReceivablesCount,
      pendingFollowUps,
      pendingCallbacksToday,
      pendingCallbacksOverdue,
      inactiveOver48hCount,
      responseRatePercent,
    },
    pendingActivities,
    upcomingMeetings,
  };
}
