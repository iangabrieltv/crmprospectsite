import { Lead } from '../../types/crm';
import { AgendaEvent, Project, ProposalContract, Task } from '../../types/kaizen';
import { FinancialEntry } from '../../types/finance';
import {
  NotificationCategory,
  NotificationSeverity,
  SystemNotification,
  SystemSettings,
} from '../../types/system';
import {
  KAIZEN_TIMEZONE,
  addDaysYmd,
  formatBrlFromCents,
  formatDateBr,
  getEffectiveEntryStatus,
  getEntryPendingCents,
  getTodayInTimezone,
} from '../finance';
import { normalizeSystemSettings } from './settingsService';

function sanitizeNotificationId(eventKey: string): string {
  const slug = eventKey
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);
  return `ntf-${slug || Date.now()}`;
}

function diffDaysYmd(olderYmd: string, newerYmd: string): number {
  const [y1, m1, d1] = olderYmd.split('-').map(Number);
  const [y2, m2, d2] = newerYmd.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((utc2 - utc1) / (24 * 60 * 60 * 1000));
}

function isCategoryEnabled(
  category: NotificationCategory,
  settings: SystemSettings
): boolean {
  if (!settings.preferences.enableNotifications) return false;
  switch (category) {
    case 'comercial':
      return settings.preferences.notifyComercial;
    case 'operacional':
      return settings.preferences.notifyOperacional;
    case 'financeiro':
      return settings.preferences.notifyFinanceiro;
    case 'agenda':
      return settings.preferences.notifyAgenda;
    default:
      return true;
  }
}

interface CandidateNotification {
  eventKey: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  targetTab: SystemNotification['targetTab'];
  entityType: SystemNotification['entityType'];
  entityId?: string;
  dueLabel: string;
}

/**
 * Avalia os registros reais do workspace e gera/atualiza notificações
 * deduplicadas por eventKey, respeitando SystemSettings e preservando
 * estado de leitura/dispensa sem jamais alterar leads, tarefas ou financeiro.
 */
