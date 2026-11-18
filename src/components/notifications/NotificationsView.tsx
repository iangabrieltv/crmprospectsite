import React, { useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Check,
  X,
  ArrowUpRight,
  Calendar,
  Wallet,
  CheckSquare,
  Briefcase,
  Settings,
} from 'lucide-react';
import { AppTab } from '../../types/crm';
import {
  NotificationCategory,
  SystemNotification,
  SystemSettings,
} from '../../types/system';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Tabs,
} from '../ui';

interface NotificationsViewProps {
  notifications: SystemNotification[];
  systemSettings: SystemSettings;
  onMarkRead: (notificationId: string) => Promise<void> | void;
  onMarkAllRead: () => Promise<void> | void;
  onDismiss: (notificationId: string) => Promise<void> | void;
  onNavigate: (tab: AppTab) => void;
}

type CategoryFilter = 'all' | NotificationCategory;

function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'agenda':
      return <Calendar className="w-4 h-4" />;
    case 'financeiro':
      return <Wallet className="w-4 h-4" />;
    case 'operacional':
      return <CheckSquare className="w-4 h-4" />;
    case 'comercial':
      return <Briefcase className="w-4 h-4" />;
  }
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  systemSettings,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onNavigate,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [readFilter, setReadFilter] = useState<'unread' | 'all'>('all');

  const activeNotifications = useMemo(
    () => notifications.filter((n) => !n.dismissed),
    [notifications]
  );

  const unreadCount = useMemo(
    () => activeNotifications.filter((n) => !n.read).length,
    [activeNotifications]
  );

  const filtered = useMemo(
    () =>
      activeNotifications.filter((n) => {
        if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
        if (readFilter === 'unread' && n.read) return false;
        return true;
      }),
    [activeNotifications, categoryFilter, readFilter]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
        <div className="space-y-1">
          <h2 className="kz-page-title">Central de Notificações</h2>
          <p className="kz-subtitle">
            Alertas reais consolidados do Comercial, Projetos, Tarefas, Agenda e Financeiro — deduplicados e governados pelas suas preferências.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Settings className="w-3.5 h-3.5" />}
            onClick={() => onNavigate('settings')}
          >
            Preferências
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={unreadCount === 0}
            leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
            onClick={onMarkAllRead}
          >
            Marcar Todas como Lidas ({unreadCount})
          </Button>
        </div>
      </div>

      {!systemSettings.preferences.enableNotifications && (
        <Alert
          variant="warning"
          title="Notificações silenciadas nas Configurações"
        >
          Você desativou a geração de notificações na aba Preferências em Configurações. Os alertas anteriores não são exibidos enquanto a opção estiver desligada.
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <Tabs<CategoryFilter>
          activeId={categoryFilter}
          onChange={setCategoryFilter}
          items={[
            { id: 'all', label: 'Todas', badge: activeNotifications.length },
            {
              id: 'comercial',
              label: 'Comercial',
              badge: activeNotifications.filter((n) => n.category === 'comercial').length,
            },
            {
              id: 'operacional',
              label: 'Operacional',
              badge: activeNotifications.filter((n) => n.category === 'operacional').length,
            },
            {
              id: 'financeiro',
              label: 'Financeiro',
              badge: activeNotifications.filter((n) => n.category === 'financeiro').length,
            },
            {
              id: 'agenda',
              label: 'Agenda',
              badge: activeNotifications.filter((n) => n.category === 'agenda').length,
            },
          ]}
        />

        <div className="inline-flex items-center gap-1.5">
          <Button
            variant={readFilter === 'all' ? 'primary' : 'outline'}
            size="xs"
            onClick={() => setReadFilter('all')}
          >
            Todas ({activeNotifications.length})
          </Button>
          <Button
            variant={readFilter === 'unread' ? 'primary' : 'outline'}
            size="xs"
            onClick={() => setReadFilter('unread')}
          >
            Não lidas ({unreadCount})
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-5 h-5" />}
          title={
            readFilter === 'unread'
              ? 'Nenhuma notificação não lida nesta categoria'
              : 'Nenhuma notificação ativa no momento'
          }
          description="Quando houver vencimentos financeiros, retornos na agenda, tarefas críticas ou propostas aguardando acompanhamento, os alertas aparecerão aqui."
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((n) => (
            <Card
              key={n.id}
              padding="md"
              className={`transition-colors ${
                !n.read
                  ? 'border-[var(--kz-accent-border)] bg-[var(--kz-bg-surface)]'
                  : 'opacity-80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      n.severity === 'danger'
                        ? 'bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)]'
                        : n.severity === 'warning'
                        ? 'bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)]'
                        : 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)]'
                    }`}
                  >
                    {getCategoryIcon(n.category)}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-[var(--kz-accent)] shrink-0" />
                      )}
                      <span className="text-xs font-bold text-[var(--kz-text-primary)]">
                        {n.title}
                      </span>
                      <Badge
                        variant={
                          n.severity === 'danger'
                            ? 'danger'
                            : n.severity === 'warning'
                            ? 'warning'
                            : 'info'
                        }
                        size="sm"
                      >
                        {n.category}
                      </Badge>
                      {n.dueLabel && (
                        <span className="text-[11px] font-mono text-[var(--kz-text-muted)]">
                          {n.dueLabel}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[var(--kz-text-secondary)]">
                      {n.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="xs"
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                      onClick={() => onMarkRead(n.id)}
                    >
                      Marcar lida
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="xs"
                    rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                    onClick={() => {
                      if (!n.read) onMarkRead(n.id);
                      onNavigate(n.targetTab);
                    }}
                  >
                    Abrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onDismiss(n.id)}
                    title="Dispensar notificação"
                    className="text-[var(--kz-text-muted)] hover:text-[var(--kz-danger-text)]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
