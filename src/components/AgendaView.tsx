import React, { useEffect, useMemo, useState } from 'react';
import { AppTab, FunnelStageId, Lead, NicheCampaign } from '../types/crm';
import {
  AGENDA_EVENT_TYPE_OPTIONS,
  AgendaEvent,
  AgendaEventType,
  Client,
  Project,
  Task,
  getAgendaEventTypeMeta,
} from '../types/kaizen';
import {
  GOOGLE_CALENDAR_OAUTH_ARCHITECTURE,
  IntegratedAgendaItem,
  IntegratedAgendaSourceKind,
  buildGoogleCalendarTemplateUrl,
  buildIntegratedAgendaItems,
  getWeekDatesForDate,
} from '../services/agendaService';
import { getTodayIsoDate } from '../services/projectService';
import { buildWhatsAppLink, formatDisplayPhone } from '../utils/phone';
import { AgendaEventModal } from './AgendaEventModal';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Tabs,
} from './ui';
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  Bookmark,
  Calendar as CalendarIcon,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Edit3,
  ExternalLink,
  FileText,
  FolderKanban,
  ListOrdered,
  MessageCircle,
  PhoneCall,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';

interface AgendaViewProps {
  niche: NicheCampaign;
  leads: Lead[];
  allLeads?: Lead[];
  clients?: Client[];
  projects?: Project[];
  tasks?: Task[];
  agendaEvents?: AgendaEvent[];
  userName: string;
  cloudPermissionBlocked?: boolean;
  initialLeadIdToEdit?: string | null;
  onClearInitialLeadToEdit?: () => void;
  initialNewEventClientId?: string | null;
  onClearInitialNewEventClientId?: () => void;
  onUpdateLead: (updatedLead: Lead) => void;
  onMoveStage: (leadId: string, targetStage: FunnelStageId) => void;
  onOpenLeadModal: (lead: Lead) => void;
  onSaveAgendaEvent?: (
    event: AgendaEvent,
    mode: 'create' | 'edit'
  ) => Promise<void> | void;
  onDeleteAgendaEvent?: (eventId: string) => Promise<void> | void;
  onOpenProject?: (projectId: string) => void;
  onOpenClient?: (clientId: string) => void;
  onNavigate?: (tab: AppTab) => void;
  onSwitchToKanban: () => void;
}

const WEEKDAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function getSourceBadgeLabel(kind: IntegratedAgendaSourceKind): string {
  switch (kind) {
    case 'agenda_event':
      return 'Agenda';
    case 'project_deadline':
      return 'Projeto';
    case 'task_deadline':
      return 'Tarefa';
    case 'lead_meeting':
      return 'Reunião CRM';
    case 'lead_callback':
      return 'Retorno CRM';
  }
}