export function evaluateWorkspaceNotifications(params: {
  leads: Lead[];
  proposals: ProposalContract[];
  projects: Project[];
  tasks: Task[];
  agendaEvents: AgendaEvent[];
  financialEntries: FinancialEntry[];
  existingNotifications: SystemNotification[];
  settings?: SystemSettings | null;
  financialAlertDaysAhead?: number;
  todayStr?: string;
  nowIso?: string;
}): {
  notifications: SystemNotification[];
  changedNotifications: SystemNotification[];
} {
  const settings = normalizeSystemSettings(params.settings);
  const todayStr = params.todayStr || getTodayInTimezone(KAIZEN_TIMEZONE);
  const nowIso = params.nowIso || new Date().toISOString();
  const alertDays = Math.max(0, params.financialAlertDaysAhead ?? 5);
  const finHorizonStr = addDaysYmd(todayStr, alertDays);
  const taskHorizonStr = addDaysYmd(todayStr, 1);

  const existingByKey = new Map<string, SystemNotification>();
  for (const n of params.existingNotifications) {
    existingByKey.set(n.eventKey, n);
  }

  const candidates: CandidateNotification[] = [];

  // 1. Comercial / Agenda — Retornos (callbacks) e Reuniões de Leads
  for (const lead of params.leads) {
    if (
      lead.callbackDate &&
      lead.callbackDate <= todayStr &&
      lead.callbackStatus !== 'realizado' &&
      lead.callbackStatus !== 'cancelado'
    ) {
      const overdue = lead.callbackDate < todayStr;
      candidates.push({
        eventKey: `cb-${lead.id}-${lead.callbackDate}`,
        category: 'agenda',
        severity: overdue ? 'danger' : 'warning',
        title: `Retorno comercial: ${lead.companyName}`,
        message: lead.callbackNotes || 'Lead aguardando retorno comercial agendado.',
        targetTab: 'agenda',
        entityType: 'lead',
        entityId: lead.id,
        dueLabel: overdue
          ? `Atrasado (${formatDateBr(lead.callbackDate)})`
          : lead.callbackTime
          ? `Hoje às ${lead.callbackTime}`
          : 'Hoje',
      });
    }

    if (
      lead.meetingDate &&
      lead.meetingDate <= todayStr &&
      lead.meetingStatus !== 'realizada' &&
      lead.meetingStatus !== 'cancelada'
    ) {
      const overdue = lead.meetingDate < todayStr;
      candidates.push({
        eventKey: `mt-${lead.id}-${lead.meetingDate}`,
        category: 'agenda',
        severity: overdue ? 'danger' : 'warning',
        title: `Reunião comercial: ${lead.companyName}`,
        message: lead.meetingNotes || 'Reunião comercial registrada no funil.',
        targetTab: 'agenda',
        entityType: 'lead',
        entityId: lead.id,
        dueLabel: overdue
          ? `Pendente (${formatDateBr(lead.meetingDate)})`
          : lead.meetingTime
          ? `Hoje às ${lead.meetingTime}`
          : 'Hoje',
      });
    }

    if (
      lead.stage !== 'fechado' &&
      lead.stage !== 'leads_sem_contato' &&
      lead.stage !== 'nao_interessado'
    ) {
      const refIso = lead.lastContactDate || lead.createdAt;
      const refYmd = refIso ? refIso.slice(0, 10) : '';
      if (refYmd && diffDaysYmd(refYmd, todayStr) >= 3) {
        candidates.push({
          eventKey: `lead-stale-${lead.id}-${refYmd}`,
          category: 'comercial',
          severity: 'warning',
          title: `Lead sem follow-up recente: ${lead.companyName}`,
          message: `Última movimentação registrada em ${formatDateBr(refYmd)} (${diffDaysYmd(
            refYmd,
            todayStr
          )} dias atrás).`,
          targetTab: 'kanban',
          entityType: 'lead',
          entityId: lead.id,
          dueLabel: `${diffDaysYmd(refYmd, todayStr)}d sem contato`,
        });
      }
    }
  }

  // 2. Comercial — Propostas enviadas sem acompanhamento >= 5 dias
  for (const prop of params.proposals) {
    if (prop.status === 'enviada' || prop.status === 'em_negociacao') {
      const refIso = prop.sentAt || prop.updatedAt || prop.createdAt;
      const refYmd = refIso ? refIso.slice(0, 10) : '';
      if (refYmd && diffDaysYmd(refYmd, todayStr) >= 5) {
        candidates.push({
          eventKey: `prop-pending-${prop.id}-${refYmd}`,
          category: 'comercial',
          severity: 'warning',
          title: `Proposta em aberto: ${prop.code}`,
          message: `${prop.recipientCompany} — "${prop.title}" sem retorno há ${diffDaysYmd(
            refYmd,
            todayStr
          )} dias.`,
          targetTab: 'proposals',
          entityType: 'proposal',
          entityId: prop.id,
          dueLabel: `${diffDaysYmd(refYmd, todayStr)}d aguardando`,
        });
      }
    }
  }

  // 3. Agenda Integrada — Eventos do dia ou pendentes
  for (const evt of params.agendaEvents) {
    if (evt.status === 'agendado' && evt.date <= todayStr) {
      const overdue = evt.date < todayStr;
      candidates.push({
        eventKey: `evt-${evt.id}-${evt.date}`,
        category: 'agenda',
        severity: overdue ? 'danger' : 'info',
        title: evt.title,
        message: evt.description || 'Compromisso cadastrado na Agenda Integrada.',
        targetTab: 'agenda',
        entityType: 'agenda',
        entityId: evt.id,
        dueLabel: overdue
          ? `Pendente (${formatDateBr(evt.date)})`
          : evt.startTime
          ? `Hoje às ${evt.startTime}`
          : 'Hoje',
      });
    }
  }

  // 4. Operacional — Tarefas vencidas, de hoje ou vencendo amanhã
  for (const task of params.tasks) {
    if (task.status !== 'concluida' && task.dueDate && task.dueDate <= taskHorizonStr) {
      const overdue = task.dueDate < todayStr;
      const dueToday = task.dueDate === todayStr;
      candidates.push({
        eventKey: `tsk-${task.id}-${task.dueDate}`,
        category: 'operacional',
        severity: overdue ? 'danger' : dueToday ? 'warning' : 'info',
        title: task.title,
        message: task.phaseLabel
          ? `Etapa: ${task.phaseLabel}`
          : 'Tarefa operacional aguardando conclusão.',
        targetTab: 'tasks',
        entityType: 'task',
        entityId: task.id,
        dueLabel: overdue
          ? `Atrasada (${formatDateBr(task.dueDate)})`
          : dueToday
          ? 'Vence hoje'
          : `Vence amanhã (${formatDateBr(task.dueDate)})`,
      });
    }
  }

  // 5. Operacional — Projetos com prazo vencido ou próximos do prazo
  for (const project of params.projects) {
    if (
      project.status !== 'concluido' &&
      project.status !== 'cancelado' &&
      project.dueDate &&
      project.dueDate <= addDaysYmd(todayStr, 3)
    ) {
      const overdue = project.dueDate < todayStr;
      candidates.push({
        eventKey: `proj-${project.id}-${project.dueDate}`,
        category: 'operacional',
        severity: overdue ? 'danger' : 'warning',
        title: `Prazo de projeto: ${project.name}`,
        message: overdue
          ? 'Projeto ultrapassou o prazo de entrega configurado.'
          : 'Projeto com entrega prevista nos próximos 3 dias.',
        targetTab: 'projects',
        entityType: 'project',
        entityId: project.id,
        dueLabel: overdue
          ? `Prazo vencido (${formatDateBr(project.dueDate)})`
          : `Entrega em ${formatDateBr(project.dueDate)}`,
      });
    }
  }

  // 6. Financeiro — Contas a receber e a pagar vencidas ou próximas
  for (const entry of params.financialEntries) {
    const pendingCents = getEntryPendingCents(entry);
    if (pendingCents <= 0) continue;
    const effStatus = getEffectiveEntryStatus(entry, todayStr);
    if (effStatus !== 'atrasada' && entry.dueDate > finHorizonStr) continue;
    const isOverdue = effStatus === 'atrasada';
    const isDueToday = entry.dueDate === todayStr;
    candidates.push({
      eventKey: `fin-${entry.id}-${entry.dueDate}`,
      category: 'financeiro',
      severity: isOverdue ? 'danger' : isDueToday ? 'warning' : 'info',
      title: entry.description,
      message: `${
        entry.kind === 'receita' ? 'A receber' : 'A pagar'
      } · ${formatBrlFromCents(pendingCents)}`,
      targetTab: 'finance',
      entityType: 'finance',
      entityId: entry.id,
      dueLabel: isOverdue
        ? `Vencida em ${formatDateBr(entry.dueDate)}`
        : isDueToday
        ? 'Vence hoje'
        : `Vence em ${formatDateBr(entry.dueDate)}`,
    });
  }

  const seenKeys = new Set<string>();
  const resultMap = new Map<string, SystemNotification>();
  for (const existing of params.existingNotifications) {
    resultMap.set(existing.eventKey, existing);
  }
  const changedNotifications: SystemNotification[] = [];

  for (const cand of candidates) {
    if (!isCategoryEnabled(cand.category, settings)) continue;
    if (seenKeys.has(cand.eventKey)) continue;
    seenKeys.add(cand.eventKey);

    const existing = existingByKey.get(cand.eventKey);
    if (existing) {
      if (
        existing.title !== cand.title ||
        existing.message !== cand.message ||
        existing.dueLabel !== cand.dueLabel ||
        existing.severity !== cand.severity
      ) {
        const updated: SystemNotification = {
          ...existing,
          title: cand.title,
          message: cand.message,
          dueLabel: cand.dueLabel,
          severity: cand.severity,
          updatedAt: nowIso,
        };
        resultMap.set(cand.eventKey, updated);
        changedNotifications.push(updated);
      }
    } else {
      const created: SystemNotification = {
        id: sanitizeNotificationId(cand.eventKey),
        eventKey: cand.eventKey,
        category: cand.category,
        severity: cand.severity,
        title: cand.title,
        message: cand.message,
        targetTab: cand.targetTab,
        entityType: cand.entityType,
        entityId: cand.entityId,
        dueLabel: cand.dueLabel,
        read: false,
        dismissed: false,
        createdAt: nowIso,
        schemaVersion: 1,
        updatedAt: nowIso,
      };
      resultMap.set(cand.eventKey, created);
      changedNotifications.push(created);
    }
  }

  const notifications = Array.from(resultMap.values())
    .filter((n) => !n.dismissed && isCategoryEnabled(n.category, settings))
    .sort((a, b) => {
      if (a.read !== b.read) return Number(a.read) - Number(b.read);
      const sevWeight = { danger: 3, warning: 2, info: 1 };
      const diff = sevWeight[b.severity] - sevWeight[a.severity];
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return { notifications, changedNotifications };
}
