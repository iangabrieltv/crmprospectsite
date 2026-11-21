import React, { useState, useMemo } from 'react';
import {
  NicheCampaign,
  AppTab,
  Lead,
} from '../types/crm';
import { AgendaEvent, Task } from '../types/kaizen';
import { FinancialEntry } from '../types/finance';
import { SystemNotification } from '../types/system';
import { getRouteMeta } from '../config/navigation';
import { auth } from '../utils/firebase';
import {
  KAIZEN_TIMEZONE,
  addDaysYmd,
  formatBrlFromCents,
  formatDateBr,
  getEffectiveEntryStatus,
  getEntryPendingCents,
  getTodayInTimezone,
} from '../services/finance';
import {
  Plus,
  ChevronDown,
  User,
  Check,
  LogOut,
  Cloud,
  Trash2,
  Bell,
  Calendar,
  PhoneCall,
  CheckSquare,
  Menu,
  Settings,
  Upload,
  Wallet,
} from 'lucide-react';
import {
  Button,
  Breadcrumbs,
  Dropdown,
  Modal,
  ConfirmDialog,
  Input,
  Alert,
} from './ui';
import { toLocalDateString } from '../utils/dashboardMetrics';

interface HeaderProps {
  niches: NicheCampaign[];
  activeNiche: NicheCampaign;
  onSelectNiche: (nicheId: string) => void;
  onOpenNewNicheModal: () => void;
  onOpenNewLeadModal: () => void;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  userName: string;
  onUpdateUserName: (name: string) => void;
  leads: Lead[];
  tasks?: Task[];
  agendaEvents?: AgendaEvent[];
  financialEntries?: FinancialEntry[];
  financialAlertDaysAhead?: number;
  notifications?: SystemNotification[];
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  photoUrl?: string;
  agencyName?: string;
  totalLeadsCount: number;
  allLeadsCount?: number;
  allNichesCount?: number;
  importedSheetsCount?: number;
  lastBackupAt?: string | null;
  onLogout?: () => void;
  isCloudSynced?: boolean;
  syncStatus?: 'synced' | 'saving' | 'error';
  onClearAllContacts?: () => Promise<void> | void;
  onToggleMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  niches,
  activeNiche,
  onSelectNiche,
  onOpenNewNicheModal,
  onOpenNewLeadModal,
  activeTab,
  onSelectTab,
  userName,
  onUpdateUserName,
  leads,
  tasks = [],
  agendaEvents = [],
  financialEntries = [],
  financialAlertDaysAhead = 5,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  photoUrl,
  agencyName,
  totalLeadsCount,
  allLeadsCount,
  allNichesCount,
  importedSheetsCount = 0,
  lastBackupAt = null,
  onLogout,
  isCloudSynced = true,
  syncStatus = 'synced',
  onClearAllContacts,
  onToggleMobileSidebar,
}) => {
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearError, setClearError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [tempUserName, setTempUserName] = useState(userName);

  const routeMeta = getRouteMeta(activeTab);
  const isCrmRoute =
    activeTab === 'kanban' || activeTab === 'leads_list' || activeTab === 'importer';

  // Real notifications ONLY (CRM callbacks/meetings + integrated AgendaEvents + Tasks + Financial due/overdue)
  const realAlerts = useMemo(() => {
    const todayStr = toLocalDateString(new Date());
    const finTodayStr = getTodayInTimezone(KAIZEN_TIMEZONE);
    const finHorizonStr = addDaysYmd(finTodayStr, Math.max(0, financialAlertDaysAhead));
    const items: {
      id: string;
      kind: 'callback' | 'meeting' | 'task' | 'event' | 'finance';
      targetTab: AppTab;
      title: string;
      subtitle: string;
      timeLabel: string;
      urgent: boolean;
    }[] = [];

    for (const lead of leads) {
      if (
        lead.callbackDate &&
        lead.callbackDate <= todayStr &&
        lead.callbackStatus !== 'realizado' &&
        lead.callbackStatus !== 'cancelado'
      ) {
        items.push({
          id: `cb-${lead.id}`,
          kind: 'callback',
          targetTab: 'agenda',
          title: lead.companyName,
          subtitle: lead.callbackNotes || 'Retorno comercial agendado',
          timeLabel:
            lead.callbackDate < todayStr
              ? `Atrasado (${lead.callbackDate.split('-').reverse().join('/')})`
              : lead.callbackTime
              ? `Hoje às ${lead.callbackTime}`
              : 'Hoje',
          urgent: lead.callbackDate < todayStr,
        });
      }

      if (
        lead.meetingDate &&
        lead.meetingDate <= todayStr &&
        lead.meetingStatus !== 'realizada' &&
        lead.meetingStatus !== 'cancelada'
      ) {
        items.push({
          id: `mt-${lead.id}`,
          kind: 'meeting',
          targetTab: 'agenda',
          title: lead.companyName,
          subtitle: lead.meetingNotes || 'Reunião comercial marcada',
          timeLabel:
            lead.meetingDate < todayStr
              ? `Pendente (${lead.meetingDate.split('-').reverse().join('/')})`
              : lead.meetingTime
              ? `Hoje às ${lead.meetingTime}`
              : 'Hoje',
          urgent: lead.meetingDate < todayStr,
        });
      }
    }

    for (const evt of agendaEvents) {
      if (evt.status === 'agendado' && evt.date <= todayStr) {
        items.push({
          id: `evt-${evt.id}`,
          kind: 'event',
          targetTab: 'agenda',
          title: evt.title,
          subtitle: evt.description || 'Compromisso na Agenda Integrada',
          timeLabel:
            evt.date < todayStr
              ? `Pendente (${evt.date.split('-').reverse().join('/')})`
              : evt.startTime
              ? `Hoje às ${evt.startTime}`
              : 'Hoje',
          urgent: evt.date < todayStr,
        });
      }
    }

    for (const task of tasks) {
      if (task.status !== 'concluida' && task.dueDate && task.dueDate <= todayStr) {
        items.push({
          id: `tsk-${task.id}`,
          kind: 'task',
          targetTab: 'tasks',
          title: task.title,
          subtitle: task.phaseLabel || 'Tarefa operacional vinculada',
          timeLabel:
            task.dueDate < todayStr
              ? `Tarefa atrasada (${task.dueDate.split('-').reverse().join('/')})`
              : 'Vence hoje',
          urgent: task.dueDate < todayStr,
        });
      }
    }

    for (const entry of financialEntries) {
      const pendingCents = getEntryPendingCents(entry);
      if (pendingCents <= 0) continue;
      const effStatus = getEffectiveEntryStatus(entry, finTodayStr);
      if (effStatus !== 'atrasada' && entry.dueDate > finHorizonStr) continue;
      const isOverdue = effStatus === 'atrasada';
      items.push({
        id: `fin-${entry.id}`,
        kind: 'finance',
        targetTab: 'finance',
        title: entry.description,
        subtitle: `${entry.kind === 'receita' ? 'A receber' : 'A pagar'} · ${formatBrlFromCents(
          pendingCents
        )}`,
        timeLabel: isOverdue
          ? `Vencida em ${formatDateBr(entry.dueDate)}`
          : entry.dueDate === finTodayStr
          ? 'Vence hoje'
          : `Vence em ${formatDateBr(entry.dueDate)}`,
        urgent: isOverdue || entry.dueDate === finTodayStr,
      });
    }

    return items.sort((a, b) => Number(b.urgent) - Number(a.urgent));
  }, [leads, tasks, agendaEvents, financialEntries, financialAlertDaysAhead]);

  const bellNotifications = useMemo(() => {
    if (notifications !== undefined) {
      return notifications
        .filter((n) => !n.dismissed)
        .map((n) => ({
          id: n.id,
          kind: (
            n.category === 'financeiro'
              ? 'finance'
              : n.category === 'operacional'
              ? 'task'
              : n.entityType === 'lead' && n.title.toLowerCase().includes('retorno')
              ? 'callback'
              : 'event'
          ) as 'callback' | 'meeting' | 'task' | 'event' | 'finance',
          targetTab: n.targetTab,
          title: n.title,
          subtitle: n.message,
          timeLabel: n.dueLabel || '',
          urgent: n.severity === 'danger',
          read: n.read,
        }));
    }
    return realAlerts.map((a) => ({ ...a, read: false }));
  }, [notifications, realAlerts]);

  const unreadBellCount = useMemo(
    () => bellNotifications.filter((b) => !b.read).length,
    [bellNotifications]
  );

  const handleSaveUserName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempUserName.trim()) {
      onUpdateUserName(tempUserName.trim());
      setIsUserModalOpen(false);
    }
  };

  const handleConfirmClear = async () => {
    if (!onClearAllContacts) return;
    setIsClearing(true);
    setClearError(null);
    try {
      await onClearAllContacts();
      setIsClearModalOpen(false);
    } catch (e) {
      setClearError(
        e instanceof Error
          ? `Falha ao zerar banco: ${e.message}`
          : 'Falha ao zerar banco na nuvem. Verifique sua conexão e permissões.'
      );
    } finally {
      setIsClearing(false);
    }
  };

  const adminEmail = auth.currentUser?.email || 'Administrador';

  return (
    <header className="sticky top-0 z-30 bg-[var(--kz-bg-header)] backdrop-blur-md border-b border-[var(--kz-border-subtle)] w-full shrink-0">
      <div className="w-full px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* LEFT: Mobile Sidebar Toggle + Page Title + Breadcrumbs */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 -ml-1 rounded-lg text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)] cursor-pointer shrink-0"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <Breadcrumbs
              className="hidden sm:flex mb-0.5"
              items={routeMeta.breadcrumbs.map((b) => ({
                label: b.label,
                onClick: b.tab ? () => onSelectTab(b.tab!) : undefined,
              }))}
            />
            <h1 className="text-sm sm:text-base font-bold text-[var(--kz-text-primary)] tracking-tight truncate leading-tight">
              {routeMeta.title}
            </h1>
          </div>
        </div>

        {/* RIGHT: Niche Switcher, Contextual Actions, Sync Status, Real Alerts, Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Active Niche Selector */}
          <Dropdown
            align="right"
            menuClassName="w-72"
            trigger={() => (
              <button
                type="button"
                className="flex items-center gap-1.5 px-2.5 py-1.5 h-8 rounded-lg border border-[var(--kz-border-default)] bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-muted)] hover:border-[var(--kz-border-strong)] text-[var(--kz-text-primary)] text-xs font-semibold transition-colors cursor-pointer"
                title="Alternar nicho ou criar nova campanha"
              >
                <span className="text-sm leading-none shrink-0">{activeNiche.emoji}</span>
                <span className="max-w-[90px] sm:max-w-[150px] truncate font-bold">
                  {activeNiche.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--kz-text-muted)] shrink-0" />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-3 py-1.5 border-b border-[var(--kz-border-subtle)] flex items-center justify-between">
                  <span className="kz-overline">Nichos / Campanhas</span>
                  <span className="text-[11px] text-[var(--kz-text-muted)] font-mono">
                    {niches.length} ativos
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto py-1">
                  {niches.map((niche) => {
                    const isCurrent = niche.id === activeNiche.id;
                    return (
                      <button
                        key={niche.id}
                        type="button"
                        onClick={() => {
                          onSelectNiche(niche.id);
                          close();
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] font-semibold'
                            : 'hover:bg-[var(--kz-bg-muted)] text-[var(--kz-text-secondary)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">{niche.emoji}</span>
                          <div className="truncate">
                            <div className="truncate font-medium">{niche.name}</div>
                            <div className="text-[10px] text-[var(--kz-text-muted)] font-normal truncate">
                              {niche.city}
                            </div>
                          </div>
                        </div>
                        {isCurrent && (
                          <Check className="w-3.5 h-3.5 text-[var(--kz-accent)] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="p-1.5 border-t border-[var(--kz-border-subtle)]">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onOpenNewNicheModal();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--kz-accent-text)] bg-[var(--kz-accent-soft)] hover:bg-[var(--kz-accent)]/20 border border-[var(--kz-accent-border)] rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Novo Nicho / Campanha</span>
                  </button>
                </div>
              </>
            )}
          </Dropdown>

          {/* Contextual Import Button when on CRM */}
          {isCrmRoute && activeTab !== 'importer' && (
            <Button
              variant="outline"
              size="sm"
              className="hidden lg:inline-flex"
              leftIcon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => onSelectTab('importer')}
            >
              Importar
            </Button>
          )}

          {/* Quick Add Lead CTA */}
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenNewLeadModal}
            title="Cadastrar novo lead manualmente"
          >
            <span className="hidden sm:inline">Novo Lead</span>
            <span className="sm:hidden">Lead</span>
          </Button>

          {/* Cloud Sync Pill */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 h-8 rounded-lg border text-[11px] font-semibold shrink-0 transition-colors ${
              syncStatus === 'error'
                ? 'bg-[var(--kz-danger-bg)] border-[var(--kz-danger-border)] text-[var(--kz-danger-text)]'
                : syncStatus === 'saving'
                ? 'bg-[var(--kz-accent-soft)] border-[var(--kz-accent-border)] text-[var(--kz-accent-text)]'
                : isCloudSynced
                ? 'bg-[var(--kz-success-bg)] border-[var(--kz-success-border)] text-[var(--kz-success-text)]'
                : 'bg-[var(--kz-warning-bg)] border-[var(--kz-warning-border)] text-[var(--kz-warning-text)]'
            }`}
            title="Sincronização em tempo real com Cloud Firestore"
          >
            <Cloud className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline">
              {syncStatus === 'error'
                ? 'Erro de Sync'
                : syncStatus === 'saving'
                ? 'Salvando...'
                : isCloudSynced
                ? 'Nuvem Ao Vivo'
                : 'Conectando...'}
            </span>
          </div>

          {/* Persisted Notifications Bell */}
          <Dropdown
            align="right"
            menuClassName="w-80"
            trigger={() => (
              <button
                type="button"
                className="relative h-8 w-8 rounded-lg border border-[var(--kz-border-default)] bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-muted)] text-[var(--kz-text-secondary)] flex items-center justify-center transition-colors cursor-pointer"
                title="Central de Notificações e Alertas"
                aria-label="Central de Notificações"
              >
                <Bell className="w-4 h-4" />
                {unreadBellCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--kz-accent)] text-[var(--kz-accent-fg)] text-[9px] font-mono font-bold flex items-center justify-center">
                    {unreadBellCount}
                  </span>
                )}
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-3 py-2 border-b border-[var(--kz-border-subtle)] flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--kz-text-primary)]">
                    Notificações ({unreadBellCount} não lidas)
                  </span>
                  {onMarkAllNotificationsRead && unreadBellCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onMarkAllNotificationsRead()}
                      className="text-[10px] font-semibold text-[var(--kz-accent-text)] hover:underline cursor-pointer"
                    >
                      Marcar todas
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-[var(--kz-border-subtle)]">
                  {bellNotifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[var(--kz-text-muted)]">
                      Nenhuma notificação pendente no momento.
                    </div>
                  ) : (
                    bellNotifications.slice(0, 12).map((alert) => (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => {
                          close();
                          if (notifications !== undefined && !alert.read) {
                            onMarkNotificationRead?.(alert.id);
                          }
                          onSelectTab(alert.targetTab);
                        }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-[var(--kz-bg-muted)] transition-colors flex items-start gap-2.5 cursor-pointer ${
                          alert.read ? 'opacity-65' : ''
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            alert.kind === 'callback'
                              ? 'bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)]'
                              : alert.kind === 'finance'
                              ? alert.urgent
                                ? 'bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)]'
                                : 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)]'
                              : alert.kind === 'task'
                              ? 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)]'
                              : 'bg-[var(--kz-success-bg)] text-[var(--kz-success-text)]'
                          }`}
                        >
                          {alert.kind === 'callback' ? (
                            <PhoneCall className="w-3.5 h-3.5" />
                          ) : alert.kind === 'finance' ? (
                            <Wallet className="w-3.5 h-3.5" />
                          ) : alert.kind === 'task' ? (
                            <CheckSquare className="w-3.5 h-3.5" />
                          ) : (
                            <Calendar className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-[var(--kz-text-primary)] truncate flex items-center gap-1.5">
                            {!alert.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--kz-accent)] shrink-0" />
                            )}
                            <span className="truncate">{alert.title}</span>
                          </div>
                          <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                            {alert.subtitle}
                          </div>
                          {alert.timeLabel && (
                            <div
                              className={`text-[10px] font-mono mt-0.5 ${
                                alert.urgent
                                  ? 'text-[var(--kz-danger-text)] font-bold'
                                  : 'text-[var(--kz-text-secondary)]'
                              }`}
                            >
                              {alert.timeLabel}
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="p-1.5 border-t border-[var(--kz-border-subtle)] grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onSelectTab('notifications');
                    }}
                    className="w-full text-center py-1.5 text-xs font-semibold text-[var(--kz-accent-text)] hover:bg-[var(--kz-accent-soft)] rounded-lg transition-colors cursor-pointer"
                  >
                    Central de Alertas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onSelectTab('agenda');
                    }}
                    className="w-full text-center py-1.5 text-xs font-semibold text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)] rounded-lg transition-colors cursor-pointer"
                  >
                    Abrir Agenda
                  </button>
                </div>
              </>
            )}
          </Dropdown>

          {/* Admin Profile & Account Menu */}
          <Dropdown
            align="right"
            menuClassName="w-60"
            trigger={() => (
              <button
                type="button"
                className="flex items-center gap-1.5 px-2 h-8 rounded-lg border border-[var(--kz-border-default)] bg-[var(--kz-bg-subtle)] hover:bg-[var(--kz-bg-muted)] text-[var(--kz-text-primary)] text-xs font-medium transition-colors cursor-pointer"
                title={agencyName ? `${agencyName} — ${userName}` : 'Perfil do administrador e opções da conta'}
              >
                {photoUrl && photoUrl.startsWith('https://') ? (
                  <img
                    src={photoUrl}
                    alt={userName}
                    className="w-5 h-5 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-md bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)] font-bold text-[11px] flex items-center justify-center shrink-0">
                    {userName?.charAt(0)?.toUpperCase() || 'K'}
                  </div>
                )}
                <span className="hidden md:inline max-w-[90px] truncate font-semibold">
                  {userName}
                </span>
                <ChevronDown className="w-3 h-3 text-[var(--kz-text-muted)] shrink-0" />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-3 py-2 border-b border-[var(--kz-border-subtle)]">
                  <div className="text-xs font-bold text-[var(--kz-text-primary)] truncate">
                    {userName}
                  </div>
                  <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                    {adminEmail}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setTempUserName(userName);
                      setIsUserModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)] flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-[var(--kz-text-muted)]" />
                    <span>Editar nome nos scripts</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onSelectTab('settings');
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)] flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-[var(--kz-text-muted)]" />
                    <span>Configurações do Sistema</span>
                  </button>

                  {onClearAllContacts && (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        setClearConfirmText('');
                        setClearError(null);
                        setIsClearModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-[var(--kz-danger-text)] hover:bg-[var(--kz-danger-bg)] flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Zerar base de dados</span>
                    </button>
                  )}
                </div>

                {onLogout && (
                  <div className="pt-1 border-t border-[var(--kz-border-subtle)]">
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)] flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-[var(--kz-text-muted)]" />
                      <span>Sair da conta</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </Dropdown>
        </div>
      </div>

      {/* User Name Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        size="sm"
        title="Configurar Nome do Operador"
        subtitle="Aplicado na variável {SeuNome} ao disparar mensagens no WhatsApp"
      >
        <form onSubmit={handleSaveUserName} className="space-y-4">
          <Input
            label="Seu Nome ou Nome da Agência"
            value={tempUserName}
            onChange={(e) => setTempUserName(e.target.value)}
            placeholder="Ex: Ian"
            autoFocus
            required
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setIsUserModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Salvar Nome
            </Button>
          </div>
        </form>
      </Modal>

      {/* Clear Contacts Confirmation Modal */}
      <ConfirmDialog
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClear}
        title="Zerar Banco de Dados (Ação Irreversível)"
        description="Exclui dados da nuvem (Firestore) e do cache local deste navegador."
        confirmLabel="Confirmar Exclusão Total"
        variant="danger"
        loading={isClearing}
        confirmDisabled={clearConfirmText.trim().toUpperCase() !== 'ZERAR'}
      >
        <div className="space-y-2 text-xs bg-[var(--kz-danger-bg)] p-3 rounded-xl border border-[var(--kz-danger-border)] text-[var(--kz-danger-text)]">
          <p className="font-semibold">Documentos e coleções que serão apagados:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong>{allLeadsCount ?? totalLeadsCount} leads</strong> (coleção{' '}
              <code className="font-mono">leads</code>)
            </li>
            <li>
              <strong>{allNichesCount ?? niches.length} nichos/campanhas</strong> (coleção{' '}
              <code className="font-mono">niches</code>)
            </li>
            <li>
              <strong>{importedSheetsCount} registros</strong> de histórico (coleção{' '}
              <code className="font-mono">importedSheets</code>)
            </li>
          </ul>
          <p className="text-[11px] pt-1">
            <strong>Último backup neste navegador:</strong>{' '}
            {lastBackupAt
              ? new Date(lastBackupAt).toLocaleString('pt-BR')
              : 'Nenhum registrado — recomenda-se exportar o JSON completo antes de continuar.'}
          </p>
        </div>

        <Input
          label="Para confirmar, digite ZERAR abaixo"
          value={clearConfirmText}
          onChange={(e) => setClearConfirmText(e.target.value)}
          placeholder="Digite ZERAR"
          className="font-mono"
        />

        {clearError && <Alert variant="danger">{clearError}</Alert>}
      </ConfirmDialog>
    </header>
  );
};
