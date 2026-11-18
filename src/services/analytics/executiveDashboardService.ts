import { Lead, NicheCampaign } from '../../types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
} from '../../types/kaizen';
import {
  FinancialAuditLog,
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialSettings,
  FinancialTransaction,
} from '../../types/finance';
import { ResourceFile } from '../../types/resources';
import {
  AnalyticsPeriodPreset,
  AnalyticsSubTabId,
  FAVORITE_KPI_CATALOG,
  GeneratedAnalyticsReport,
  ManagementInsight,
  ResolvedAnalyticsPeriod,
} from '../../types/analytics';
import {
  KAIZEN_TIMEZONE,
  formatBrlFromCents,
  formatDateBr,
  getTodayInTimezone,
} from '../finance/money';
import { resolveAnalyticsPeriod } from './periodService';
import {
  CommercialAnalyticsSnapshot,
  computeCommercialAnalytics,
} from './commercialAnalyticsService';
import {
  FinancialAnalyticsSnapshot,
  computeFinancialAnalytics,
} from './financialAnalyticsService';
import {
  OperationalAnalyticsSnapshot,
  computeOperationalAnalytics,
} from './operationalAnalyticsService';
import {
  ClientPortfolioAnalyticsSnapshot,
  computeClientPortfolioAnalytics,
} from './clientPortfolioAnalyticsService';
import {
  SocialAnalyticsSnapshot,
  computeSocialAnalytics,
} from './socialAnalyticsService';
import {
  ProductivityAnalyticsSnapshot,
  computeProductivityAnalytics,
} from './productivityAnalyticsService';
import { buildManagementInsights } from './managementIntelligenceService';

export interface ResolvedFavoriteKpiItem {
  id: string;
  label: string;
  area: 'comercial' | 'financeiro' | 'operacional' | 'clientes' | 'social' | 'produtividade';
  description: string;
  formattedValue: string;
  subtitle: string;
  deltaText?: string;
  deltaPositive?: boolean | null;
  targetSubTab: AnalyticsSubTabId;
}

export interface ExecutiveDashboardSnapshot {
  period: ResolvedAnalyticsPeriod;
  commercial: CommercialAnalyticsSnapshot;
  financial: FinancialAnalyticsSnapshot;
  operational: OperationalAnalyticsSnapshot;
  clients: ClientPortfolioAnalyticsSnapshot;
  social: SocialAnalyticsSnapshot;
  productivity: ProductivityAnalyticsSnapshot;
  insights: ManagementInsight[];
  kpiCatalogItems: ResolvedFavoriteKpiItem[];
}

