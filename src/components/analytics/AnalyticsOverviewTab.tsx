import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckSquare,
  Lightbulb,
  Settings,
  Share2,
  Sliders,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { AppTab } from '../../types/crm';
import {
  AnalyticsPreferences,
  AnalyticsSubTabId,
  ManagementInsight,
} from '../../types/analytics';
import { ExecutiveDashboardSnapshot } from '../../services/analytics';
import { formatBrlFromCents } from '../../services/finance/money';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from '../ui';
import { AnalyticsKpiCard, DataLimitationBanner } from './AnalyticsCharts';

interface AnalyticsOverviewTabProps {
  snapshot: ExecutiveDashboardSnapshot;
  preferences: AnalyticsPreferences;
  onToggleFavoriteKpi: (kpiId: string) => void;
  onSelectSubTab: (subTab: AnalyticsSubTabId) => void;
  onNavigateTab: (tab: AppTab) => void;
  onOpenSettings: () => void;
}

const INSIGHT_VARIANT: Record<
  ManagementInsight['severity'],
  'success' | 'warning' | 'danger' | 'info'
> = {
  positive: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

const INSIGHT_LABEL: Record<ManagementInsight['severity'], string> = {
  positive: 'Positivo',
  warning: 'Atenção',
  danger: 'Crítico',
  info: 'Observação',
};

export const AnalyticsOverviewTab: React.FC<AnalyticsOverviewTabProps> = ({
  snapshot,
  preferences,
  onToggleFavoriteKpi,
  onSelectSubTab,
  onNavigateTab,
  onOpenSettings,
}) => {
  const { period, commercial, financial, operational, clients, social, productivity } =
    snapshot;

  const favoriteIds = new Set(preferences.favoriteKpis);
  const favoriteItems = snapshot.kpiCatalogItems.filter((item) => favoriteIds.has(item.id));
  const displayedFavorites =
    favoriteItems.length > 0 ? favoriteItems : snapshot.kpiCatalogItems.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* KPIs Favoritos */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="kz-section-title flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--kz-accent)]" />
              Indicadores Principais ({displayedFavorites.length})
            </h3>
            <p className="text-xs text-[var(--kz-text-muted)]">
              Janela ativa: <strong>{period.label}</strong> vs comparativo{' '}
              <strong>{period.previousLabel}</strong>. Clique em qualquer card para aprofundar.
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            leftIcon={<Settings className="w-3.5 h-3.5" />}
            onClick={onOpenSettings}
          >
            Personalizar KPIs
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayedFavorites.map((kpi) => {
            const tone =
              kpi.id === 'inadimplencia' && financial.current.delinquencyCents > 0
                ? 'danger'
                : kpi.id === 'lucro_realizado'
                ? financial.current.realizedProfitCents >= 0
                  ? 'success'
                  : 'danger'
                : kpi.id === 'receita_realizada'
                ? 'accent'
                : 'default';

            return (
              <AnalyticsKpiCard
                key={kpi.id}
                label={kpi.label}
                value={kpi.formattedValue}
                subtitle={kpi.subtitle}
                deltaText={kpi.deltaText}
                deltaPositive={kpi.deltaPositive}
                tone={tone}
                compact={preferences.compactTables}
                isFavorite={favoriteIds.has(kpi.id)}
                onToggleFavorite={() => onToggleFavoriteKpi(kpi.id)}
                onClick={() => onSelectSubTab(kpi.targetSubTab)}
              />
            );
          })}
        </div>
      </div>

      {/* Painel Executivo das 4 Áreas da Agência */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Financeiro Realizado vs Previsto */}
        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[var(--kz-accent)]" />
              <div>
                <CardTitle>Financeiro — Realizado vs Previsto</CardTitle>
                <CardDescription>Mesma base oficial do módulo Financeiro</CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="xs"
              rightIcon={<ArrowRight className="w-3 h-3" />}
              onClick={() => onSelectSubTab('financeiro')}
            >
              Detalhar
            </Button>
          </CardHeader>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Receita Realizada
              </span>
              <span className="text-base kz-metric text-[var(--kz-success-text)]">
                {formatBrlFromCents(financial.current.receivedRevenueCents)}
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                Previsto: {formatBrlFromCents(financial.current.predictedRevenueCents)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Despesa Paga
              </span>
              <span className="text-base kz-metric text-[var(--kz-text-primary)]">
                {formatBrlFromCents(financial.current.paidExpensesCents)}
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                Previsto: {formatBrlFromCents(financial.current.predictedExpensesCents)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Saldo de Caixa Atual
              </span>
              <span className="text-base kz-metric text-[var(--kz-text-primary)]">
                {formatBrlFromCents(financial.current.cashBalanceCents)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                A Receber / Inadimplência
              </span>
              <span className="text-base kz-metric text-[var(--kz-accent-text)]">
                {formatBrlFromCents(financial.current.accountsReceivableCents)}
              </span>
              <span className="text-[10px] text-[var(--kz-danger-text)] block mt-0.5">
                Vencido: {formatBrlFromCents(financial.current.delinquencyCents)}
              </span>
            </div>
          </div>
        </Card>

        {/* Comercial & Propostas */}
        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--kz-accent)]" />
              <div>
                <CardTitle>Comercial — CRM & Propostas</CardTitle>
                <CardDescription>Conversões com amostra explícita</CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="xs"
              rightIcon={<ArrowRight className="w-3 h-3" />}
              onClick={() => onSelectSubTab('comercial')}
            >
              Detalhar
            </Button>
          </CardHeader>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Leads no Período
              </span>
              <span className="text-base kz-metric text-[var(--kz-text-primary)]">
                {commercial.leadsCreatedInPeriod}
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                Contatados no período: {commercial.leadsContactedInPeriod}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Reuniões (Período)
              </span>
              <span className="text-base kz-metric text-[var(--kz-text-primary)]">
                {commercial.meetingsScheduledInPeriod}
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                Realizadas/concluídas: {commercial.meetingsRealizedInPeriod}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Propostas Convertidas
              </span>
              <span className="text-base kz-metric text-[var(--kz-success-text)]">
                {commercial.proposalsApprovedOrSignedInPeriod}
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                Aprovação: {commercial.conversions.proposalApprovalRate.ratioText}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Em Negociação (Aberto)
              </span>
              <span className="text-base kz-metric text-[var(--kz-accent-text)]">
                {commercial.proposalsOpenPipelineCount} doc(s)
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                MRR aberto: R$ {commercial.proposalsOpenPipelineMrr.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </Card>

        {/* Projetos, Tarefas e Clientes */}
        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[var(--kz-accent)]" />
              <div>
                <CardTitle>Operação — Projetos, Tarefas & Carteira</CardTitle>
                <CardDescription>Saúde de entregas e carteira ativa</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="xs" onClick={() => onSelectSubTab('projetos')}>
                Projetos
              </Button>
              <Button variant="ghost" size="xs" onClick={() => onSelectSubTab('operacional')}>
                Tarefas
              </Button>
            </div>
          </CardHeader>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block flex items-center gap-1">
                <Users className="w-3 h-3" /> Clientes Ativos + Onb.
              </span>
              <span className="text-base kz-metric text-[var(--kz-text-primary)]">
                {clients.activeCount + clients.onboardingCount}
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                MRR contratado: R$ {clients.totalActiveContractedMrr.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Projetos Ativos
              </span>
              <span className="text-base kz-metric text-[var(--kz-text-primary)]">
                {operational.projects.activeCount}
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                Progresso médio: {operational.projects.avgProgressPct}% · Atrasados:{' '}
                {operational.projects.overdueActiveCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block flex items-center gap-1">
                <CheckSquare className="w-3 h-3" /> Tarefas Abertas / Atrasadas
              </span>
              <span className="text-base kz-metric text-[var(--kz-text-primary)]">
                {operational.tasks.openCount}{' '}
                <span className="text-xs text-[var(--kz-danger-text)]">
                  ({operational.tasks.overdueOpenCount} atras.)
                </span>
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Entregas Concluídas (Período)
              </span>
              <span className="text-base kz-metric text-[var(--kz-success-text)]">
                {operational.tasks.completedInPeriod} tarefas
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                {operational.projects.completedInPeriod} projeto(s) concluído(s)
              </span>
            </div>
          </div>
        </Card>

        {/* Redes Sociais & Produtividade */}
        <Card padding="md" className="space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[var(--kz-accent)]" />
              <div>
                <CardTitle>Editorial & Produtividade</CardTitle>
                <CardDescription>Execução diária e calendário de conteúdo</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="xs" onClick={() => onSelectSubTab('redes_sociais')}>
                Social
              </Button>
              <Button variant="ghost" size="xs" onClick={() => onSelectSubTab('produtividade')}>
                Produtividade
              </Button>
            </div>
          </CardHeader>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Posts Publicados (Período)
              </span>
              <span className="text-base kz-metric text-[var(--kz-text-primary)]">
                {social.publishedInPeriodCount}
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                Planejados: {social.plannedInPeriodCount} · Atrasados:{' '}
                {social.overduePlannedCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Consistência de Execução
              </span>
              <span className="text-base kz-metric text-[var(--kz-accent-text)]">
                {productivity.consistencyRatePct}%
              </span>
              <span className="text-[10px] text-[var(--kz-text-muted)] block mt-0.5">
                {productivity.activeDaysCount} dia(s) ativo(s) de {period.daysCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Média Tarefas / Dia
              </span>
              <span className="text-base kz-metric text-[var(--kz-text-primary)]">
                {productivity.tasksCompletedPerDayAvg}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)]">
              <span className="text-[11px] text-[var(--kz-text-muted)] block">
                Relatórios Personalizados
              </span>
              <Button
                variant="outline"
                size="xs"
                className="mt-1.5"
                leftIcon={<Sliders className="w-3 h-3" />}
                onClick={() => onSelectSubTab('personalizados')}
              >
                Abrir Construtor
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Inteligência de Gestão */}
      <Card padding="lg" className="space-y-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[var(--kz-accent)]" />
            <div>
              <CardTitle>Inteligência de Gestão — Diagnósticos Baseados em Dados Reais</CardTitle>
              <CardDescription>
                Leituras automáticas auditáveis com citação explícita da amostra de cada módulo.
              </CardDescription>
            </div>
          </div>
          <Badge variant="accent" size="md">
            {snapshot.insights.length} leitura(s) ativa(s)
          </Badge>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {snapshot.insights.map((insight) => (
            <div
              key={insight.id}
              className="p-3.5 rounded-xl bg-[var(--kz-bg-canvas)] border border-[var(--kz-border-subtle)] flex flex-col justify-between gap-2.5"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={INSIGHT_VARIANT[insight.severity]} dot>
                    {INSIGHT_LABEL[insight.severity]} · {insight.area.toUpperCase()}
                  </Badge>
                </div>
                <h4 className="text-xs font-bold text-[var(--kz-text-primary)] leading-snug">
                  {insight.title}
                </h4>
                <p className="text-[11px] text-[var(--kz-text-secondary)] leading-relaxed">
                  {insight.evidence}
                </p>
                <p className="text-[10px] font-mono text-[var(--kz-text-muted)]">
                  {insight.sampleDescription}
                </p>
              </div>
              <div className="pt-1">
                <Button
                  variant="ghost"
                  size="xs"
                  rightIcon={<ArrowRight className="w-3 h-3" />}
                  onClick={() => onNavigateTab(insight.targetTab)}
                  className="text-[var(--kz-accent-text)] px-1"
                >
                  {insight.actionLabel}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <DataLimitationBanner
        visible={preferences.showDataLimitationsNotice}
        title="Escopo e Transparência dos Indicadores"
        message="Todos os números desta central consomem diretamente os registros reais do workspace (CRM, Clientes, Propostas, Projetos, Tarefas, Agenda, Redes Sociais e Financeiro). Indicadores sem coleta nativa no sistema — como apontamento de horas e métricas externas de alcance/curtidas — permanecem sinalizados como indisponíveis em vez de serem estimados."
      />
    </div>
  );
};
