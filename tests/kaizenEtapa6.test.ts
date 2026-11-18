import test from 'node:test';
import assert from 'node:assert/strict';
import { Lead, NicheCampaign } from '../src/types/crm';
import {
  AgendaEvent,
  Client,
  Project,
  ProposalContract,
  SocialChannel,
  SocialPost,
  Task,
} from '../src/types/kaizen';
import {
  FinancialCategory,
  FinancialEntry,
  FinancialRecurrence,
  FinancialSettings,
  FinancialTransaction,
} from '../src/types/finance';
import { ResourceFile } from '../src/types/resources';
import {
  ANALYTICS_PERIOD_OPTIONS,
  CustomReportConfig,
  DEFAULT_FAVORITE_KPI_IDS,
} from '../src/types/analytics';
import {
  buildActiveSubTabExportReport,
  buildAnalyticsCsvContent,
  buildAnalyticsReportPdfDocument,
  computeClientPortfolioAnalytics,
  computeCommercialAnalytics,
  computeExecutiveDashboardSnapshot,
  computeFinancialAnalytics,
  computeOperationalAnalytics,
  computeProductivityAnalytics,
  computeSocialAnalytics,
  createSavedCustomReportRecord,
  extractLocalYmd,
  generateCustomReport,
  resolveAnalyticsPeriod,
  sanitizeConfigForModule,
  validateCustomReportConfig,
} from '../src/services/analytics';
import { computeFinanceDashboardSnapshot } from '../src/services/finance/reportsService';
import { computeCashFlow } from '../src/services/finance/cashFlowService';
import { KAIZEN_TIMEZONE } from '../src/services/finance/money';
import {
  parseAndValidateBackup,
  prepareBackupRestorePayload,
  serializeCompleteBackupJson,
} from '../src/services/backupService';