export function computeExecutiveDashboardSnapshot(params: {
  leads: Lead[];
  niches: NicheCampaign[];
  clients: Client[];
  proposals: ProposalContract[];
  projects: Project[];
  tasks: Task[];
  agendaEvents: AgendaEvent[];
  socialChannels: SocialChannel[];
  socialPosts: SocialPost[];
  financialEntries: FinancialEntry[];
  financialTransactions: FinancialTransaction[];
  financialCategories: FinancialCategory[];
  financialRecurrences: FinancialRecurrence[];
  financialSettings: FinancialSettings;
  financialAuditLogs: FinancialAuditLog[];
  resourceFiles: ResourceFile[];
  preset: AnalyticsPeriodPreset;
  customStart?: string;
  customEnd?: string;
  todayStr?: string;
  nicheIdFilter?: string;
}): ExecutiveDashboardSnapshot {
  const timezone = params.financialSettings.timezone || KAIZEN_TIMEZONE;
  const todayStr = params.todayStr || getTodayInTimezone(timezone);

  const period = resolveAnalyticsPeriod({
    preset: params.preset,
    customStart: params.customStart,
    customEnd: params.customEnd,
    referenceYmd: todayStr,
    timezone,
  });

  const commercial = computeCommercialAnalytics({
    leads: params.leads,
    niches: params.niches,
    proposals: params.proposals,
    agendaEvents: params.agendaEvents,
    period,
    nicheIdFilter: params.nicheIdFilter,
    timezone,
  });

  const financial = computeFinancialAnalytics({
    entries: params.financialEntries,
    transactions: params.financialTransactions,
    categories: params.financialCategories,
    recurrences: params.financialRecurrences,
    settings: params.financialSettings,
    clients: params.clients,
    projects: params.projects,
    period,
    todayStr,
  });

  const operational = computeOperationalAnalytics({
    projects: params.projects,
    tasks: params.tasks,
    clients: params.clients,
    period,
    todayStr,
    timezone,
  });

  const clients = computeClientPortfolioAnalytics({
    clients: params.clients,
    proposals: params.proposals,
    projects: params.projects,
    tasks: params.tasks,
    agendaEvents: params.agendaEvents,
    financialEntries: params.financialEntries,
    financialTransactions: params.financialTransactions,
    period,
    todayStr,
    timezone,
  });

  const social = computeSocialAnalytics({
    channels: params.socialChannels,
    posts: params.socialPosts,
    clients: params.clients,
    period,
    todayStr,
    timezone,
  });

  const productivity = computeProductivityAnalytics({
    tasks: params.tasks,
    projects: params.projects,
    leads: params.leads,
    proposals: params.proposals,
    agendaEvents: params.agendaEvents,
    socialPosts: params.socialPosts,
    financialTransactions: params.financialTransactions,
    financialAuditLogs: params.financialAuditLogs,
    resourceFiles: params.resourceFiles,
    clients: params.clients,
    period,
    todayStr,
    timezone,
  });

  const insights = buildManagementInsights({
    commercial,
    financial,
    operational,
    clients,
    social,
    productivity,
  });

  const deltaNumLabel = (curr: number, prev: number, suffix: string = '') => {
    const diff = curr - prev;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}${suffix} vs anterior (${prev}${suffix})`;
  };

  const kpiValues: Record<string, Omit<ResolvedFavoriteKpiItem, 'id' | 'label' | 'area' | 'description'>> = {
    receita_realizada: {
      formattedValue: formatBrlFromCents(financial.current.receivedRevenueCents),
      subtitle: `Previsto no período: ${formatBrlFromCents(financial.current.predictedRevenueCents)}`,
      deltaText: `${formatBrlFromCents(financial.deltas.receivedRevenueDeltaCents, { signed: true })} vs ant.`,
      deltaPositive:
        financial.deltas.receivedRevenueDeltaCents === 0
          ? null
          : financial.deltas.receivedRevenueDeltaCents > 0,
      targetSubTab: 'financeiro',
    },
    lucro_realizado: {
      formattedValue: formatBrlFromCents(financial.current.realizedProfitCents),
      subtitle: `Saídas pagas: ${formatBrlFromCents(financial.current.paidExpensesCents)}`,
      deltaText: `${formatBrlFromCents(financial.deltas.realizedProfitDeltaCents, { signed: true })} vs ant.`,
      deltaPositive:
        financial.deltas.realizedProfitDeltaCents === 0
          ? null
          : financial.deltas.realizedProfitDeltaCents > 0,
      targetSubTab: 'financeiro',
    },
    contas_a_receber: {
      formattedValue: formatBrlFromCents(financial.current.accountsReceivableCents),
      subtitle: `Caixa atual: ${formatBrlFromCents(financial.current.cashBalanceCents)}`,
      targetSubTab: 'financeiro',
    },
    inadimplencia: {
      formattedValue: formatBrlFromCents(financial.current.delinquencyCents),
      subtitle: `${financial.current.delinquencyCount} título(s) vencido(s)`,
      deltaPositive: financial.current.delinquencyCents === 0 ? true : false,
      targetSubTab: 'financeiro',
    },
    leads_periodo: {
      formattedValue: String(commercial.leadsCreatedInPeriod),
      subtitle: `Base total: ${commercial.totalLeadsBase} · Contatados: ${commercial.leadsContactedInPeriod}`,
      deltaText: deltaNumLabel(
        commercial.leadsCreatedInPeriod,
        commercial.previousLeadsCreatedInPeriod
      ),
      deltaPositive:
        commercial.leadsCreatedInPeriod === commercial.previousLeadsCreatedInPeriod
          ? null
          : commercial.leadsCreatedInPeriod > commercial.previousLeadsCreatedInPeriod,
      targetSubTab: 'comercial',
    },
    taxa_fechamento: {
      formattedValue:
        commercial.conversions.leadToClosedOverall.ratePct !== null
          ? `${commercial.conversions.leadToClosedOverall.ratePct}%`
          : '—',
      subtitle: `Amostra: ${commercial.conversions.leadToClosedOverall.ratioText} leads`,
      targetSubTab: 'comercial',
    },
    propostas_aprovadas: {
      formattedValue: String(commercial.proposalsApprovedOrSignedInPeriod),
      subtitle: `${formatBrlFromCents(
        Math.round(commercial.proposalsApprovedMrrInPeriod * 100)
      )}/mês + ${formatBrlFromCents(
        Math.round(commercial.proposalsApprovedSetupInPeriod * 100)
      )} setup`,
      deltaText: deltaNumLabel(
        commercial.proposalsApprovedOrSignedInPeriod,
        commercial.previousProposalsApprovedOrSignedInPeriod
      ),
      deltaPositive:
        commercial.proposalsApprovedOrSignedInPeriod ===
        commercial.previousProposalsApprovedOrSignedInPeriod
          ? null
          : commercial.proposalsApprovedOrSignedInPeriod >
            commercial.previousProposalsApprovedOrSignedInPeriod,
      targetSubTab: 'comercial',
    },
    clientes_ativos: {
      formattedValue: String(clients.activeCount + clients.onboardingCount),
      subtitle: `MRR contratado: ${formatBrlFromCents(
        Math.round(clients.totalActiveContractedMrr * 100)
      )}/mês`,
      deltaText: `${clients.newClientsInPeriod} novo(s) no período`,
      deltaPositive: clients.newClientsInPeriod > 0 ? true : null,
      targetSubTab: 'clientes',
    },
    projetos_ativos: {
      formattedValue: String(operational.projects.activeCount),
      subtitle: `Progresso médio: ${operational.projects.avgProgressPct}% · Atrasados: ${operational.projects.overdueActiveCount}`,
      targetSubTab: 'projetos',
    },
    tarefas_concluidas: {
      formattedValue: String(productivity.tasksCompletedInPeriod),
      subtitle: `Em aberto: ${operational.tasks.openCount} · Atrasadas: ${operational.tasks.overdueOpenCount}`,
      deltaText: deltaNumLabel(
        productivity.tasksCompletedInPeriod,
        productivity.previousTasksCompletedInPeriod
      ),
      deltaPositive:
        productivity.tasksCompletedInPeriod === productivity.previousTasksCompletedInPeriod
          ? null
          : productivity.tasksCompletedInPeriod >
            productivity.previousTasksCompletedInPeriod,
      targetSubTab: 'operacional',
    },
    publicacoes_sociais: {
      formattedValue: String(social.publishedInPeriodCount),
      subtitle: `Planejadas no período: ${social.plannedInPeriodCount} · Atrasadas: ${social.overduePlannedCount}`,
      deltaText: deltaNumLabel(
        social.publishedInPeriodCount,
        social.previousPublishedInPeriodCount
      ),
      deltaPositive:
        social.publishedInPeriodCount === social.previousPublishedInPeriodCount
          ? null
          : social.publishedInPeriodCount > social.previousPublishedInPeriodCount,
      targetSubTab: 'redes_sociais',
    },
    dias_ativos: {
      formattedValue: `${productivity.activeDaysCount} / ${period.daysCount}d`,
      subtitle: `Consistência de execução: ${productivity.consistencyRatePct}%`,
      targetSubTab: 'produtividade',
    },
  };

  const kpiCatalogItems: ResolvedFavoriteKpiItem[] = FAVORITE_KPI_CATALOG.map((meta) => ({
    ...meta,
    ...(kpiValues[meta.id] || {
      formattedValue: '—',
      subtitle: 'Indicador indisponível',
      targetSubTab: 'visao_geral' as AnalyticsSubTabId,
    }),
  }));

  return {
    period,
    commercial,
    financial,
    operational,
    clients,
    social,
    productivity,
    insights,
    kpiCatalogItems,
  };
}

/**
 * Converte qualquer aba ativa do Hub de Relatórios & Inteligência em uma estrutura
 * padronizada `GeneratedAnalyticsReport` para que PDF e CSV reflitam fielmente a tela atual.
 */
export function buildActiveSubTabExportReport(
  subTab: Exclude<AnalyticsSubTabId, 'personalizados'>,
  snapshot: ExecutiveDashboardSnapshot
): GeneratedAnalyticsReport {
  const generatedAtIso = new Date().toISOString();
  const { period, commercial, financial, operational, clients, social, productivity } =
    snapshot;

  switch (subTab) {
    case 'visao_geral':
      return {
        id: 'visao-geral-executiva',
        title: 'Visão Geral Executiva — Agência Kaizen',
        subtitle: 'Indicadores consolidados comerciais, financeiros, operacionais e de produtividade.',
        moduleLabel: 'Visão Geral Executiva',
        periodLabel: period.label,
        appliedFiltersSummary: `Período: ${period.label} · Comparativo: ${period.previousLabel}`,
        generatedAtIso,
        summaryCards: [
          { label: 'Receita Realizada', value: formatBrlFromCents(financial.current.receivedRevenueCents) },
          { label: 'Lucro Realizado', value: formatBrlFromCents(financial.current.realizedProfitCents) },
          { label: 'Clientes Ativos', value: String(clients.activeCount + clients.onboardingCount) },
          { label: 'Projetos Ativos', value: String(operational.projects.activeCount) },
          { label: 'Tarefas Concluídas', value: String(productivity.tasksCompletedInPeriod) },
        ],
        columns: ['Área', 'Indicador', 'Valor Atual', 'Base / Amostra'],
        rows: snapshot.kpiCatalogItems.map((k) => [
          k.area.toUpperCase(),
          k.label,
          k.formattedValue,
          k.subtitle,
        ]),
        emptyMessage: 'Sem indicadores para exibir.',
      };

    case 'comercial':
      return {
        id: 'comercial-crm',
        title: 'Relatório de Desempenho Comercial & Funil',
        subtitle: 'Funil CRM, conversões explícitas e pipeline de propostas/contratos.',
        moduleLabel: 'Comercial & CRM',
        periodLabel: period.label,
        appliedFiltersSummary: `Período: ${period.label}`,
        generatedAtIso,
        summaryCards: [
          { label: 'Leads no Período', value: String(commercial.leadsCreatedInPeriod) },
          { label: 'Contatados no Período', value: String(commercial.leadsContactedInPeriod) },
          {
            label: 'Propostas Convertidas',
            value: String(commercial.proposalsApprovedOrSignedInPeriod),
          },
          {
            label: 'Ciclo Médio',
            value:
              commercial.avgDaysToClose.valueDays !== null
                ? `${commercial.avgDaysToClose.valueDays} dias`
                : 'Sem amostra',
          },
        ],
        columns: [
          'Etapa do Funil',
          'Leads Totais na Etapa',
          'Com Atividade no Período',
          '% da Base',
          'Setup Estimado',
          'MRR Estimado',
        ],
        rows: commercial.funnelStages.map((s) => [
          s.stageName,
          String(s.countTotal),
          String(s.countInPeriod),
          s.percentOfPipeline !== null ? `${s.percentOfPipeline}%` : '0%',
          formatBrlFromCents(Math.round(s.estimatedCreationTotal * 100)),
          formatBrlFromCents(Math.round(s.estimatedMrrTotal * 100)),
        ]),
        totalsRow: [
          'TOTAL BASE',
          String(commercial.totalLeadsBase),
          String(commercial.leadsCreatedInPeriod),
          '100%',
          '—',
          '—',
        ],
        emptyMessage: 'Sem dados comerciais no funil.',
        dataLimitationsNote: commercial.dataLimitationsNote,
      };

    case 'financeiro':
      return {
        id: 'financeiro-consolidado',
        title: 'Relatório Financeiro Gerencial (Realizado vs Previsto)',
        subtitle: 'Paridade integral com o módulo Financeiro Kaizen.',
        moduleLabel: 'Financeiro',
        periodLabel: period.label,
        appliedFiltersSummary: `Período: ${period.label}`,
        generatedAtIso,
        summaryCards: [
          { label: 'Receita Realizada', value: formatBrlFromCents(financial.current.receivedRevenueCents) },
          { label: 'Despesa Paga', value: formatBrlFromCents(financial.current.paidExpensesCents) },
          { label: 'Lucro Realizado', value: formatBrlFromCents(financial.current.realizedProfitCents) },
          { label: 'Saldo Caixa Atual', value: formatBrlFromCents(financial.current.cashBalanceCents) },
        ],
        columns: [
          'Período / Bucket',
          'Entradas Realizadas',
          'Saídas Realizadas',
          'Saldo Realizado Acum.',
          'Entradas Previstas',
          'Saídas Previstas',
          'Saldo Projetado',
        ],
        rows: financial.cashFlow.buckets.map((b) => [
          b.label,
          formatBrlFromCents(b.realizedInflowCents),
          formatBrlFromCents(b.realizedOutflowCents),
          formatBrlFromCents(b.realizedBalanceCents),
          formatBrlFromCents(b.projectedInflowCents),
          formatBrlFromCents(b.projectedOutflowCents),
          formatBrlFromCents(b.projectedBalanceCents),
        ]),
        totalsRow: [
          'FECHAMENTO',
          formatBrlFromCents(financial.cashFlow.realizedInflowCents),
          formatBrlFromCents(financial.cashFlow.realizedOutflowCents),
          formatBrlFromCents(financial.cashFlow.realizedClosingBalanceCents),
          formatBrlFromCents(financial.cashFlow.projectedInflowCents),
          formatBrlFromCents(financial.cashFlow.projectedOutflowCents),
          formatBrlFromCents(financial.cashFlow.projectedClosingBalanceCents),
        ],
        emptyMessage: 'Sem buckets financeiros para o período.',
        dataLimitationsNote: financial.dataIntegrityNote,
      };

    case 'operacional':
      return {
        id: 'operacional-tarefas',
        title: 'Relatório Operacional — Tarefas e Prazos',
        subtitle: 'Status da fila de tarefas, prioridades e atrasos.',
        moduleLabel: 'Operacional',
        periodLabel: period.label,
        appliedFiltersSummary: `Período: ${period.label}`,
        generatedAtIso,
        summaryCards: [
          { label: 'Tarefas em Aberto', value: String(operational.tasks.openCount) },
          { label: 'Concluídas (Período)', value: String(operational.tasks.completedInPeriod) },
          { label: 'Atrasadas', value: String(operational.tasks.overdueOpenCount) },
          {
            label: 'No Prazo (%)',
            value:
              operational.tasks.onTimeCompletion.ratePct !== null
                ? `${operational.tasks.onTimeCompletion.ratePct}%`
                : '—',
          },
        ],
        columns: ['Status Operacional', 'Quantidade de Tarefas', '% do Total'],
        rows: operational.tasks.byStatus.map((s) => [
          s.label,
          String(s.count),
          operational.tasks.totalBase > 0
            ? `${((s.count / operational.tasks.totalBase) * 100).toFixed(1)}%`
            : '0%',
        ]),
        totalsRow: ['TOTAL', String(operational.tasks.totalBase), '100%'],
        emptyMessage: 'Nenhuma tarefa cadastrada.',
        dataLimitationsNote: operational.integrityNote,
      };

    case 'clientes':
      return {
        id: 'clientes-carteira',
        title: 'Relatório de Carteira e Desempenho por Cliente',
        subtitle: 'Receita realizada no período, MRR, títulos em aberto e entregas por cliente.',
        moduleLabel: 'Carteira de Clientes',
        periodLabel: period.label,
        appliedFiltersSummary: `Período: ${period.label}`,
        generatedAtIso,
        summaryCards: [
          { label: 'Total Clientes', value: String(clients.totalClients) },
          { label: 'Ativos + Onboarding', value: String(clients.activeCount + clients.onboardingCount) },
          {
            label: 'MRR Contratado',
            value: formatBrlFromCents(Math.round(clients.totalActiveContractedMrr * 100)),
          },
          {
            label: 'Receita Realizada (Período)',
            value: formatBrlFromCents(clients.totalRealizedRevenueFromClientsInPeriodCents),
          },
        ],
        columns: [
          'Cliente',
          'Status',
          'MRR',
          'Receita Período',
          'Em Aberto',
          'Projetos Ativos',
          'Tarefas Abertas',
        ],
        rows: clients.rows.map((r) => [
          r.companyName,
          r.statusLabel,
          formatBrlFromCents(Math.round(r.monthlyMrr * 100)),
          formatBrlFromCents(r.realizedRevenueInPeriodCents),
          formatBrlFromCents(r.openReceivablesCents),
          String(r.activeProjectsCount),
          String(r.openTasksCount),
        ]),
        totalsRow: [
          'TOTAL',
          `${clients.totalClients} cliente(s)`,
          formatBrlFromCents(Math.round(clients.totalActiveContractedMrr * 100)),
          formatBrlFromCents(clients.totalRealizedRevenueFromClientsInPeriodCents),
          '—',
          '—',
          '—',
        ],
        emptyMessage: 'Nenhum cliente cadastrado.',
        dataLimitationsNote: clients.dataLimitationsNote,
      };

    case 'projetos':
      return {
        id: 'projetos-execucao',
        title: 'Relatório de Projetos e Execução',
        subtitle: 'Acompanhamento por status, modelo Kaizen, progresso e prazos.',
        moduleLabel: 'Projetos',
        periodLabel: period.label,
        appliedFiltersSummary: `Período: ${period.label}`,
        generatedAtIso,
        summaryCards: [
          { label: 'Projetos Ativos', value: String(operational.projects.activeCount) },
          { label: 'Concluídos (Período)', value: String(operational.projects.completedInPeriod) },
          { label: 'Atrasados', value: String(operational.projects.overdueActiveCount) },
          { label: 'Progresso Médio', value: `${operational.projects.avgProgressPct}%` },
        ],
        columns: ['Projeto', 'Cliente', 'Serviço', 'Status', 'Prazo', 'Tarefas', 'Progresso'],
        rows: operational.projects.rows.map((p) => [
          p.name,
          p.clientName,
          p.serviceType,
          p.statusLabel,
          p.dueDate ? formatDateBr(p.dueDate) : 'Sem prazo',
          `${p.completedTasks}/${p.totalTasks}`,
          `${p.progressPct}%`,
        ]),
        totalsRow: [
          'TOTAL',
          `${operational.projects.totalBase} projeto(s)`,
          '—',
          '—',
          '—',
          '—',
          `${operational.projects.avgProgressPct}% médio`,
        ],
        emptyMessage: 'Nenhum projeto cadastrado.',
        dataLimitationsNote: operational.integrityNote,
      };

    case 'redes_sociais':
      return {
        id: 'redes-sociais-editorial',
        title: 'Relatório Editorial — Redes Sociais',
        subtitle: 'Planejamento, aprovações, publicações confirmadas e pendências.',
        moduleLabel: 'Redes Sociais',
        periodLabel: period.label,
        appliedFiltersSummary: `Período: ${period.label}`,
        generatedAtIso,
        summaryCards: [
          { label: 'Canais Ativos', value: String(social.activeChannelsCount) },
          { label: 'Planejados (Período)', value: String(social.plannedInPeriodCount) },
          { label: 'Publicados (Período)', value: String(social.publishedInPeriodCount) },
          { label: 'Atrasados', value: String(social.overduePlannedCount) },
        ],
        columns: ['Conta / Entidade', 'Tipo', 'No Período', 'Publicados no Período', 'Atrasados'],
        rows: social.byOwnerEntity.map((e) => [
          e.label,
          e.ownerType === 'kaizen' ? 'Agência Kaizen' : 'Cliente',
          String(e.totalInPeriod),
          String(e.publishedInPeriod),
          String(e.overdueCount),
        ]),
        totalsRow: [
          'TOTAL PERÍODO',
          '—',
          String(social.plannedInPeriodCount),
          String(social.publishedInPeriodCount),
          String(social.overduePlannedCount),
        ],
        emptyMessage: 'Sem conteúdos registrados no período.',
        dataLimitationsNote: social.externalMetricsLimitationNote,
      };

    case 'produtividade':
      return {
        id: 'produtividade-execucao',
        title: 'Relatório de Produtividade e Execução',
        subtitle: 'Ritmo de entregas, consistência diária e histórico real de atividades.',
        moduleLabel: 'Produtividade',
        periodLabel: period.label,
        appliedFiltersSummary: `Período: ${period.label}`,
        generatedAtIso,
        summaryCards: [
          { label: 'Tarefas Concluídas', value: String(productivity.tasksCompletedInPeriod) },
          { label: 'Dias Ativos', value: `${productivity.activeDaysCount}/${period.daysCount}` },
          { label: 'Consistência', value: `${productivity.consistencyRatePct}%` },
          { label: 'Backlog Atrasado', value: String(productivity.totalOverdueBacklog) },
        ],
        columns: ['Janela', 'Tarefas Concl.', 'Toques CRM', 'Agenda Concl.', 'Social Publ.', 'Total Ações'],
        rows: productivity.timeSeries.map((pt) => [
          pt.label,
          String(pt.tasksCompleted),
          String(pt.commercialTouches),
          String(pt.agendaCompleted),
          String(pt.socialPublished),
          String(pt.totalActions),
        ]),
        totalsRow: [
          'TOTAL PERÍODO',
          String(productivity.tasksCompletedInPeriod),
          String(productivity.commercialTouchesInPeriod),
          String(productivity.agendaCompletedInPeriod),
          String(productivity.socialPublishedInPeriod),
          String(
            productivity.tasksCompletedInPeriod +
              productivity.commercialTouchesInPeriod +
              productivity.agendaCompletedInPeriod +
              productivity.socialPublishedInPeriod
          ),
        ],
        emptyMessage: 'Nenhuma atividade registrada no período.',
        dataLimitationsNote: productivity.workedHoursLimitationNote,
      };
  }
}
