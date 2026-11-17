import { Lead } from '../types/crm';
import {
  AgendaEvent,
  AgendaEventType,
  Client,
  Project,
  Task,
} from '../types/kaizen';
import { getTodayIsoDate } from './projectService';

export type IntegratedAgendaSourceKind =
  | 'agenda_event'
  | 'project_deadline'
  | 'task_deadline'
  | 'lead_meeting'
  | 'lead_callback';

export interface IntegratedAgendaItem {
  id: string;
  sourceKind: IntegratedAgendaSourceKind;
  sourceId: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  type: AgendaEventType;
  statusLabel: string;
  isCompleted: boolean;
  isCancelled: boolean;
  isOverdue: boolean;
  clientId?: string;
  clientName?: string;
  leadId?: string;
  leadName?: string;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  meetingLink?: string;
  notes?: string;
  editableAsAgendaEvent: boolean;
  rawEvent?: AgendaEvent;
  rawProject?: Project;
  rawTask?: Task;
  rawLead?: Lead;
}

export const GOOGLE_CALENDAR_OAUTH_ARCHITECTURE = {
  provider: 'google_calendar' as const,
  oauthConfigured: false,
  statusLabel: 'Arquitetura preparada · OAuth Google Calendar não conectado',
  description:
    'A estrutura de eventos possui metadados preparados para futura sincronização bidirecional via OAuth 2.0. Enquanto isso, eventos individuais podem ser abertos como rascunho manual no Google Calendar sem sincronização automática.',
};

export function generateAgendaEventId(): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `evt-${Date.now()}-${rand}`;
}

export function buildGoogleCalendarTemplateUrl(params: {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  meetingLink?: string;
}): string {
  const dateCompact = (params.date || getTodayIsoDate()).replace(/-/g, '');
  const startClean = (params.startTime || '09:00').replace(':', '');
  let endClean = (params.endTime || '').replace(':', '');
  if (!endClean) {
    const startHour = Number((params.startTime || '09:00').split(':')[0] || 9);
    const startMin = (params.startTime || '09:00').split(':')[1] || '00';
    endClean = `${String((startHour + 1) % 24).padStart(2, '0')}${startMin}`;
  }
  const startIso = `${dateCompact}T${startClean}00`;
  const endIso = `${dateCompact}T${endClean}00`;

  const title = encodeURIComponent(params.title);
  const details = encodeURIComponent(
    [params.description, params.meetingLink ? `Link: ${params.meetingLink}` : '']
      .filter(Boolean)
      .join('\n\n')
  );
  const location = encodeURIComponent(params.meetingLink || '');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
}

/**
 * Unifies CRM meetings/callbacks, Project deadlines, Task dueDates, and standalone AgendaEvents
 * into a canonical non-duplicated agenda feed linked strictly to each original source record.
 */
