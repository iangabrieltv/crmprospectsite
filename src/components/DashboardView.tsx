import React, { useMemo, useState } from 'react';
import {
  Lead,
  NicheCampaign,
  FUNNEL_STAGES,
  AppTab,
  normalizeStageId,
} from '../types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  SocialPost,
  Task,
} from '../types/kaizen';
import { FinancialEntry, FinancialTransaction } from '../types/finance';
import { computeDashboardMetrics, toLocalDateString } from '../utils/dashboardMetrics';
import { computeTaskSummary } from '../services/taskService';
import { formatBrlFromCents } from '../services/finance';
import {
  Send,
  Calendar,
  CheckCircle2,
  CheckSquare,
  DollarSign,
  FolderKanban,
  Users,
  Clock,
  Sparkles,
  Award,
  PhoneCall,
  ArrowRight,
  Share2,
  TrendingUp,
  Layers,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Tabs,
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui';

interface DashboardViewProps {
  niche: NicheCampaign;
  leads: Lead[];
  allLeads?: Lead[];
  clients?: Client[];
  projects?: Project[];
  tasks?: Task[];
  agendaEvents?: AgendaEvent[];
  socialPosts?: SocialPost[];
  financialEntries?: FinancialEntry[];
  financialTransactions?: FinancialTransaction[];
  nichesCount?: number;
  onNavigate?: (tab: AppTab) => void;
  onOpenLeadModal?: (lead: Lead) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  niche,
  leads,
  allLeads,
  clients,
  projects = [],
  tasks = [],
  agendaEvents = [],
  socialPosts = [],
  financialEntries = [],
  financialTransactions = [],
  nichesCount = 1,
  onNavigate,
  onOpenLeadModal,
}) => {
  const [scope, setScope] = useState<'niche' | 'agency'>('niche');
  const effectiveLeads = scope === 'agency' && allLeads ? allLeads : leads;
  const effectiveClients = useMemo(() => {
    if (clients === undefined) return undefined;
    if (scope === 'agency') return clients;
    return clients.filter((c) => !c.originNicheId || c.originNicheId === niche.id);
  }, [clients, scope, niche.id]);

  const { kpis, pendingActivities, upcomingMeetings } = useMemo(
    () =>
      computeDashboardMetrics(
        effectiveLeads,
        undefined,
        effectiveClients,
        financialEntries,
        financialTransactions
      ),
    [effectiveLeads, effectiveClients, financialEntries, financialTransactions]
  );

  const stage3Summary = useMemo(() => {
    const todayStr = toLocalDateString(new Date());
    const activeProjects = projects.filter(
      (p) => p.status !== 'concluido' && p.status !== 'cancelado'
    ).length;
    const completedProjects = projects.filter((p) => p.status === 'concluido').length;
    const taskStats = computeTaskSummary(tasks, todayStr);
    const todayAgendaEvents = agendaEvents.filter(
      (e) => e.status === 'agendado' && e.date === todayStr
    ).length;
    const next7Date = new Date();
    next7Date.setDate(next7Date.getDate() + 7);
    const next7Str = toLocalDateString(next7Date);
    const upcomingAgendaEvents = agendaEvents.filter(
      (e) => e.status === 'agendado' && e.date >= todayStr && e.date <= next7Str
    ).length;
    const socialInPipeline = socialPosts.filter((p) => p.status !== 'publicado').length;
    const socialApprovedAwaitingConfirm = socialPosts.filter(
      (p) => p.status === 'aprovado'
    ).length;
    return {
      activeProjects,
      completedProjects,
      taskStats,
      todayAgendaEvents,
      upcomingAgendaEvents,
      socialInPipeline,
      socialApprovedAwaitingConfirm,
    };
  }, [projects, tasks, agendaEvents, socialPosts]);

  const totalScopeLeads = effectiveLeads.length;
  const targetMrrPercent =
    scope === 'niche' && niche.targetMrr > 0
      ? Math.min(100, Math.round((kpis.monthlyRevenueMrr / niche.targetMrr) * 100))
      : 0;

  // A/B Script Performance Matrix (preserved real analytics)
  const scriptStats = useMemo(() => {
    const map: Record<
      string,
      {
        id: string;
        title: string;
        totalUsed: number;
        interested: number;
        closed: number;
        conversionRate: number;
        revenueSetup: number;
        revenueMrr: number;
      }
    > = {};

    Object.values(niche.scripts).forEach((s) => {
      map[s.id] = {
        id: s.id,
        title: s.title,
        totalUsed: 0,
        interested: 0,
        closed: 0,
        conversionRate: 0,
        revenueSetup: 0,
        revenueMrr: 0,
      };
    });

    effectiveLeads.forEach((l) => {
      if (l.scriptUsed && l.scriptUsed !== 'none' && map[l.scriptUsed]) {
        const s = map[l.scriptUsed];
        s.totalUsed++;
        const st = normalizeStageId(l.stage);
        if (st === 'reuniao_marcada' || st === 'fechado' || l.stage === 'interessado') {
          s.interested++;
        }
        if (st === 'fechado') {
          s.closed++;
          s.revenueSetup += l.creationValue || 0;
          s.revenueMrr += l.monthlyMrr || 0;
        }
      }
    });

    Object.values(map).forEach((s) => {
      s.conversionRate = s.totalUsed > 0 ? (s.closed / s.totalUsed) * 100 : 0;
    });

    const list = Object.values(map);
    const best = [...list].sort(
      (a, b) => b.conversionRate - a.conversionRate || b.closed - a.closed
    )[0];

    return { list, best };
  }, [niche.scripts, effectiveLeads]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* BLOCO 1: VISÃO GERAL */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--kz-border-subtle)] pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{scope === 'niche' ? niche.emoji : '🏢'}</span>
              <h2 className="kz-page-title">
                {scope === 'niche'
                  ? `Visão Geral — ${niche.name}`
                  : 'Visão Geral Consolidada da Agência'}
              </h2>
            </div>
            <p className="kz-subtitle">
              {scope === 'niche'
                ? `Acompanhamento comercial, agenda imediata e conversão do funil para ${niche.segment}.`
                : `Indicadores consolidados de todas as ${nichesCount} campanhas ativas do Kaizen.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {allLeads && nichesCount > 1 && (
              <Tabs
                activeId={scope}
                onChange={setScope}
                items={[
                  { id: 'niche', label: 'Nicho Ativo' },
                  { id: 'agency', label: `Agência (${nichesCount})` },
                ]}
              />
            )}

            {scope === 'niche' && (
              <Card padding="sm" className="min-w-[240px]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[11px] font-medium text-[var(--kz-text-muted)]">
                    Meta MRR do Nicho
                  </span>
                  <span className="font-mono font-bold text-[var(--kz-text-primary)]">
                    R$ {kpis.monthlyRevenueMrr.toLocaleString('pt-BR')} / R${' '}
                    {niche.targetMrr.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--kz-bg-subtle)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--kz-success-solid)] rounded-full transition-all duration-500"
                    style={{ width: `${targetMrrPercent}%` }}
                  />
                </div>
                <div className="text-right text-[10px] font-mono text-[var(--kz-success-text)] font-semibold mt-1">
                  {targetMrrPercent}% da meta atingida
                </div>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* BLOCO 2: INDICADORES COMERCIAIS (Exatamente os 8 cards solicitados) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="kz-section-title">Indicadores Comerciais</h3>
            <p className="text-xs text-[var(--kz-text-muted)]">
              Métricas reais de execução comercial, reuniões, fechamentos e status dos módulos integrados.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Leads contatados hoje */}
          <Card padding="sm" className="flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
              <span>Leads contatados hoje</span>
              <Send className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
              {kpis.contactedToday}
            </div>
            <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
              Abordagens registradas na data de hoje
            </div>
          </Card>

          {/* 2. Total de leads contatados */}
          <Card padding="sm" className="flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-[var(--kz-accent-text)] flex items-center justify-between">
              <span>Total de leads contatados</span>
              <TrendingUp className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-accent-text)]">
              {kpis.totalContacted}
            </div>
            <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
              Taxa de resposta: {kpis.responseRatePercent}%
            </div>
          </Card>

          {/* 3. Leads interessados */}
          <Card padding="sm" className="flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
              <span>Leads interessados</span>
              <Sparkles className="w-3.5 h-3.5 text-[var(--kz-info-solid)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-info-text)]">
              {kpis.interestedLeads}
            </div>
            <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
              Em follow-up ativo ou avanço comercial
            </div>
          </Card>

          {/* 4. Reuniões agendadas */}
          <Card padding="sm" className="flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-[var(--kz-success-text)] flex items-center justify-between">
              <span>Reuniões agendadas</span>
              <Calendar className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-success-text)]">
              {kpis.scheduledMeetings}
            </div>
            <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
              Demonstrações e alinhamentos ativos
            </div>
          </Card>

          {/* 5. Fechamentos */}
          <Card padding="sm" className="flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
              <span>Fechamentos</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-success-text)]">
              {kpis.closedDeals}
            </div>
            <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
              + R$ {kpis.totalSetupRevenue.toLocaleString('pt-BR')} em setup
            </div>
          </Card>

          {/* 6. Clientes ativos (Módulo Clientes ativo na Etapa 2) */}
          <Card
            padding="sm"
            onClick={
              kpis.activeClientsConfigured && onNavigate
                ? () => onNavigate('clients')
                : undefined
            }
            className={`flex flex-col justify-between ${
              kpis.activeClientsConfigured
                ? onNavigate
                  ? 'cursor-pointer hover:border-[var(--kz-accent-border)] transition-colors'
                  : ''
                : 'bg-[var(--kz-bg-surface)] border-dashed border-[var(--kz-border-default)]'
            }`}
          >
            <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
              <span>Clientes ativos</span>
              <Users
                className={`w-3.5 h-3.5 ${
                  kpis.activeClientsConfigured
                    ? 'text-[var(--kz-accent)]'
                    : 'text-[var(--kz-text-subtle)]'
                }`}
              />
            </div>
            {kpis.activeClientsConfigured ? (
              <>
                <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
                  {kpis.activeClientsCount ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-[var(--kz-text-muted)] font-mono">
                  {kpis.onboardingClientsCount} onboarding · R${' '}
                  {kpis.activeClientsMrr.toLocaleString('pt-BR')}/mês
                </div>
              </>
            ) : (
              <>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--kz-text-secondary)]">
                    Não configurado
                  </span>
                  <Badge variant="neutral" size="sm">
                    Etapa 2
                  </Badge>
                </div>
                <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
                  Módulo de Clientes em desenvolvimento
                </div>
              </>
            )}
          </Card>

          {/* 7. Receita mensal (Módulo Financeiro real + MRR contratado) */}
          <Card
            padding="sm"
            onClick={onNavigate ? () => onNavigate('finance') : undefined}
            className={`flex flex-col justify-between ${
              onNavigate
                ? 'cursor-pointer hover:border-[var(--kz-accent-border)] transition-colors'
                : ''
            }`}
          >
            <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
              <span>Receita mensal</span>
              <DollarSign className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-success-text)]">
              {kpis.monthlyRealizedRevenueCents > 0
                ? formatBrlFromCents(kpis.monthlyRealizedRevenueCents)
                : `R$ ${kpis.monthlyRevenueMrr.toLocaleString('pt-BR')}`}
            </div>
            <div className="mt-1 text-[11px] text-[var(--kz-text-muted)] font-mono">
              {kpis.monthlyRealizedRevenueCents > 0
                ? `Recebido no mês · MRR R$ ${kpis.monthlyRevenueMrr.toLocaleString('pt-BR')}`
                : kpis.openReceivablesCents > 0
                ? `A receber: ${formatBrlFromCents(kpis.openReceivablesCents)}${
                    kpis.overdueReceivablesCount > 0
                      ? ` (${kpis.overdueReceivablesCount} atras.)`
                      : ''
                  }`
                : 'Financeiro integrado · clique para abrir'}
            </div>
          </Card>

          {/* 8. Follow-ups pendentes */}
          <Card padding="sm" className="flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-[var(--kz-warning-text)] flex items-center justify-between">
              <span>Follow-ups pendentes</span>
              <Clock className="w-3.5 h-3.5 text-[var(--kz-warning-solid)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-warning-text)]">
              {kpis.pendingFollowUps}
            </div>
            <div className="mt-1 text-[11px] text-[var(--kz-text-muted)]">
              {kpis.pendingCallbacksOverdue > 0
                ? `${kpis.pendingCallbacksOverdue} retornos atrasados · ${kpis.pendingCallbacksToday} hoje`
                : `${kpis.pendingCallbacksToday} retornos agendados para hoje`}
            </div>
          </Card>
        </div>
      </section>

      {/* BLOCO 2B: OPERAÇÃO DIÁRIA (ETAPA 3 — DADOS REAIS) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="kz-section-title">Operação Diária (Projetos, Tarefas, Agenda & Social)</h3>
            <p className="text-xs text-[var(--kz-text-muted)]">
              Indicadores consolidados em tempo real dos módulos operacionais integrados.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card
            padding="sm"
            onClick={onNavigate ? () => onNavigate('projects') : undefined}
            className={`flex flex-col justify-between ${
              onNavigate ? 'cursor-pointer hover:border-[var(--kz-accent-border)] transition-colors' : ''
            }`}
          >
            <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
              <span>Projetos ativos</span>
              <FolderKanban className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
              {stage3Summary.activeProjects}
            </div>
            <div className="mt-1 text-[11px] text-[var(--kz-text-muted)] font-mono">
              {projects.length} total · {stage3Summary.completedProjects} concluídos
            </div>
          </Card>

          <Card
            padding="sm"
            onClick={onNavigate ? () => onNavigate('tasks') : undefined}
            className={`flex flex-col justify-between ${
              onNavigate ? 'cursor-pointer hover:border-[var(--kz-accent-border)] transition-colors' : ''
            }`}
          >
            <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
              <span>Minhas tarefas abertas</span>
              <CheckSquare className="w-3.5 h-3.5 text-[var(--kz-info-solid)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
              {stage3Summary.taskStats.openCount}
            </div>
            <div className="mt-1 text-[11px] font-mono">
              {stage3Summary.taskStats.overdueCount > 0 ? (
                <span className="text-[var(--kz-danger-text)] font-semibold">
                  {stage3Summary.taskStats.overdueCount} atrasadas · {stage3Summary.taskStats.todayCount} hoje
                </span>
              ) : (
                <span className="text-[var(--kz-text-muted)]">
                  {stage3Summary.taskStats.todayCount} hoje · {stage3Summary.taskStats.completedCount} concluídas
                </span>
              )}
            </div>
          </Card>

          <Card
            padding="sm"
            onClick={onNavigate ? () => onNavigate('agenda') : undefined}
            className={`flex flex-col justify-between ${
              onNavigate ? 'cursor-pointer hover:border-[var(--kz-accent-border)] transition-colors' : ''
            }`}
          >
            <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
              <span>Compromissos (Agenda Integrada)</span>
              <Calendar className="w-3.5 h-3.5 text-[var(--kz-success-solid)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
              {stage3Summary.upcomingAgendaEvents + upcomingMeetings.length}
            </div>
            <div className="mt-1 text-[11px] text-[var(--kz-text-muted)] font-mono">
              {stage3Summary.todayAgendaEvents} eventos diretos hoje · próx. 7 dias
            </div>
          </Card>

          <Card
            padding="sm"
            onClick={onNavigate ? () => onNavigate('social') : undefined}
            className={`flex flex-col justify-between ${
              onNavigate ? 'cursor-pointer hover:border-[var(--kz-accent-border)] transition-colors' : ''
            }`}
          >
            <div className="text-[11px] font-semibold text-[var(--kz-text-muted)] flex items-center justify-between">
              <span>Conteúdos em produção</span>
              <Share2 className="w-3.5 h-3.5 text-[var(--kz-accent)]" />
            </div>
            <div className="mt-2.5 text-2xl kz-metric text-[var(--kz-text-primary)]">
              {stage3Summary.socialInPipeline}
            </div>
            <div className="mt-1 text-[11px] text-[var(--kz-text-muted)] font-mono">
              {stage3Summary.socialApprovedAwaitingConfirm > 0
                ? `${stage3Summary.socialApprovedAwaitingConfirm} aprovados aguard. publicação`
                : `${socialPosts.length} publicações registradas`}
            </div>
          </Card>
        </div>
      </section>

      {/* BLOCO 3: ATIVIDADES E PENDÊNCIAS + PRÓXIMOS COMPROMISSOS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Atividades e pendências */}
        <Card padding="md" className="space-y-4">
          <CardHeader>
            <div>
              <CardTitle>Atividades e Pendências</CardTitle>
              <CardDescription>
                Retornos agendados e leads sem resposta há mais de 48 horas.
              </CardDescription>
            </div>
            {onNavigate && (
              <Button
                variant="ghost"
                size="xs"
                rightIcon={<ArrowRight className="w-3 h-3" />}
                onClick={() => onNavigate('agenda')}
              >
                Ver Agenda
              </Button>
            )}
          </CardHeader>

          {pendingActivities.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--kz-text-muted)] bg-[var(--kz-bg-subtle)]/40 rounded-xl border border-dashed border-[var(--kz-border-default)]">
              Nenhuma pendência imediata ou retorno atrasado no momento.
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto kanban-column-scroll pr-1">
              {pendingActivities.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  onClick={() =>
                    onOpenLeadModal ? onOpenLeadModal(item.lead) : onNavigate?.('agenda')
                  }
                  className="p-3 rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-subtle)]/50 hover:bg-[var(--kz-bg-subtle)] hover:border-[var(--kz-border-default)] transition-colors flex items-start justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        item.kind === 'callback_overdue'
                          ? 'bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)]'
                          : item.kind === 'callback_today'
                          ? 'bg-[var(--kz-warning-bg)] text-[var(--kz-warning-text)]'
                          : 'bg-[var(--kz-bg-subtle)] text-[var(--kz-text-muted)]'
                      }`}
                    >
                      {item.kind === 'inactive_48h' ? (
                        <Clock className="w-3.5 h-3.5" />
                      ) : (
                        <PhoneCall className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--kz-text-primary)] truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  {item.dateLabel && (
                    <Badge
                      variant={
                        item.kind === 'callback_overdue'
                          ? 'danger'
                          : item.kind === 'callback_today'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {item.dateLabel}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Próximos compromissos */}
        <Card padding="md" className="space-y-4">
          <CardHeader>
            <div>
              <CardTitle>Próximos Compromissos</CardTitle>
              <CardDescription>
                Reuniões agendadas no CRM (sincronização Google Calendar em etapa futura).
              </CardDescription>
            </div>
            {onNavigate && (
              <Button
                variant="ghost"
                size="xs"
                rightIcon={<ArrowRight className="w-3 h-3" />}
                onClick={() => onNavigate('agenda')}
              >
                Abrir Agenda
              </Button>
            )}
          </CardHeader>

          {upcomingMeetings.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--kz-text-muted)] bg-[var(--kz-bg-subtle)]/40 rounded-xl border border-dashed border-[var(--kz-border-default)]">
              Nenhuma reunião comercial agendada até o momento.
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto kanban-column-scroll pr-1">
              {upcomingMeetings.slice(0, 8).map((meeting) => (
                <div
                  key={meeting.id}
                  onClick={() =>
                    onOpenLeadModal ? onOpenLeadModal(meeting.lead) : onNavigate?.('agenda')
                  }
                  className="p-3 rounded-xl border border-[var(--kz-border-subtle)] bg-[var(--kz-bg-subtle)]/50 hover:bg-[var(--kz-bg-subtle)] hover:border-[var(--kz-border-default)] transition-colors flex items-start justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[var(--kz-success-bg)] text-[var(--kz-success-text)] flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--kz-text-primary)] truncate">
                        {meeting.lead.companyName}
                      </div>
                      <div className="text-[11px] text-[var(--kz-text-muted)] truncate">
                        {meeting.notes ||
                          meeting.lead.contactName ||
                          'Apresentação de proposta / site'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <Badge
                      variant={
                        meeting.isOverdue
                          ? 'danger'
                          : meeting.isToday
                          ? 'success'
                          : 'info'
                      }
                      size="sm"
                    >
                      {meeting.isToday
                        ? `Hoje · ${meeting.time}`
                        : `${meeting.date.split('-').reverse().join('/')} · ${meeting.time}`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* BLOCO 4: RESUMO DE DESEMPENHO (Funil + Matriz A/B) */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--kz-accent)]" />
          <h3 className="kz-section-title">Resumo de Desempenho</h3>
        </div>

        {/* Stepped Visual Conversion Funnel */}
        <Card padding="lg" className="space-y-4">
          <CardHeader>
            <div>
              <CardTitle>Funil Sequencial de Prospecção e Vendas</CardTitle>
              <CardDescription>
                Distribuição do pipeline ao longo das {FUNNEL_STAGES.length} etapas comerciais.
              </CardDescription>
            </div>
            <Badge variant="neutral" size="md">
              {FUNNEL_STAGES.length} Etapas Monitoradas
            </Badge>
          </CardHeader>

          <div className="space-y-3 pt-1">
            {FUNNEL_STAGES.map((stage) => {
              const stageLeads = effectiveLeads.filter(
                (l) => normalizeStageId(l.stage) === stage.id
              );
              const count = stageLeads.length;
              const percentOfTotal =
                totalScopeLeads > 0 ? (count / totalScopeLeads) * 100 : 0;
              const stageSetup = stageLeads.reduce(
                (acc, l) => acc + (l.creationValue || 0),
                0
              );
              const stageMrr = stageLeads.reduce((acc, l) => acc + (l.monthlyMrr || 0), 0);

              return (
                <div key={stage.id} className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-[var(--kz-text-primary)]">
                        {stage.name}
                      </span>
                      <span className="text-[var(--kz-text-subtle)] text-[11px] hidden md:inline">
                        · {stage.description}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                      {(stageSetup > 0 || stageMrr > 0) && (
                        <span className="text-[var(--kz-text-muted)] text-[11px] hidden sm:inline">
                          {stageSetup > 0
                            ? `Setup: R$ ${stageSetup.toLocaleString('pt-BR')}`
                            : ''}
                          {stageMrr > 0
                            ? ` · MRR: R$ ${stageMrr.toLocaleString('pt-BR')}/mês`
                            : ''}
                        </span>
                      )}
                      <span className="font-bold text-[var(--kz-text-primary)] w-16 text-right">
                        {count}
                      </span>
                      <span className="text-[var(--kz-text-muted)] text-[11px] w-12 text-right">
                        {percentOfTotal.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2.5 bg-[var(--kz-bg-subtle)] rounded-md overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-300 ${
                        stage.id === 'fechado'
                          ? 'bg-emerald-500'
                          : stage.id === 'reuniao_marcada'
                          ? 'bg-[#C6A15B]'
                          : stage.id === 'follow_up_2'
                          ? 'bg-indigo-400/80'
                          : stage.id === 'follow_up_1'
                          ? 'bg-violet-400/80'
                          : stage.id === 'nao_atendida'
                          ? 'bg-amber-400/80'
                          : stage.id === 'mandei_mensagem'
                          ? 'bg-cyan-400/80'
                          : stage.id === 'primeiro_contato'
                          ? 'bg-sky-400/80'
                          : 'bg-zinc-500/70'
                      }`}
                      style={{
                        width: `${Math.max(count > 0 ? 3 : 0, percentOfTotal)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* A/B Script Performance Matrix */}
        <Card padding="lg" className="space-y-4">
          <CardHeader>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Matriz de Performance A/B dos Scripts</CardTitle>
                {scriptStats.best && scriptStats.best.closed > 0 && (
                  <Badge variant="accent" size="md">
                    <Award className="w-3 h-3" />
                    Campeão: {scriptStats.best.title.split('—')[0].trim()}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Compara disparos, interessados, fechamentos e receita gerada por roteiro.
              </CardDescription>
            </div>
          </CardHeader>

          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Script de Prospecção</TableHead>
                  <TableHead className="text-right">Disparados</TableHead>
                  <TableHead className="text-right">Interessados</TableHead>
                  <TableHead className="text-right">Fechamentos</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                  <TableHead className="text-right">Setup Gerado</TableHead>
                  <TableHead className="text-right">MRR Recorrente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono tabular-nums">
                {scriptStats.list.map((s) => {
                  const isChampion =
                    scriptStats.best && scriptStats.best.id === s.id && s.closed > 0;
                  return (
                    <TableRow
                      key={s.id}
                      className={isChampion ? 'bg-[var(--kz-accent-soft)] font-semibold' : ''}
                    >
                      <TableCell className="font-sans font-medium text-[var(--kz-text-primary)]">
                        <div className="flex items-center gap-2">
                          {isChampion && (
                            <Award className="w-4 h-4 text-[var(--kz-accent)] shrink-0" />
                          )}
                          <span>{s.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{s.totalUsed}</TableCell>
                      <TableCell className="text-right text-[var(--kz-warning-text)]">
                        {s.interested}
                      </TableCell>
                      <TableCell className="text-right text-[var(--kz-success-text)] font-bold">
                        {s.closed}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            s.conversionRate >= 15
                              ? 'success'
                              : s.conversionRate > 0
                              ? 'accent'
                              : 'neutral'
                          }
                        >
                          {s.conversionRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {s.revenueSetup.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right text-[var(--kz-success-text)] font-bold">
                        R$ {s.revenueMrr.toLocaleString('pt-BR')}/mês
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </section>
    </div>
  );
};