const SETTINGS: FinancialSettings = {
  id: 'default',
  companyName: 'Agência Kaizen',
  currency: 'BRL',
  dateFormat: 'DD/MM/YYYY',
  timezone: KAIZEN_TIMEZONE,
  openingBalanceCents: 100000, // R$ 1.000,00
  openingBalanceDate: '2026-11-01',
  openingBalanceDescription: 'Saldo inicial de caixa',
  openingBalanceHistory: [],
  paymentMethods: [{ id: 'pix', label: 'Pix', active: true }],
  alertDaysAhead: 5,
  defaultDueDay: 10,
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const CATEGORIES: FinancialCategory[] = [
  {
    id: 'cat-mrr',
    name: 'Recorrência Mensal',
    kind: 'receita',
    active: true,
    isDefault: true,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'cat-ferramentas',
    name: 'Ferramentas SaaS',
    kind: 'despesa',
    active: true,
    isDefault: true,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
];

const NICHES: NicheCampaign[] = [
  {
    id: 'niche-1',
    name: 'Clínicas Médicas',
    segment: 'Saúde',
    city: 'Maceió',
    emoji: '🏥',
    targetMrr: 5000,
    scripts: {},
    createdAt: '2026-10-01T10:00:00.000Z',
  },
];

function makeSampleWorkspace() {
  const leads: Lead[] = [
    {
      id: 'l1',
      nicheId: 'niche-1',
      companyName: 'Clínica Alpha',
      phone: '82999990001',
      displayPhone: '(82) 99999-0001',
      city: 'Maceió',
      category: 'Odontologia',
      stage: 'fechado',
      scriptUsed: 'script1',
      notes: [],
      creationValue: 2000,
      monthlyMrr: 1500,
      lastContactDate: '2026-11-10T15:00:00.000Z',
      meetingDate: '2026-11-11',
      meetingStatus: 'realizada',
      createdAt: '2026-11-05T12:00:00.000Z',
      updatedAt: '2026-11-12T12:00:00.000Z',
    },
    {
      id: 'l2',
      nicheId: 'niche-1',
      companyName: 'Studio Beta',
      phone: '82999990002',
      displayPhone: '(82) 99999-0002',
      city: 'Arapiraca',
      category: 'Estética',
      stage: 'leads_sem_contato',
      scriptUsed: 'script1',
      notes: [],
      createdAt: '2026-11-15T12:00:00.000Z',
    },
    {
      id: 'l3',
      nicheId: 'niche-1',
      companyName: 'Hospital Gama',
      phone: '82999990003',
      displayPhone: '(82) 99999-0003',
      city: 'Maceió',
      category: 'Odontologia',
      stage: 'reuniao_marcada',
      scriptUsed: 'script1',
      notes: [],
      lastContactDate: '2026-11-14T14:00:00.000Z',
      meetingDate: '2026-11-19',
      meetingStatus: 'agendada',
      createdAt: '2026-11-10T10:00:00.000Z',
    },
  ];

  const clients: Client[] = [
    {
      id: 'cli-1',
      companyName: 'Clínica Alpha',
      contactName: 'Dra. Maria',
      phone: '82999990001',
      displayPhone: '(82) 99999-0001',
      city: 'Maceió',
      status: 'ativo',
      monthlyMrr: 1500,
      setupValue: 2000,
      originLeadId: 'l1',
      timeline: [],
      createdAt: '2026-11-12T12:00:00.000Z',
      updatedAt: '2026-11-17T10:00:00.000Z',
    },
    {
      id: 'cli-2',
      companyName: 'Cliente Dormente Ltda',
      contactName: 'João',
      phone: '82999990009',
      displayPhone: '(82) 99999-0009',
      city: 'Maceió',
      status: 'ativo',
      monthlyMrr: 900,
      timeline: [],
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
  ];

  const proposals: ProposalContract[] = [
    {
      id: 'prop-1',
      code: 'KZ-2026-001',
      kind: 'contrato',
      title: 'Kaizen Performance 90d',
      status: 'assinada',
      clientId: 'cli-1',
      leadId: 'l1',
      recipientCompany: 'Clínica Alpha',
      issuerName: 'Agência Kaizen',
      items: [],
      setupTotal: 2000,
      monthlyMrr: 1500,
      createdAt: '2026-11-08T10:00:00.000Z',
      sentAt: '2026-11-09T10:00:00.000Z',
      signedAt: '2026-11-12T10:00:00.000Z',
      history: [],
    },
    {
      id: 'prop-2',
      code: 'KZ-2026-002',
      kind: 'proposta',
      title: 'Kaizen Start LP',
      status: 'em_negociacao',
      recipientCompany: 'Hospital Gama',
      issuerName: 'Agência Kaizen',
      items: [],
      setupTotal: 1200,
      monthlyMrr: 800,
      createdAt: '2026-11-15T10:00:00.000Z',
      sentAt: '2026-11-16T10:00:00.000Z',
      history: [],
    },
  ];

  const projects: Project[] = [
    {
      id: 'proj-1',
      name: 'Implantação Kaizen Alpha',
      clientId: 'cli-1',
      serviceType: 'Kaizen Performance',
      templateId: 'kaizen_performance',
      status: 'em_andamento',
      ownerName: 'Admin',
      startDate: '2026-11-12',
      dueDate: '2026-11-15', // atrasado vs 2026-11-18
      documents: [],
      history: [],
      createdAt: '2026-11-12T12:00:00.000Z',
      updatedAt: '2026-11-17T10:00:00.000Z',
    },
    {
      id: 'proj-2',
      name: 'Projeto Cancelado Teste',
      clientId: 'cli-1',
      serviceType: 'Landing Page',
      templateId: 'kaizen_start',
      status: 'cancelado',
      ownerName: 'Admin',
      startDate: '2026-11-01',
      dueDate: '2026-11-10',
      documents: [],
      history: [],
      createdAt: '2026-11-01T10:00:00.000Z',
    },
    {
      id: 'proj-3',
      name: 'LP Entregue No Prazo',
      clientId: 'cli-1',
      serviceType: 'Landing Page',
      templateId: 'kaizen_start',
      status: 'concluido',
      ownerName: 'Admin',
      startDate: '2026-11-02',
      dueDate: '2026-11-12',
      completedAt: '2026-11-10T15:00:00.000Z',
      documents: [],
      history: [],
      createdAt: '2026-11-02T10:00:00.000Z',
    },
  ];

  const tasks: Task[] = [
    {
      id: 'task-1',
      title: 'Configurar Pixel e Analytics',
      projectId: 'proj-1',
      clientId: 'cli-1',
      status: 'concluida',
      priority: 'alta',
      dueDate: '2026-11-16',
      completedAt: '2026-11-15T18:00:00.000Z',
      checklist: [],
      createdAt: '2026-11-12T12:00:00.000Z',
    },
    {
      id: 'task-2',
      title: 'Subir Campanha Meta Ads',
      projectId: 'proj-1',
      clientId: 'cli-1',
      status: 'em_andamento',
      priority: 'urgente',
      dueDate: '2026-11-16', // atrasada vs 2026-11-18
      checklist: [],
      createdAt: '2026-11-13T12:00:00.000Z',
    },
    {
      id: 'task-3',
      title: 'Entregar Wireframe LP',
      projectId: 'proj-3',
      clientId: 'cli-1',
      status: 'concluida',
      priority: 'media',
      dueDate: '2026-11-09',
      completedAt: '2026-11-08T16:00:00.000Z',
      checklist: [],
      createdAt: '2026-11-02T10:00:00.000Z',
    },
  ];

  const agendaEvents: AgendaEvent[] = [
    {
      id: 'ev-1',
      title: 'Alinhamento Kickoff Alpha',
      type: 'reuniao_cliente',
      date: '2026-11-13',
      startTime: '14:00',
      clientId: 'cli-1',
      status: 'concluido',
      createdAt: '2026-11-12T14:00:00.000Z',
    },
  ];

  const socialChannels: SocialChannel[] = [
    {
      id: 'ch-1',
      ownerType: 'kaizen',
      platform: 'instagram',
      handle: '@kaizen',
      active: true,
      createdAt: '2026-11-01T10:00:00.000Z',
    },
  ];

  const socialPosts: SocialPost[] = [
    {
      id: 'post-1',
      channelId: 'ch-1',
      ownerType: 'kaizen',
      platform: 'instagram',
      title: 'Carrossel Posicionamento',
      format: 'carrossel',
      assignee: 'Admin',
      status: 'publicado',
      plannedDate: '2026-11-14',
      publishedAt: '2026-11-14T16:00:00.000Z',
      createdAt: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 'post-2',
      channelId: 'ch-1',
      ownerType: 'client',
      clientId: 'cli-1',
      platform: 'instagram',
      title: 'Reels Institucional Alpha',
      format: 'reels',
      assignee: 'Admin',
      status: 'revisao',
      plannedDate: '2026-11-16', // atrasado vs 2026-11-18
      createdAt: '2026-11-11T10:00:00.000Z',
    },
  ];

  const financialEntries: FinancialEntry[] = [
    {
      id: 'fin-1',
      kind: 'receita',
      description: 'Mensalidade Alpha Nov',
      categoryId: 'cat-mrr',
      clientId: 'cli-1',
      projectId: 'proj-1',
      competenceDate: '2026-11-12',
      dueDate: '2026-11-12',
      amountCents: 150000,
      settledCents: 150000,
      paymentMethod: 'pix',
      status: 'recebida',
      createdAt: '2026-11-12T12:00:00.000Z',
    },
    {
      id: 'fin-2',
      kind: 'receita',
      description: 'Setup Alpha Parcela 2',
      categoryId: 'cat-mrr',
      clientId: 'cli-1',
      projectId: 'proj-1',
      competenceDate: '2026-11-12',
      dueDate: '2026-11-15',
      amountCents: 100000,
      settledCents: 0,
      paymentMethod: 'pix',
      status: 'pendente',
      createdAt: '2026-11-12T12:00:00.000Z',
    },
    {
      id: 'fin-3',
      kind: 'despesa',
      description: 'Assinatura CRM & Cloud',
      categoryId: 'cat-ferramentas',
      supplierName: 'Fornecedor Cloud',
      competenceDate: '2026-11-05',
      dueDate: '2026-11-10',
      amountCents: 30000,
      settledCents: 30000,
      paymentMethod: 'cartao_credito',
      status: 'paga',
      createdAt: '2026-11-05T10:00:00.000Z',
    },
  ];

  const financialTransactions: FinancialTransaction[] = [
    {
      id: 'ftx-1',
      entryId: 'fin-1',
      entryKind: 'receita',
      kind: 'recebimento',
      date: '2026-11-12',
      amountCents: 150000,
      paymentMethod: 'pix',
      createdBy: 'Admin',
      createdAt: '2026-11-12T14:00:00.000Z',
    },
    {
      id: 'ftx-2',
      entryId: 'fin-3',
      entryKind: 'despesa',
      kind: 'pagamento',
      date: '2026-11-10',
      amountCents: 30000,
      paymentMethod: 'cartao_credito',
      createdBy: 'Admin',
      createdAt: '2026-11-10T11:00:00.000Z',
    },
  ];

  const financialRecurrences: FinancialRecurrence[] = [
    {
      id: 'frec-1',
      kind: 'receita',
      name: 'MRR Alpha',
      categoryId: 'cat-mrr',
      clientId: 'cli-1',
      amountCents: 150000,
      paymentMethod: 'pix',
      frequency: 'mensal',
      startDate: '2026-11-12',
      nextOccurrenceDate: '2026-12-12',
      status: 'ativa',
      createdAt: '2026-11-12T12:00:00.000Z',
    },
  ];

  const resourceFiles: ResourceFile[] = [
    {
      id: 'rfile-1',
      name: 'Contrato_Alpha.pdf',
      originalName: 'Contrato_Alpha.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      sizeBytes: 102400,
      categoryId: 'rcat-doc',
      tags: [],
      favorite: false,
      status: 'ativo',
      storagePath: 'external/alpha.pdf',
      storageProvider: 'external_link',
      downloadUrl: 'https://example.com/alpha.pdf',
      uploadedBy: 'Admin',
      uploadedAt: '2026-11-12T15:00:00.000Z',
      clientId: 'cli-1',
      projectId: 'proj-1',
    },
  ];

  return {
    leads,
    niches: NICHES,
    clients,
    proposals,
    projects,
    tasks,
    agendaEvents,
    socialChannels,
    socialPosts,
    financialEntries,
    financialTransactions,
    financialCategories: CATEGORIES,
    financialRecurrences,
    financialSettings: SETTINGS,
    financialAuditLogs: [],
    resourceFiles,
  };
}

test('resolveAnalyticsPeriod resolve todos os 10 presets e respeita fuso America/Maceio na virada UTC', () => {
  // 2026-11-18T02:00:00Z em Maceió (UTC-3) ainda é 2026-11-17 23:00
  assert.equal(extractLocalYmd('2026-11-18T02:00:00.000Z', KAIZEN_TIMEZONE), '2026-11-17');

  for (const opt of ANALYTICS_PERIOD_OPTIONS) {
    const resolved = resolveAnalyticsPeriod({
      preset: opt.id,
      customStart: '2026-11-01',
      customEnd: '2026-11-15',
      referenceYmd: '2026-11-18',
      timezone: KAIZEN_TIMEZONE,
    });
    assert.ok(resolved.startDate <= resolved.endDate, `Intervalo invertido em ${opt.id}`);
    assert.ok(resolved.daysCount >= 1);
    assert.ok(resolved.previousStartDate <= resolved.previousEndDate);
  }

  const esteMes = resolveAnalyticsPeriod({
    preset: 'este_mes',
    referenceYmd: '2026-11-18',
    timezone: KAIZEN_TIMEZONE,
  });
  assert.equal(esteMes.startDate, '2026-11-01');
  assert.equal(esteMes.endDate, '2026-11-30');
});

test('computeFinancialAnalytics mantém 100% de paridade com módulo Financeiro e separa Realizado vs Previsto', () => {
  const ws = makeSampleWorkspace();
  const period = resolveAnalyticsPeriod({
    preset: 'este_mes',
    referenceYmd: '2026-11-18',
    timezone: KAIZEN_TIMEZONE,
  });

  const analyticsFin = computeFinancialAnalytics({
    entries: ws.financialEntries,
    transactions: ws.financialTransactions,
    categories: ws.financialCategories,
    recurrences: ws.financialRecurrences,
    settings: ws.financialSettings,
    clients: ws.clients,
    projects: ws.projects,
    period,
    todayStr: '2026-11-18',
  });

  const directSnapshot = computeFinanceDashboardSnapshot({
    entries: ws.financialEntries,
    transactions: ws.financialTransactions,
    categories: ws.financialCategories,
    settings: ws.financialSettings,
    clients: ws.clients,
    preset: 'este_mes',
    todayStr: '2026-11-18',
  });

  const directCashFlow = computeCashFlow({
    entries: ws.financialEntries,
    transactions: ws.financialTransactions,
    settings: ws.financialSettings,
    startDate: period.startDate,
    endDate: period.endDate,
    granularity: period.granularity,
    todayStr: '2026-11-18',
  });

  assert.equal(analyticsFin.current.receivedRevenueCents, directSnapshot.receivedRevenueCents);
  assert.equal(analyticsFin.current.paidExpensesCents, directSnapshot.paidExpensesCents);
  assert.equal(analyticsFin.current.realizedProfitCents, directSnapshot.realizedProfitCents);
  assert.equal(analyticsFin.current.predictedRevenueCents, directSnapshot.predictedRevenueCents);
  assert.equal(analyticsFin.current.delinquencyCents, directSnapshot.delinquencyCents);
  assert.equal(analyticsFin.current.cashBalanceCents, directSnapshot.cashBalanceCents);
  assert.equal(
    analyticsFin.cashFlow.realizedClosingBalanceCents,
    directCashFlow.realizedClosingBalanceCents
  );
  // Realizado (150000) != Previsto (250000), nunca misturados
  assert.equal(analyticsFin.current.receivedRevenueCents, 150000);
  assert.equal(analyticsFin.current.predictedRevenueCents, 250000);
  assert.equal(analyticsFin.activeRecurrences.activeRevenueMonthlyCents, 150000);
});

test('computeCommercialAnalytics calcula conversões com numerador/denominador explícitos e ciclo médio honesto', () => {
  const ws = makeSampleWorkspace();
  const period = resolveAnalyticsPeriod({
    preset: 'este_mes',
    referenceYmd: '2026-11-18',
  });

  const comm = computeCommercialAnalytics({
    leads: ws.leads,
    niches: ws.niches,
    proposals: ws.proposals,
    agendaEvents: ws.agendaEvents,
    period,
    timezone: KAIZEN_TIMEZONE,
  });

  assert.equal(comm.totalLeadsBase, 3);
  assert.equal(comm.conversions.leadToContacted.ratioText, '2 / 3');
  assert.equal(comm.conversions.leadToClosedOverall.ratioText, '1 / 3');
  // prop-1: sentAt 2026-11-09, signedAt 2026-11-12 => 3 dias
  assert.equal(comm.avgDaysToClose.valueDays, 3);
  assert.equal(comm.avgDaysToClose.sampleSize, 1);

  // Sem propostas aprovadas com timestamp => null (nunca inventado)
  const commWithoutProps = computeCommercialAnalytics({
    leads: ws.leads,
    niches: ws.niches,
    proposals: [],
    agendaEvents: [],
    period,
  });
  assert.equal(commWithoutProps.avgDaysToClose.valueDays, null);
  assert.equal(commWithoutProps.avgDaysToClose.sampleSize, 0);
});

test('computeOperationalAnalytics exclui projetos cancelados de entregas concluídas e mede atrasos reais', () => {
  const ws = makeSampleWorkspace();
  const period = resolveAnalyticsPeriod({
    preset: 'este_mes',
    referenceYmd: '2026-11-18',
  });

  const ops = computeOperationalAnalytics({
    projects: ws.projects,
    tasks: ws.tasks,
    clients: ws.clients,
    period,
    todayStr: '2026-11-18',
    timezone: KAIZEN_TIMEZONE,
  });

  assert.equal(ops.projects.activeCount, 1);
  assert.equal(ops.projects.cancelledCount, 1);
  assert.equal(ops.projects.completedTotal, 1); // proj-2 cancelado NUNCA conta como concluído
  assert.equal(ops.projects.overdueActiveCount, 1); // proj-1 vencido
  assert.equal(ops.projects.onTimeDelivery.ratePct, 100);
  assert.equal(ops.tasks.openCount, 1);
  assert.equal(ops.tasks.overdueOpenCount, 1);
  assert.equal(ops.tasks.completedInPeriod, 2);
});

test('computeClientPortfolioAnalytics detecta cliente inativo (21+ dias) e consolida receita e projetos', () => {
  const ws = makeSampleWorkspace();
  const period = resolveAnalyticsPeriod({
    preset: 'este_mes',
    referenceYmd: '2026-11-18',
  });

  const cli = computeClientPortfolioAnalytics({
    clients: ws.clients,
    proposals: ws.proposals,
    projects: ws.projects,
    tasks: ws.tasks,
    agendaEvents: ws.agendaEvents,
    financialEntries: ws.financialEntries,
    financialTransactions: ws.financialTransactions,
    period,
    todayStr: '2026-11-18',
    timezone: KAIZEN_TIMEZONE,
  });

  assert.equal(cli.totalClients, 2);
  assert.equal(cli.totalActiveContractedMrr, 2400);
  assert.equal(cli.potentiallyInactiveClientsCount, 1);
  assert.equal(cli.inactiveAlertRows[0].clientId, 'cli-2');
  const alphaRow = cli.rows.find((r) => r.clientId === 'cli-1')!;
  assert.equal(alphaRow.realizedRevenueInPeriodCents, 150000);
  assert.equal(alphaRow.overdueReceivablesCents, 100000);
  assert.equal(alphaRow.activeProjectsCount, 1);
});

test('computeSocialAnalytics e computeProductivityAnalytics expõem limitações honestas (sem API social nem horas)', () => {
  const ws = makeSampleWorkspace();
  const period = resolveAnalyticsPeriod({
    preset: 'este_mes',
    referenceYmd: '2026-11-18',
  });

  const social = computeSocialAnalytics({
    channels: ws.socialChannels,
    posts: ws.socialPosts,
    clients: ws.clients,
    period,
    todayStr: '2026-11-18',
    timezone: KAIZEN_TIMEZONE,
  });

  assert.equal(social.externalMetricsConnected, false);
  assert.ok(social.externalMetricsLimitationNote.length > 20);
  assert.equal(social.publishedInPeriodCount, 1);
  assert.equal(social.overduePlannedCount, 1);

  const prod = computeProductivityAnalytics({
    tasks: ws.tasks,
    projects: ws.projects,
    leads: ws.leads,
    proposals: ws.proposals,
    agendaEvents: ws.agendaEvents,
    socialPosts: ws.socialPosts,
    financialTransactions: ws.financialTransactions,
    financialAuditLogs: [],
    resourceFiles: ws.resourceFiles,
    clients: ws.clients,
    period,
    todayStr: '2026-11-18',
    timezone: KAIZEN_TIMEZONE,
  });

  assert.equal(prod.workedHoursAvailable, false);
  assert.ok(prod.workedHoursLimitationNote.length > 20);
  assert.equal(prod.tasksCompletedInPeriod, 2);
  assert.ok(prod.activeDaysCount >= 4);
  assert.ok(prod.recentActivities.length >= 6);
});

test('validateCustomReportConfig impede filtros incompatíveis e generateCustomReport executa com fidelidade', () => {
  const badFinancialWithNiche: CustomReportConfig = {
    module: 'financeiro_lancamentos',
    periodPreset: 'este_mes',
    nicheId: 'niche-1',
  };
  const v1 = validateCustomReportConfig(badFinancialWithNiche);
  assert.equal(v1.valid, false);
  assert.ok(v1.errors.length >= 1);

  const badDates: CustomReportConfig = {
    module: 'comercial_leads',
    periodPreset: 'personalizado',
    customStart: '2026-11-20',
    customEnd: '2026-11-10',
  };
  assert.equal(validateCustomReportConfig(badDates).valid, false);

  const sanitized = sanitizeConfigForModule(badFinancialWithNiche, 'financeiro_lancamentos');
  assert.equal(sanitized.nicheId, undefined);
  assert.equal(validateCustomReportConfig(sanitized).valid, true);

  const ws = makeSampleWorkspace();
  const report = generateCustomReport({
    config: {
      module: 'financeiro_lancamentos',
      periodPreset: 'este_mes',
      onlyOverdue: true,
    },
    leads: ws.leads,
    niches: ws.niches,
    clients: ws.clients,
    proposals: ws.proposals,
    projects: ws.projects,
    tasks: ws.tasks,
    agendaEvents: ws.agendaEvents,
    socialPosts: ws.socialPosts,
    financialEntries: ws.financialEntries,
    financialTransactions: ws.financialTransactions,
    financialCategories: ws.financialCategories,
    financialSettings: ws.financialSettings,
    resourceFiles: ws.resourceFiles,
    todayStr: '2026-11-18',
  });

  assert.equal(report.rows.length, 1); // somente fin-2 vencido em 2026-11-15
  assert.match(report.rows[0][2], /Setup Alpha Parcela 2/);

  const saved = createSavedCustomReportRecord({
    name: 'Atrasados Novembro',
    config: { module: 'financeiro_lancamentos', periodPreset: 'este_mes', onlyOverdue: true },
    favorite: true,
  });
  assert.match(saved.id, /^creport-/);
  assert.equal(saved.favorite, true);
});

test('Exportação CSV (BOM + anti-formula-injection) e PDF A4 refletem exatamente o relatório gerado', () => {
  const ws = makeSampleWorkspace();
  const snap = computeExecutiveDashboardSnapshot({
    ...ws,
    preset: 'este_mes',
    todayStr: '2026-11-18',
  });

  assert.ok(snap.insights.length >= 2);
  assert.ok(snap.insights.every((ins) => ins.sampleDescription.length > 0));
  assert.equal(snap.kpiCatalogItems.length, 12);
  assert.ok(DEFAULT_FAVORITE_KPI_IDS.length >= 4);

  const report = buildActiveSubTabExportReport('financeiro', snap);
  // Injetar célula perigosa para testar sanitização CSV
  const reportWithFormula = {
    ...report,
    rows: [['=SUM(A1:A2)', ...report.rows[0].slice(1)], ...report.rows.slice(1)],
  };

  const csv = buildAnalyticsCsvContent(reportWithFormula);
  assert.equal(csv.charCodeAt(0), 0xfeff); // UTF-8 BOM
  assert.ok(csv.includes("'=SUM(A1:A2)"));

  const pdfDoc = buildAnalyticsReportPdfDocument(report, 'Agência Kaizen');
  const buf = pdfDoc.output('arraybuffer');
  assert.ok(buf.byteLength > 500);
  const header = Buffer.from(buf).subarray(0, 5).toString('utf8');
  assert.equal(header, '%PDF-');
});

test('Datasets completamente vazios não geram NaN, Infinity ou exceções e performance com 1.200 registros é < 1000ms', () => {
  const emptySnap = computeExecutiveDashboardSnapshot({
    leads: [],
    niches: [],
    clients: [],
    proposals: [],
    projects: [],
    tasks: [],
    agendaEvents: [],
    socialChannels: [],
    socialPosts: [],
    financialEntries: [],
    financialTransactions: [],
    financialCategories: [],
    financialRecurrences: [],
    financialSettings: SETTINGS,
    financialAuditLogs: [],
    resourceFiles: [],
    preset: 'este_mes',
    todayStr: '2026-11-18',
  });

  assert.equal(emptySnap.commercial.avgDaysToClose.valueDays, null);
  assert.equal(emptySnap.commercial.conversions.leadToClosedOverall.ratePct, null);
  assert.equal(emptySnap.financial.current.realizedProfitCents, 0);
  assert.equal(emptySnap.operational.projects.avgProgressPct, 0);
  assert.equal(Number.isNaN(emptySnap.productivity.consistencyRatePct), false);

  // Stress test 1200 registros
  const manyLeads: Lead[] = Array.from({ length: 600 }, (_, i) => ({
    id: `l-perf-${i}`,
    nicheId: 'niche-1',
    companyName: `Empresa ${i}`,
    phone: `82999${String(i).padStart(6, '0')}`,
    displayPhone: `(82) 999${String(i).padStart(6, '0')}`,
    city: 'Maceió',
    stage: i % 5 === 0 ? 'fechado' : 'primeiro_contato',
    scriptUsed: 'script1',
    notes: [],
    createdAt: '2026-11-10T10:00:00.000Z',
  }));
  const manyTasks: Task[] = Array.from({ length: 600 }, (_, i) => ({
    id: `t-perf-${i}`,
    title: `Tarefa ${i}`,
    status: i % 2 === 0 ? 'concluida' : 'a_fazer',
    priority: 'media',
    dueDate: '2026-11-18',
    completedAt: i % 2 === 0 ? '2026-11-15T12:00:00.000Z' : undefined,
    checklist: [],
    createdAt: '2026-11-05T10:00:00.000Z',
  }));

  const t0 = Date.now();
  const perfSnap = computeExecutiveDashboardSnapshot({
    ...makeSampleWorkspace(),
    leads: manyLeads,
    tasks: manyTasks,
    preset: 'ultimos_90_dias',
    todayStr: '2026-11-18',
  });
  const elapsed = Date.now() - t0;
  assert.equal(perfSnap.commercial.totalLeadsBase, 600);
  assert.ok(elapsed < 1000, `Cálculo levou ${elapsed}ms (> 1000ms)`);
});

test('Backup v3.0 preserva savedReports e analyticsSettings no roundtrip com integridade verificada', () => {
  const savedReport = createSavedCustomReportRecord({
    name: 'Leads por Nicho',
    config: { module: 'comercial_leads', periodPreset: 'ultimos_30_dias', nicheId: 'niche-1' },
    favorite: true,
  });

  const ws = makeSampleWorkspace();
  const json = serializeCompleteBackupJson({
    niches: ws.niches,
    leads: ws.leads,
    importedSheets: [],
    savedReports: [savedReport],
    analyticsSettings: {
      id: 'default',
      defaultPeriodPreset: 'ultimos_30_dias',
      favoriteKpis: ['receita_realizada', 'clientes_ativos'],
      compactTables: true,
      showDataLimitationsNotice: true,
      schemaVersion: 1,
    },
    userName: 'Admin',
  });

  const validated = parseAndValidateBackup(json);
  assert.equal(validated.ok, true);
  assert.equal(validated.warnings.length, 0);
  assert.equal(validated.data?.savedReports?.length, 1);
  assert.equal(validated.data?.analyticsSettings?.compactTables, true);

  const prepared = prepareBackupRestorePayload(
    validated.data!,
    { niches: [], leads: [], importedSheets: [] },
    'merge_by_id'
  );
  assert.equal(prepared.savedReportsToWrite.length, 1);
  assert.equal(prepared.analyticsSettingsToWrite?.defaultPeriodPreset, 'ultimos_30_dias');
});