export function buildIntegratedAgendaItems(params: {
  events: AgendaEvent[];
  projects: Project[];
  tasks: Task[];
  leads: Lead[];
  clients: Client[];
  todayStr?: string;
}): IntegratedAgendaItem[] {
  const todayStr = params.todayStr || getTodayIsoDate();
  const clientById = new Map(params.clients.map((c) => [c.id, c]));
  const projectById = new Map(params.projects.map((p) => [p.id, p]));
  const leadById = new Map(params.leads.map((l) => [l.id, l]));

  const items: IntegratedAgendaItem[] = [];

  // 1. Standalone Agenda Events (reuniões com clientes, lembretes, compromissos internos, etc.)
  for (const evt of params.events) {
    const client = evt.clientId ? clientById.get(evt.clientId) : undefined;
    const project = evt.projectId ? projectById.get(evt.projectId) : undefined;
    const lead = evt.leadId ? leadById.get(evt.leadId) : undefined;
    const isCompleted = evt.status === 'concluido';
    const isCancelled = evt.status === 'cancelado';
    const isOverdue = !isCompleted && !isCancelled && evt.date < todayStr;

    items.push({
      id: `src-evt-${evt.id}`,
      sourceKind: 'agenda_event',
      sourceId: evt.id,
      title: evt.title,
      description: evt.description,
      date: evt.date,
      startTime: evt.startTime,
      endTime: evt.endTime,
      type: evt.type,
      statusLabel:
        evt.status === 'concluido'
          ? 'Concluído'
          : evt.status === 'cancelado'
          ? 'Cancelado'
          : isOverdue
          ? 'Pendente / Atrasado'
          : 'Agendado',
      isCompleted,
      isCancelled,
      isOverdue,
      clientId: evt.clientId,
      clientName: client?.companyName,
      leadId: evt.leadId,
      leadName: lead?.companyName,
      projectId: evt.projectId,
      projectName: project?.name,
      taskId: evt.taskId,
      meetingLink: evt.meetingLink,
      notes: evt.notes,
      editableAsAgendaEvent: true,
      rawEvent: evt,
      rawProject: project,
      rawLead: lead,
    });
  }

  // 2. Project Delivery Deadlines (from Project.dueDate directly — zero duplication)
  for (const project of params.projects) {
    if (!project.dueDate || project.status === 'cancelado') continue;
    const client = clientById.get(project.clientId);
    const isCompleted = project.status === 'concluido';
    const isOverdue = !isCompleted && project.dueDate < todayStr;

    items.push({
      id: `src-proj-${project.id}`,
      sourceKind: 'project_deadline',
      sourceId: project.id,
      title: `Entrega: ${project.name}`,
      description: project.serviceType,
      date: project.dueDate,
      type: 'prazo_entrega',
      statusLabel: isCompleted
        ? 'Projeto Concluído'
        : isOverdue
        ? 'Entrega em Atraso'
        : 'Prazo de Projeto',
      isCompleted,
      isCancelled: false,
      isOverdue,
      clientId: project.clientId,
      clientName: client?.companyName,
      projectId: project.id,
      projectName: project.name,
      notes: project.notes,
      editableAsAgendaEvent: false,
      rawProject: project,
    });
  }

  // 3. Task Deadlines (from Task.dueDate directly — single source of truth)
  for (const task of params.tasks) {
    if (!task.dueDate) continue;
    const project = task.projectId ? projectById.get(task.projectId) : undefined;
    const resolvedClientId = task.clientId || project?.clientId;
    const client = resolvedClientId ? clientById.get(resolvedClientId) : undefined;
    const isCompleted = task.status === 'concluida';
    const isOverdue = !isCompleted && task.dueDate < todayStr;

    items.push({
      id: `src-task-${task.id}`,
      sourceKind: 'task_deadline',
      sourceId: task.id,
      title: task.title,
      description: project ? `Projeto: ${project.name}` : task.description,
      date: task.dueDate,
      type: 'tarefa',
      statusLabel: isCompleted
        ? 'Tarefa Concluída'
        : isOverdue
        ? 'Tarefa Atrasada'
        : 'Prazo de Tarefa',
      isCompleted,
      isCancelled: false,
      isOverdue,
      clientId: resolvedClientId,
      clientName: client?.companyName,
      projectId: task.projectId,
      projectName: project?.name,
      taskId: task.id,
      notes: task.notes,
      editableAsAgendaEvent: false,
      rawTask: task,
      rawProject: project,
    });
  }

  // 4. CRM Lead Meetings & Callbacks (directly from Lead records)
  for (const lead of params.leads) {
    if (lead.stage === 'reuniao_marcada' || lead.meetingDate) {
      if (lead.meetingDate) {
        const isCompleted = lead.meetingStatus === 'realizada';
        const isCancelled = lead.meetingStatus === 'cancelada';
        const isOverdue = !isCompleted && !isCancelled && lead.meetingDate < todayStr;
        items.push({
          id: `src-lead-meet-${lead.id}`,
          sourceKind: 'lead_meeting',
          sourceId: lead.id,
          title: `Reunião Comercial: ${lead.companyName}`,
          description: lead.meetingNotes || lead.contactName || 'Apresentação comercial CRM',
          date: lead.meetingDate,
          startTime: lead.meetingTime || '10:00',
          type: 'reuniao_comercial',
          statusLabel: isCompleted
            ? 'Realizada'
            : isCancelled
            ? 'Cancelada'
            : isOverdue
            ? 'Reunião Pendente'
            : 'Agendada no CRM',
          isCompleted,
          isCancelled,
          isOverdue,
          leadId: lead.id,
          leadName: lead.companyName,
          meetingLink: lead.meetingLink,
          notes: lead.meetingNotes,
          editableAsAgendaEvent: false,
          rawLead: lead,
        });
      }
    }

    if (lead.callbackDate) {
      const isCompleted = lead.callbackStatus === 'realizado';
      const isCancelled = lead.callbackStatus === 'cancelado';
      const isOverdue = !isCompleted && !isCancelled && lead.callbackDate < todayStr;
      items.push({
        id: `src-lead-cb-${lead.id}`,
        sourceKind: 'lead_callback',
        sourceId: lead.id,
        title: `Retorno Comercial: ${lead.companyName}`,
        description: lead.callbackNotes || 'Lead solicitou contato em outro horário',
        date: lead.callbackDate,
        startTime: lead.callbackTime,
        type: 'lembrete',
        statusLabel: isCompleted
          ? 'Retorno Realizado'
          : isCancelled
          ? 'Cancelado'
          : isOverdue
          ? 'Retorno Atrasado'
          : 'Retorno Agendado',
        isCompleted,
        isCancelled,
        isOverdue,
        leadId: lead.id,
        leadName: lead.companyName,
        notes: lead.callbackNotes,
        editableAsAgendaEvent: false,
        rawLead: lead,
      });
    }
  }

  return items.sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff !== 0) return dateDiff;
    const tA = a.startTime || '99:99';
    const tB = b.startTime || '99:99';
    return tA.localeCompare(tB);
  });
}

export function getWeekDatesForDate(anchorDateStr: string): string[] {
  const anchor = new Date(`${anchorDateStr}T12:00:00`);
  if (Number.isNaN(anchor.getTime())) return [anchorDateStr];
  const dayOfWeek = anchor.getDay(); // 0 (Dom) .. 6 (Sab)
  const sunday = new Date(anchor);
  sunday.setDate(anchor.getDate() - dayOfWeek);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}