export const AgendaView: React.FC<AgendaViewProps> = ({
  niche,
  leads,
  allLeads,
  clients = [],
  projects = [],
  tasks = [],
  agendaEvents = [],
  userName,
  cloudPermissionBlocked = false,
  initialLeadIdToEdit,
  onClearInitialLeadToEdit,
  initialNewEventClientId,
  onClearInitialNewEventClientId,
  onUpdateLead,
  onMoveStage,
  onOpenLeadModal,
  onSaveAgendaEvent,
  onDeleteAgendaEvent,
  onOpenProject,
  onOpenClient,
  onNavigate,
  onSwitchToKanban,
}) => {
  const todayDateString = getTodayIsoDate();

  // Integrated Agenda view & filter state
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [scopeMode, setScopeMode] = useState<'all' | 'niche'>('all');
  const [typeFilter, setTypeFilter] = useState<AgendaEventType | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<IntegratedAgendaSourceKind | 'all'>(
    'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);

  // Calendar cursor & selected day
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayString, setSelectedDayString] = useState<string>(todayDateString);

  // Standalone AgendaEvent modal
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingAgendaEvent, setEditingAgendaEvent] = useState<AgendaEvent | null>(null);
  const [defaultEventClientId, setDefaultEventClientId] = useState<string | undefined>(
    undefined
  );

  // CRM Meeting Editor modal
  const [editingMeetingLead, setEditingMeetingLead] = useState<Lead | null>(null);
  const [editMeetingDate, setEditMeetingDate] = useState('');
  const [editMeetingTime, setEditMeetingTime] = useState('');
  const [editMeetingNotes, setEditMeetingNotes] = useState('');
  const [editMeetingLink, setEditMeetingLink] = useState('');
  const [editMeetingStatus, setEditMeetingStatus] = useState<
    'agendada' | 'realizada' | 'remarcada' | 'cancelada'
  >('agendada');
  const [isQuickPickerOpen, setIsQuickPickerOpen] = useState(false);
  const [quickSearchTerm, setQuickSearchTerm] = useState('');

  // CRM Callback Editor modal
  const [editingCallbackLead, setEditingCallbackLead] = useState<Lead | null>(null);
  const [editCallbackDate, setEditCallbackDate] = useState('');
  const [editCallbackTime, setEditCallbackTime] = useState('15:30');
  const [editCallbackNotes, setEditCallbackNotes] = useState('');
  const [editCallbackStatus, setEditCallbackStatus] = useState<
    'pendente' | 'realizado' | 'cancelado'
  >('pendente');
  const [isCallbackPickerOpen, setIsCallbackPickerOpen] = useState(false);
  const [callbackPickerSearch, setCallbackPickerSearch] = useState('');

  const sourceLeadsPool = scopeMode === 'niche' ? leads : allLeads || leads;

  // Triggered when opening Agenda to edit a specific CRM lead meeting
  useEffect(() => {
    if (initialLeadIdToEdit) {
      const pool = allLeads || leads;
      const found = pool.find((l) => l.id === initialLeadIdToEdit);
      if (found) {
        setEditingMeetingLead(found);
        setEditMeetingDate(found.meetingDate || selectedDayString || todayDateString);
        setEditMeetingTime(found.meetingTime || '10:00');
        setEditMeetingNotes(found.meetingNotes || '');
        setEditMeetingLink(found.meetingLink || '');
        setEditMeetingStatus(found.meetingStatus || 'agendada');
      }
      onClearInitialLeadToEdit?.();
    }
  }, [initialLeadIdToEdit, allLeads, leads, selectedDayString, todayDateString, onClearInitialLeadToEdit]);

  // Triggered from Client Detail ("+ Agendar Reunião")
  useEffect(() => {
    if (initialNewEventClientId) {
      setEditingAgendaEvent(null);
      setDefaultEventClientId(initialNewEventClientId);
      setIsEventModalOpen(true);
      onClearInitialNewEventClientId?.();
    }
  }, [initialNewEventClientId, onClearInitialNewEventClientId]);

  // Unified non-duplicated integrated items
  const allIntegratedItems = useMemo(
    () =>
      buildIntegratedAgendaItems({
        events: agendaEvents,
        projects,
        tasks,
        leads: sourceLeadsPool,
        clients,
        todayStr: todayDateString,
      }),
    [agendaEvents, projects, tasks, sourceLeadsPool, clients, todayDateString]
  );

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allIntegratedItems.filter((item) => {
      if (hideCompleted && (item.isCompleted || item.isCancelled)) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (sourceFilter !== 'all' && item.sourceKind !== sourceFilter) return false;
      if (q) {
        const haystack = [
          item.title,
          item.description || '',
          item.clientName || '',
          item.leadName || '',
          item.projectName || '',
          item.notes || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allIntegratedItems, hideCompleted, typeFilter, sourceFilter, searchTerm]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, IntegratedAgendaItem[]>();
    for (const item of filteredItems) {
      const existing = map.get(item.date) || [];
      existing.push(item);
      map.set(item.date, existing);
    }
    return map;
  }, [filteredItems]);

  const selectedDayItems = useMemo(
    () => itemsByDate.get(selectedDayString) || [],
    [itemsByDate, selectedDayString]
  );

  const summaryStats = useMemo(() => {
    const todayItems = allIntegratedItems.filter(
      (i) => i.date === todayDateString && !i.isCompleted && !i.isCancelled
    ).length;
    const overdueItems = allIntegratedItems.filter((i) => i.isOverdue).length;
    const weekDates = new Set(getWeekDatesForDate(todayDateString));
    const thisWeekItems = allIntegratedItems.filter(
      (i) => weekDates.has(i.date) && !i.isCompleted && !i.isCancelled
    ).length;
    const meetingsCount = allIntegratedItems.filter(
      (i) =>
        (i.type === 'reuniao_cliente' || i.type === 'reuniao_comercial') &&
        !i.isCompleted &&
        !i.isCancelled
    ).length;

    return { todayItems, overdueItems, thisWeekItems, meetingsCount };
  }, [allIntegratedItems, todayDateString]);

  // Pending CRM callbacks for today/overdue urgent strip
  const urgentCallbacks = useMemo(() => {
    return sourceLeadsPool.filter(
      (l) =>
        Boolean(l.callbackDate) &&
        (l.callbackDate as string) <= todayDateString &&
        l.callbackStatus !== 'realizado' &&
        l.callbackStatus !== 'cancelado'
    );
  }, [sourceLeadsPool, todayDateString]);

  const unscheduledMeetingLeads = useMemo(
    () => sourceLeadsPool.filter((l) => l.stage === 'reuniao_marcada' && !l.meetingDate),
    [sourceLeadsPool]
  );

  // Calendar Grid (Month)
  const monthGridCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { dateStr: string; dayNumber: number; inMonth: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      cells.push({ dateStr: `${y}-${m}-${day}`, dayNumber: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const m = String(month + 1).padStart(2, '0');
      const day = String(d).padStart(2, '0');
      cells.push({ dateStr: `${year}-${m}-${day}`, dayNumber: d, inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const nextIndex = cells.length - (startOffset + daysInMonth) + 1;
      const d = new Date(year, month + 1, nextIndex);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      cells.push({ dateStr: `${y}-${m}-${day}`, dayNumber: d.getDate(), inMonth: false });
    }
    return cells;
  }, [currentDate]);

  // Week dates anchored on selectedDayString
  const weekDates = useMemo(
    () => getWeekDatesForDate(selectedDayString),
    [selectedDayString]
  );

  // List of upcoming + overdue items chronologically
  const upcomingAndPendingList = useMemo(() => {
    return filteredItems.filter(
      (i) => i.date >= todayDateString || i.isOverdue
    );
  }, [filteredItems, todayDateString]);

  // Navigation helpers
  const shiftSelectedDate = (daysDelta: number) => {
    const anchor = new Date(`${selectedDayString}T12:00:00`);
    anchor.setDate(anchor.getDate() + daysDelta);
    const y = anchor.getFullYear();
    const m = String(anchor.getMonth() + 1).padStart(2, '0');
    const d = String(anchor.getDate()).padStart(2, '0');
    const nextStr = `${y}-${m}-${d}`;
    setSelectedDayString(nextStr);
    setCurrentDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  };

  const handleGoToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDayString(todayDateString);
  };

  // Item click dispatcher (navigates or opens original source record without duplicating)
  const handleItemAction = (item: IntegratedAgendaItem) => {
    if (item.sourceKind === 'agenda_event' && item.rawEvent) {
      setEditingAgendaEvent(item.rawEvent);
      setDefaultEventClientId(undefined);
      setIsEventModalOpen(true);
      return;
    }
    if (item.sourceKind === 'project_deadline' && item.projectId) {
      if (onOpenProject) {
        onOpenProject(item.projectId);
      } else {
        onNavigate?.('projects');
      }
      return;
    }
    if (item.sourceKind === 'task_deadline') {
      onNavigate?.('tasks');
      return;
    }
    if (item.sourceKind === 'lead_meeting' && item.rawLead) {
      handleOpenMeetingEditor(item.rawLead);
      return;
    }
    if (item.sourceKind === 'lead_callback' && item.rawLead) {
      handleOpenCallbackEditor(item.rawLead);
    }
  };

  const handleToggleEventCompleted = async (event: AgendaEvent) => {
    if (!onSaveAgendaEvent) return;
    const nextStatus = event.status === 'concluido' ? 'agendado' : 'concluido';
    await onSaveAgendaEvent(
      {
        ...event,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      },
      'edit'
    );
  };

  // CRM Meeting handlers
  const handleOpenMeetingEditor = (lead: Lead) => {
    setEditingMeetingLead(lead);
    setEditMeetingDate(lead.meetingDate || selectedDayString || todayDateString);
    setEditMeetingTime(lead.meetingTime || '10:00');
    setEditMeetingNotes(lead.meetingNotes || '');
    setEditMeetingLink(lead.meetingLink || '');
    setEditMeetingStatus(lead.meetingStatus || 'agendada');
  };

  const handleSaveMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeetingLead) return;

    const formattedDate = editMeetingDate
      ? new Date(`${editMeetingDate}T00:00:00`).toLocaleDateString('pt-BR')
      : 'data a definir';

    const updated: Lead = {
      ...editingMeetingLead,
      stage: 'reuniao_marcada',
      meetingDate: editMeetingDate || undefined,
      meetingTime: editMeetingTime || undefined,
      meetingNotes: editMeetingNotes.trim() || undefined,
      meetingLink: editMeetingLink.trim() || undefined,
      meetingStatus: editMeetingStatus,
      lastContactDate: new Date().toISOString(),
      notes: [
        {
          id: `note-agenda-${Date.now()}`,
          date: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString(
            'pt-BR',
            { hour: '2-digit', minute: '2-digit' }
          )}`,
          text: `Reunião agendada: ${formattedDate}${
            editMeetingTime ? ` às ${editMeetingTime}` : ''
          }.${
            editMeetingNotes
              ? ` Pauta: "${editMeetingNotes.slice(0, 120)}${
                  editMeetingNotes.length > 120 ? '...' : ''
                }"`
              : ''
          }`,
          author: userName,
        },
        ...(editingMeetingLead.notes || []),
      ],
    };

    onUpdateLead(updated);
    if (editMeetingDate) setSelectedDayString(editMeetingDate);
    setEditingMeetingLead(null);
  };

  const handleSelectLeadForMeeting = (lead: Lead) => {
    onMoveStage(lead.id, 'reuniao_marcada');
    setIsQuickPickerOpen(false);
    handleOpenMeetingEditor({ ...lead, stage: 'reuniao_marcada' });
  };

  // CRM Callback handlers
  const handleOpenCallbackEditor = (lead: Lead) => {
    setEditingCallbackLead(lead);
    setEditCallbackDate(lead.callbackDate || selectedDayString || todayDateString);
    setEditCallbackTime(lead.callbackTime || '15:30');
    setEditCallbackNotes(lead.callbackNotes || '');
    setEditCallbackStatus(lead.callbackStatus || 'pendente');
  };

  const handleSaveCallback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCallbackLead) return;

    const formattedDate = editCallbackDate
      ? new Date(`${editCallbackDate}T00:00:00`).toLocaleDateString('pt-BR')
      : 'Hoje';

    const updated: Lead = {
      ...editingCallbackLead,
      callbackDate: editCallbackDate || undefined,
      callbackTime: editCallbackTime || undefined,
      callbackNotes: editCallbackNotes.trim() || undefined,
      callbackStatus: editCallbackStatus,
      lastContactDate: new Date().toISOString(),
      notes: [
        {
          id: `note-cb-${Date.now()}`,
          date: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString(
            'pt-BR',
            { hour: '2-digit', minute: '2-digit' }
          )}`,
          text: `Retorno agendado: ${formattedDate} às ${
            editCallbackTime || 'horário comercial'
          }.${editCallbackNotes ? ` Motivo: "${editCallbackNotes}"` : ''}`,
          author: userName,
        },
        ...(editingCallbackLead.notes || []),
      ],
    };

    onUpdateLead(updated);
    if (editCallbackDate) setSelectedDayString(editCallbackDate);
    setEditingCallbackLead(null);
  };

  const handleMarkCallbackDone = (lead: Lead) => {
    onUpdateLead({
      ...lead,
      callbackStatus: 'realizado',
      lastContactDate: new Date().toISOString(),
      notes: [
        {
          id: `note-cb-done-${Date.now()}`,
          date: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString(
            'pt-BR',
            { hour: '2-digit', minute: '2-digit' }
          )}`,
          text: 'Retorno realizado com sucesso.',
          author: userName,
        },
        ...(lead.notes || []),
      ],
    });
  };

  const handleRemoveCallback = (lead: Lead) => {
    onUpdateLead({
      ...lead,
      callbackDate: undefined,
      callbackTime: undefined,
      callbackNotes: undefined,
      callbackStatus: undefined,
    });
    setEditingCallbackLead(null);
  };

  const buildWhatsAppMeetingLink = (lead: Lead) => {
    const dataFmt = lead.meetingDate
      ? new Date(`${lead.meetingDate}T00:00:00`).toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
        })
      : 'em breve';
    const horaFmt = lead.meetingTime ? `às ${lead.meetingTime}` : '';
    const text = `Olá, ${lead.contactName || 'tudo bem'}! Aqui é ${userName}.\n\nConfirmando nossa reunião sobre a *${lead.companyName}* para *${dataFmt}* ${horaFmt}.\n\n${
      lead.meetingLink ? `Link da sala: ${lead.meetingLink}\n\n` : ''
    }Qualquer dúvida estou à disposição!`;
    return buildWhatsAppLink(lead.phone, text);
  };

  const filteredQuickPickers = useMemo(() => {
    const q = quickSearchTerm.trim().toLowerCase();
    return sourceLeadsPool
      .filter((l) => l.stage !== 'reuniao_marcada')
      .filter(
        (l) =>
          !q ||
          l.companyName.toLowerCase().includes(q) ||
          (l.contactName || '').toLowerCase().includes(q) ||
          l.phone.includes(q)
      );
  }, [sourceLeadsPool, quickSearchTerm]);

  const filteredCallbackPickers = useMemo(() => {
    const q = callbackPickerSearch.trim().toLowerCase();
    return sourceLeadsPool.filter(
      (l) =>
        !q ||
        l.companyName.toLowerCase().includes(q) ||
        (l.contactName || '').toLowerCase().includes(q) ||
        l.phone.includes(q)
    );
  }, [sourceLeadsPool, callbackPickerSearch]);

  const renderAgendaItemCard = (item: IntegratedAgendaItem, compact = false) => {
    const typeMeta = getAgendaEventTypeMeta(item.type);
    const googleUrl = buildGoogleCalendarTemplateUrl({
      title: item.title,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      description: [item.description, item.notes].filter(Boolean).join('\n'),
      meetingLink: item.meetingLink,
    });

    return (
      <div
        key={item.id}
        className={`p-3 rounded-xl border transition-colors space-y-2 ${
          item.isOverdue
            ? 'bg-[var(--kz-danger-bg)]/20 border-[var(--kz-danger-border)]'
            : item.isCompleted
            ? 'bg-[var(--kz-bg-subtle)]/40 border-[var(--kz-border-subtle)] opacity-75'
            : 'bg-[var(--kz-bg-subtle)]/70 border-[var(--kz-border-subtle)] hover:border-[var(--kz-border-default)]'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={typeMeta.variant} size="sm">
                {typeMeta.label}
              </Badge>
              <Badge variant="neutral" size="sm">
                {getSourceBadgeLabel(item.sourceKind)}
              </Badge>
              {item.isOverdue && (
                <Badge variant="danger" size="sm">
                  Atrasado
                </Badge>
              )}
              {item.isCompleted && (
                <Badge variant="success" size="sm">
                  Concluído
                </Badge>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleItemAction(item)}
              className={`text-left text-xs font-bold hover:text-[var(--kz-accent-text)] transition-colors cursor-pointer block ${
                item.isCompleted
                  ? 'line-through text-[var(--kz-text-muted)]'
                  : 'text-[var(--kz-text-primary)]'
              }`}
            >
              {item.title}
            </button>

            {!compact && item.description && (
              <p className="text-[11px] text-[var(--kz-text-muted)] line-clamp-2">
                {item.description}
              </p>
            )}
          </div>

          <div className="text-right shrink-0 space-y-1">
            <div className="text-[11px] font-mono font-semibold text-[var(--kz-text-primary)]">
              {item.date.split('-').reverse().join('/')}
            </div>
            {item.startTime && (
              <div className="text-[10px] font-mono text-[var(--kz-accent-text)]">
                {item.startTime}
                {item.endTime ? `–${item.endTime}` : ''}
              </div>
            )}
          </div>
        </div>

        {(item.clientName || item.projectName || item.leadName) && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--kz-text-muted)]">
            {item.clientId && item.clientName && (
              <button
                type="button"
                onClick={() =>
                  onOpenClient ? onOpenClient(item.clientId!) : onNavigate?.('clients')
                }
                className="inline-flex items-center gap-1 hover:text-[var(--kz-accent-text)] cursor-pointer"
              >
                <Users className="w-3 h-3" />
                <span>{item.clientName}</span>
              </button>
            )}
            {item.projectId && item.projectName && (
              <button
                type="button"
                onClick={() =>
                  onOpenProject ? onOpenProject(item.projectId!) : onNavigate?.('projects')
                }
                className="inline-flex items-center gap-1 hover:text-[var(--kz-accent-text)] cursor-pointer"
              >
                <FolderKanban className="w-3 h-3" />
                <span>{item.projectName}</span>
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[var(--kz-border-subtle)]/70">
          <Button
            size="xs"
            variant="outline"
            onClick={() => handleItemAction(item)}
            leftIcon={<Edit3 className="w-3 h-3" />}
          >
            {item.editableAsAgendaEvent ? 'Editar Evento' : 'Abrir Origem'}
          </Button>

          {item.sourceKind === 'agenda_event' && item.rawEvent && onSaveAgendaEvent && (
            <Button
              size="xs"
              variant={item.isCompleted ? 'ghost' : 'secondary'}
              onClick={() => handleToggleEventCompleted(item.rawEvent!)}
              leftIcon={<Check className="w-3 h-3" />}
            >
              {item.isCompleted ? 'Reabrir' : 'Concluir'}
            </Button>
          )}

          {item.meetingLink && (
            <a
              href={item.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] border border-[var(--kz-accent-border)] hover:bg-[var(--kz-accent)]/20 transition-colors"
            >
              <Video className="w-3 h-3" />
              <span>Sala</span>
            </a>
          )}

          {item.sourceKind === 'lead_meeting' && item.rawLead && (
            <a
              href={buildWhatsAppMeetingLink(item.rawLead)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)] hover:bg-emerald-500/20 transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              <span>WhatsApp</span>
            </a>
          )}

          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium rounded-lg bg-[var(--kz-bg-surface)] text-[var(--kz-text-secondary)] border border-[var(--kz-border-default)] hover:bg-[var(--kz-bg-muted)] transition-colors ml-auto"
            title="Abrir rascunho manual no Google Calendar"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Rascunho Google</span>
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
        <div className="space-y-1">
          <h2 className="kz-page-title">Agenda Integrada</h2>
          <p className="kz-subtitle">
            Central única de compromissos, reuniões comerciais, prazos de entrega dos projetos e datas das tarefas sem duplicação de registros.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<PhoneCall className="w-3.5 h-3.5" />}
            onClick={() => setIsCallbackPickerOpen(true)}
          >
            Agendar Retorno CRM
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<CalendarCheck className="w-3.5 h-3.5" />}
            onClick={() => setIsQuickPickerOpen(true)}
          >
            Marcar Reunião Lead
          </Button>
          {onSaveAgendaEvent && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setEditingAgendaEvent(null);
                setDefaultEventClientId(undefined);
                setIsEventModalOpen(true);
              }}
            >
              Novo Compromisso
            </Button>
          )}
        </div>
      </div>

      {cloudPermissionBlocked && (
        <Alert
          variant="warning"
          title="Sincronização em nuvem aguardando publicação de firestore.rules"
        >
          Novos compromissos da coleção <code className="font-mono">agendaEvents</code> estão sendo salvos no armazenamento local até você publicar o <code className="font-mono">firestore.rules</code> atualizado no Firebase Console.
        </Alert>
      )}

      {/* Honest Google Calendar OAuth architectural status */}
      <Alert variant="info" title={GOOGLE_CALENDAR_OAUTH_ARCHITECTURE.statusLabel}>
        {GOOGLE_CALENDAR_OAUTH_ARCHITECTURE.description}
      </Alert>

      {/* Urgent CRM Callbacks Today / Overdue Strip */}
      {urgentCallbacks.length > 0 && (
        <Card padding="md" className="border-[var(--kz-warning-border)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)] flex items-center justify-center">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--kz-text-primary)]">
                  Retornos comerciais pendentes ({urgentCallbacks.length})
                </div>
                <div className="text-[11px] text-[var(--kz-text-muted)]">
                  Leads do CRM que pediram contato hoje ou possuem retorno em atraso.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={onSwitchToKanban}
              rightIcon={<ArrowRight className="w-3 h-3" />}
            >
              Ir ao Pipeline
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {urgentCallbacks.slice(0, 6).map((lead) => {
              const isOverdue = (lead.callbackDate || '') < todayDateString;
              return (
                <div
                  key={lead.id}
                  className={`p-3 rounded-xl border bg-[var(--kz-bg-subtle)]/70 flex flex-col justify-between gap-2 ${
                    isOverdue
                      ? 'border-[var(--kz-danger-border)]'
                      : 'border-[var(--kz-warning-border)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--kz-text-primary)] truncate">
                        {lead.companyName}
                      </div>
                      <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                        {lead.contactName || 'Responsável'} · {formatDisplayPhone(lead.phone)}
                      </div>
                    </div>
                    <Badge variant={isOverdue ? 'danger' : 'warning'} size="sm">
                      {lead.callbackTime || 'Horário'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={buildWhatsAppLink(
                        lead.phone,
                        `Olá ${lead.contactName || ''}! Conforme combinamos, estou retornando o contato sobre a ${lead.companyName}.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 h-7 px-2 rounded-lg bg-[var(--kz-success-solid)] hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </a>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleMarkCallbackDone(lead)}
                    >
                      Concluir
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleOpenCallbackEditor(lead)}
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card padding="sm">
          <div className="text-[11px] font-semibold text-[var(--kz-accent-text)] flex items-center justify-between">
            <span>Para Hoje</span>
            <CalendarDays className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
          </div>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-text-primary)]">
            {summaryStats.todayItems}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--kz-text-muted)]">
            Compromissos, entregas e tarefas
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-semibold text-[var(--kz-danger-text)] flex items-center justify-between">
            <span>Itens em Atraso</span>
            <AlertCircle className="w-3.5 h-3.5 text-[var(--kz-danger-solid)]" />
          </div>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-danger-text)]">
            {summaryStats.overdueItems}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--kz-text-muted)]">
            Prazos ou compromissos vencidos
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-semibold text-[var(--kz-info-text)] flex items-center justify-between">
            <span>Semana Atual</span>
            <Clock className="w-3.5 h-3.5 text-[var(--kz-info-solid)]" />
          </div>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-info-text)]">
            {summaryStats.thisWeekItems}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--kz-text-muted)]">
            Pendentes nesta semana
          </div>
        </Card>

        <Card padding="sm">
          <div className="text-[11px] font-semibold text-[var(--kz-success-text)] flex items-center justify-between">
            <span>Reuniões Ativas</span>
            <Video className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
          </div>
          <div className="mt-2 text-2xl kz-metric text-[var(--kz-success-text)]">
            {summaryStats.meetingsCount}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--kz-text-muted)]">
            {unscheduledMeetingLeads.length} leads sem data definida
          </div>
        </Card>
      </div>

      {/* Controls: View Tabs & Filters */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <Tabs
            activeId={viewMode}
            onChange={(id) => setViewMode(id)}
            items={[
              { id: 'month', label: 'Calendário Mensal', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
              { id: 'week', label: 'Semanal', icon: <CalendarDays className="w-3.5 h-3.5" /> },
              { id: 'day', label: 'Agenda Diária', icon: <Clock className="w-3.5 h-3.5" /> },
              {
                id: 'list',
                label: 'Próximos Compromissos',
                badge: upcomingAndPendingList.length,
                icon: <ListOrdered className="w-3.5 h-3.5" />,
              },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="xs" onClick={handleGoToday}>
              Hoje
            </Button>
            <div className="inline-flex items-center rounded-lg border border-[var(--kz-border-default)] bg-[var(--kz-bg-surface)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setScopeMode('all')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  scopeMode === 'all'
                    ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)]'
                    : 'text-[var(--kz-text-muted)]'
                }`}
              >
                Toda Agência
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('niche')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                  scopeMode === 'niche'
                    ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)]'
                    : 'text-[var(--kz-text-muted)]'
                }`}
              >
                {niche.emoji} {niche.name}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar evento, cliente, projeto ou tarefa..."
            leftIcon={<Search className="w-3.5 h-3.5" />}
          />
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AgendaEventType | 'all')}
          >
            <option value="all">Todos os tipos de evento</option>
            {AGENDA_EVENT_TYPE_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(e.target.value as IntegratedAgendaSourceKind | 'all')
            }
          >
            <option value="all">Todas as origens</option>
            <option value="agenda_event">Eventos da Agenda</option>
            <option value="project_deadline">Prazos de Projetos</option>
            <option value="task_deadline">Datas de Tarefas</option>
            <option value="lead_meeting">Reuniões CRM</option>
            <option value="lead_callback">Retornos CRM</option>
          </Select>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--kz-bg-surface)] border border-[var(--kz-border-default)] text-xs text-[var(--kz-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            <span>Ocultar itens concluídos/cancelados</span>
          </label>
        </div>
      </div>

      {/* MAIN VIEW AREA */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card padding="md" className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--kz-border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--kz-text-primary)]">
                  {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <Badge variant="neutral" size="sm">
                  {filteredItems.length} registros
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    setCurrentDate(
                      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
                    )
                  }
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    setCurrentDate(
                      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
                    )
                  }
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[var(--kz-text-muted)] uppercase">
              {WEEKDAY_NAMES_SHORT.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {monthGridCells.map((cell) => {
                const dayItems = itemsByDate.get(cell.dateStr) || [];
                const isToday = cell.dateStr === todayDateString;
                const isSelected = cell.dateStr === selectedDayString;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => setSelectedDayString(cell.dateStr)}
                    className={`min-h-[92px] p-1.5 rounded-xl border cursor-pointer transition-colors flex flex-col justify-between ${
                      isSelected
                        ? 'border-[var(--kz-accent)] bg-[var(--kz-accent-soft)]/50'
                        : isToday
                        ? 'border-[var(--kz-success-border)] bg-[var(--kz-success-bg)]/35'
                        : cell.inMonth
                        ? 'border-[var(--kz-border-subtle)] bg-[var(--kz-bg-subtle)]/50 hover:border-[var(--kz-border-default)]'
                        : 'border-transparent bg-[var(--kz-bg-canvas)]/40 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-mono font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                          isToday
                            ? 'bg-[var(--kz-success-solid)] text-white'
                            : isSelected
                            ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)]'
                            : 'text-[var(--kz-text-secondary)]'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {dayItems.length > 0 && (
                        <span className="text-[10px] font-mono text-[var(--kz-text-muted)]">
                          {dayItems.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 mt-1 overflow-hidden">
                      {dayItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayString(cell.dateStr);
                            handleItemAction(item);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate border ${
                            item.isOverdue
                              ? 'bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)] border-[var(--kz-danger-border)]'
                              : item.isCompleted
                              ? 'bg-[var(--kz-bg-muted)] text-[var(--kz-text-subtle)] border-[var(--kz-border-subtle)] line-through'
                              : item.sourceKind === 'project_deadline'
                              ? 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] border-[var(--kz-accent-border)]'
                              : item.sourceKind === 'task_deadline'
                              ? 'bg-[var(--kz-info-bg)] text-[var(--kz-info-text)] border-[var(--kz-info-border)]'
                              : 'bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border-[var(--kz-success-border)]'
                          }`}
                          title={item.title}
                        >
                          {item.startTime ? `${item.startTime} ` : ''}
                          {item.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <div className="text-[9px] font-semibold text-[var(--kz-text-muted)] px-1">
                          +{dayItems.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Selected Day Sidebar Detail */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--kz-border-subtle)] pb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--kz-text-muted)]">
                  Dia Selecionado
                </div>
                <div className="text-sm font-bold text-[var(--kz-text-primary)] capitalize">
                  {new Date(`${selectedDayString}T12:00:00`).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })}
                </div>
              </div>
              {onSaveAgendaEvent && (
                <Button
                  size="xs"
                  variant="primary"
                  leftIcon={<Plus className="w-3 h-3" />}
                  onClick={() => {
                    setEditingAgendaEvent(null);
                    setDefaultEventClientId(undefined);
                    setIsEventModalOpen(true);
                  }}
                >
                  Evento
                </Button>
              )}
            </div>

            {selectedDayItems.length === 0 ? (
              <div className="py-10 text-center space-y-2 border border-dashed border-[var(--kz-border-default)] rounded-xl">
                <CalendarIcon className="w-7 h-7 text-[var(--kz-text-subtle)] mx-auto" />
                <div className="text-xs font-semibold text-[var(--kz-text-primary)]">
                  Nenhum compromisso ou prazo nesta data
                </div>
                <div className="text-[11px] text-[var(--kz-text-muted)]">
                  Crie um compromisso direto ou defina prazos em Projetos/Tarefas.
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {selectedDayItems.map((item) => renderAgendaItemCard(item))}
              </div>
            )}
          </Card>
        </div>
      )}

      {viewMode === 'week' && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--kz-border-subtle)] pb-3">
            <div className="text-sm font-bold text-[var(--kz-text-primary)]">
              Semana de {weekDates[0].split('-').reverse().join('/')} a{' '}
              {weekDates[6].split('-').reverse().join('/')}
            </div>
            <div className="flex items-center gap-1">
              <Button size="xs" variant="outline" onClick={() => shiftSelectedDate(-7)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button size="xs" variant="outline" onClick={() => shiftSelectedDate(7)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
            {weekDates.map((dateStr, idx) => {
              const dayItems = itemsByDate.get(dateStr) || [];
              const isToday = dateStr === todayDateString;
              return (
                <div
                  key={dateStr}
                  className={`p-2.5 rounded-xl border min-h-[240px] flex flex-col gap-2 ${
                    isToday
                      ? 'border-[var(--kz-accent-border)] bg-[var(--kz-accent-soft)]/30'
                      : 'border-[var(--kz-border-subtle)] bg-[var(--kz-bg-subtle)]/50'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-[var(--kz-border-subtle)] pb-1.5">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--kz-text-muted)]">
                        {WEEKDAY_NAMES_SHORT[idx]}
                      </div>
                      <div className="text-xs font-mono font-bold text-[var(--kz-text-primary)]">
                        {dateStr.split('-').reverse().slice(0, 2).join('/')}
                      </div>
                    </div>
                    {onSaveAgendaEvent && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDayString(dateStr);
                          setEditingAgendaEvent(null);
                          setDefaultEventClientId(undefined);
                          setIsEventModalOpen(true);
                        }}
                        className="p-1 rounded hover:bg-[var(--kz-bg-muted)] text-[var(--kz-text-muted)] hover:text-[var(--kz-accent-text)] cursor-pointer"
                        title="Adicionar evento neste dia"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {dayItems.length === 0 ? (
                    <div className="text-[11px] text-[var(--kz-text-subtle)] italic py-4 text-center">
                      Livre
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {dayItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleItemAction(item)}
                          className={`w-full text-left p-2 rounded-lg border text-[11px] space-y-0.5 cursor-pointer transition-colors ${
                            item.isOverdue
                              ? 'bg-[var(--kz-danger-bg)]/30 border-[var(--kz-danger-border)]'
                              : 'bg-[var(--kz-bg-surface)] border-[var(--kz-border-subtle)] hover:border-[var(--kz-accent-border)]'
                          }`}
                        >
                          <div className="font-mono text-[10px] text-[var(--kz-accent-text)]">
                            {item.startTime || getSourceBadgeLabel(item.sourceKind)}
                          </div>
                          <div className="font-semibold text-[var(--kz-text-primary)] line-clamp-2">
                            {item.title}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {viewMode === 'day' && (
        <Card padding="md" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--kz-border-subtle)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--kz-text-primary)] capitalize">
                {new Date(`${selectedDayString}T12:00:00`).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
              <p className="text-xs text-[var(--kz-text-muted)]">
                {selectedDayItems.length} item(ns) programado(s) para esta data.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="xs" variant="outline" onClick={() => shiftSelectedDate(-1)}>
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </Button>
              <Button size="xs" variant="outline" onClick={() => shiftSelectedDate(1)}>
                Próximo <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {selectedDayItems.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon className="w-5 h-5" />}
              title="Agenda livre neste dia"
              description="Nenhum compromisso, reunião, entrega de projeto ou tarefa vencendo nesta data."
              action={
                onSaveAgendaEvent ? (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setEditingAgendaEvent(null);
                      setDefaultEventClientId(undefined);
                      setIsEventModalOpen(true);
                    }}
                  >
                    Adicionar Compromisso
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedDayItems.map((item) => renderAgendaItemCard(item))}
            </div>
          )}
        </Card>
      )}

      {viewMode === 'list' && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--kz-border-subtle)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--kz-text-primary)]">
                Próximos Compromissos & Itens Pendentes ({upcomingAndPendingList.length})
              </h3>
              <p className="text-xs text-[var(--kz-text-muted)]">
                Ordenados cronologicamente combinando Agenda, Projetos, Tarefas e CRM.
              </p>
            </div>
          </div>

          {upcomingAndPendingList.length === 0 ? (
            <EmptyState
              icon={<ListOrdered className="w-5 h-5" />}
              title="Nenhum compromisso futuro ou pendente"
              description="Crie um novo compromisso ou defina prazos em projetos e tarefas para vê-los aqui."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingAndPendingList.map((item) => renderAgendaItemCard(item))}
            </div>
          )}
        </Card>
      )}

      {/* Standalone AgendaEvent CRUD Modal */}
      {onSaveAgendaEvent && (
        <AgendaEventModal
          isOpen={isEventModalOpen}
          onClose={() => {
            setIsEventModalOpen(false);
            setEditingAgendaEvent(null);
            setDefaultEventClientId(undefined);
          }}
          clients={clients}
          leads={allLeads || leads}
          projects={projects}
          editingEvent={editingAgendaEvent}
          defaultDate={selectedDayString}
          defaultClientId={defaultEventClientId}
          onSaveEvent={onSaveAgendaEvent}
          onDeleteEvent={onDeleteAgendaEvent}
        />
      )}

      {/* CRM Lead Meeting Modal */}
      {editingMeetingLead && (
        <Modal
          isOpen
          onClose={() => setEditingMeetingLead(null)}
          size="lg"
          title={`Reunião Comercial — ${editingMeetingLead.companyName}`}
          subtitle={`${editingMeetingLead.contactName || 'Responsável'} · ${formatDisplayPhone(
            editingMeetingLead.phone
          )}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditingMeetingLead(null)}>
                Cancelar
              </Button>
              <a
                href={buildWhatsAppMeetingLink({
                  ...editingMeetingLead,
                  meetingDate: editMeetingDate,
                  meetingTime: editMeetingTime,
                  meetingLink: editMeetingLink,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] border border-[var(--kz-success-border)]"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Confirmar WhatsApp</span>
              </a>
              <Button type="submit" form="crm-meeting-form" variant="primary">
                Salvar Reunião
              </Button>
            </>
          }
        >
          <form id="crm-meeting-form" onSubmit={handleSaveMeeting} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Data *"
                type="date"
                value={editMeetingDate}
                onChange={(e) => setEditMeetingDate(e.target.value)}
                required
                className="font-mono"
              />
              <Input
                label="Horário *"
                type="time"
                value={editMeetingTime}
                onChange={(e) => setEditMeetingTime(e.target.value)}
                required
                className="font-mono"
              />
              <Select
                label="Status"
                value={editMeetingStatus}
                onChange={(e) =>
                  setEditMeetingStatus(
                    e.target.value as 'agendada' | 'realizada' | 'remarcada' | 'cancelada'
                  )
                }
              >
                <option value="agendada">Agendada</option>
                <option value="realizada">Realizada</option>
                <option value="remarcada">Remarcada</option>
                <option value="cancelada">Cancelada</option>
              </Select>
            </div>

            <Input
              label="Link da Reunião (Meet / Zoom)"
              value={editMeetingLink}
              onChange={(e) => setEditMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/..."
              className="font-mono"
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="kz-label flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
                  <span>Pauta / Estudo de Caso</span>
                </label>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  leftIcon={<Sparkles className="w-3 h-3" />}
                  onClick={() =>
                    setEditMeetingNotes(
                      `• PERFIL: ${editingMeetingLead.companyName} (${
                        editingMeetingLead.city || niche.city
                      })\n• OPORTUNIDADE: Site responsivo + WhatsApp + Google Business Profile.\n• PROPOSTA: Setup + recorrência mensal.`
                    )
                  }
                >
                  Inserir Roteiro
                </Button>
              </div>
              <textarea
                rows={5}
                value={editMeetingNotes}
                onChange={(e) => setEditMeetingNotes(e.target.value)}
                className="w-full text-xs p-3 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-xl text-[var(--kz-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--kz-border-subtle)]">
              <Button
                type="button"
                size="xs"
                variant="outline"
                leftIcon={<DollarSign className="w-3 h-3" />}
                onClick={() => {
                  onMoveStage(editingMeetingLead.id, 'fechado');
                  setEditingMeetingLead(null);
                }}
              >
                Marcar Venda Fechada
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                leftIcon={<RotateCcw className="w-3 h-3" />}
                onClick={() => {
                  onMoveStage(editingMeetingLead.id, 'follow_up_1');
                  setEditingMeetingLead(null);
                }}
              >
                Mover p/ Follow-up
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                leftIcon={<FileText className="w-3 h-3" />}
                onClick={() => {
                  onOpenLeadModal(editingMeetingLead);
                  setEditingMeetingLead(null);
                }}
              >
                Abrir Ficha do Lead
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Lead Meeting Picker */}
      {isQuickPickerOpen && (
        <Modal
          isOpen
          onClose={() => setIsQuickPickerOpen(false)}
          size="md"
          title="Marcar Reunião para Lead do CRM"
          subtitle="Move o lead para Reunião Marcada e abre o agendamento de data/pauta."
        >
          <div className="space-y-3">
            <Input
              value={quickSearchTerm}
              onChange={(e) => setQuickSearchTerm(e.target.value)}
              placeholder="Buscar lead por empresa, contato ou telefone..."
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {filteredQuickPickers.slice(0, 15).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleSelectLeadForMeeting(l)}
                  className="w-full text-left p-2.5 rounded-xl bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-muted)] border border-[var(--kz-border-subtle)] flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--kz-text-primary)] truncate">
                      {l.companyName}
                    </div>
                    <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                      {l.contactName || 'Contato'} · {formatDisplayPhone(l.phone)}
                    </div>
                  </div>
                  <Badge variant="success" size="sm">
                    + Agendar
                  </Badge>
                </button>
              ))}
              {filteredQuickPickers.length === 0 && (
                <div className="py-6 text-center text-xs text-[var(--kz-text-muted)]">
                  Nenhum lead disponível encontrado.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* CRM Callback Editor Modal */}
      {editingCallbackLead && (
        <Modal
          isOpen
          onClose={() => setEditingCallbackLead(null)}
          size="md"
          title={`Retorno CRM — ${editingCallbackLead.companyName}`}
          footer={
            <div className="w-full flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-[var(--kz-danger-text)]"
                onClick={() => handleRemoveCallback(editingCallbackLead)}
              >
                Remover Retorno
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setEditingCallbackLead(null)}>
                  Cancelar
                </Button>
                <Button type="submit" form="crm-callback-form" variant="primary">
                  Salvar Retorno
                </Button>
              </div>
            </div>
          }
        >
          <form id="crm-callback-form" onSubmit={handleSaveCallback} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Data *"
                type="date"
                value={editCallbackDate}
                onChange={(e) => setEditCallbackDate(e.target.value)}
                required
                className="font-mono"
              />
              <Input
                label="Horário *"
                type="time"
                value={editCallbackTime}
                onChange={(e) => setEditCallbackTime(e.target.value)}
                required
                className="font-mono"
              />
              <Select
                label="Status"
                value={editCallbackStatus}
                onChange={(e) =>
                  setEditCallbackStatus(
                    e.target.value as 'pendente' | 'realizado' | 'cancelado'
                  )
                }
              >
                <option value="pendente">Pendente</option>
                <option value="realizado">Realizado</option>
                <option value="cancelado">Cancelado</option>
              </Select>
            </div>
            <div>
              <label className="kz-label mb-1 block">Observação do Retorno</label>
              <textarea
                rows={3}
                value={editCallbackNotes}
                onChange={(e) => setEditCallbackNotes(e.target.value)}
                className="w-full text-xs p-3 bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-default)] rounded-xl text-[var(--kz-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--kz-accent)]"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Callback Picker Modal */}
      {isCallbackPickerOpen && (
        <Modal
          isOpen
          onClose={() => setIsCallbackPickerOpen(false)}
          size="md"
          title="Agendar Retorno (Ligar Mais Tarde)"
        >
          <div className="space-y-3">
            <Input
              value={callbackPickerSearch}
              onChange={(e) => setCallbackPickerSearch(e.target.value)}
              placeholder="Buscar lead por empresa, contato ou telefone..."
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {filteredCallbackPickers.slice(0, 15).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setIsCallbackPickerOpen(false);
                    handleOpenCallbackEditor(l);
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-muted)] border border-[var(--kz-border-subtle)] flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--kz-text-primary)] truncate">
                      {l.companyName}
                    </div>
                    <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                      {l.contactName || 'Contato'} · {formatDisplayPhone(l.phone)}
                    </div>
                  </div>
                  <Badge variant="warning" size="sm">
                    + Retorno
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
